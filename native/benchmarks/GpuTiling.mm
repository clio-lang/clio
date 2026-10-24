// Isolated layout study: production compiler/runtime policy is unchanged.
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wreturn-type"
#define main scaling_benchmark_main
#include "GpuScaling.mm"
#undef main
#pragma clang diagnostic pop
#include "../metal-proof/FloatOracle.h"

const char *names[] = {"scalar", "shared8x8", "register2x2", "register2x1"};
const char *entries[] = {"kalandra_matmul", "kalandra_matmul", "kalandra_matmul_2x2",
                         "kalandra_matmul_2x1"};
struct TileDirect : Direct {
  unsigned layout;
  TileDirect(id<MTLDevice> device, id<MTLComputePipelineState> p, const Data &data, unsigned l)
      : Direct(device, p, data), layout(l) {}
  id<MTLCommandBuffer> command(const Data &data) {
    auto cmd = [queue commandBuffer];
    auto encoder = [cmd computeCommandEncoder];
    CHECK(cmd && encoder);
    [encoder setComputePipelineState:pipeline];
    [encoder setBuffer:a offset:0 atIndex:0];
    [encoder setBuffer:b offset:0 atIndex:1];
    [encoder setBuffer:output offset:0 atIndex:2];
    [encoder setBuffer:parameters offset:0 atIndex:3];
    auto m = std::uint64_t(data.shape.rows), n = std::uint64_t(data.shape.columns);
    auto lanes = layout == 2   ? ((m + 1) / 2) * ((n + 1) / 2)
                 : layout == 3 ? ((m + 1) / 2) * n
                               : m * n;
    auto grid = layout == 1 ? MTLSizeMake((n + 7) / 8, (m + 7) / 8, 1)
                            : MTLSizeMake((lanes + 63) / 64, 1, 1);
    [encoder dispatchThreadgroups:grid threadsPerThreadgroup:MTLSizeMake(64, 1, 1)];
    [encoder endEncoding];
    return cmd;
  }
  Timing sample(const Data &data) {
    auto start = Clock::now();
    auto cmd = command(data);
    [cmd commit];
    [cmd waitUntilCompleted];
    Timing t;
    t.wall = milliseconds(start);
    CHECK(cmd.status == MTLCommandBufferStatusCompleted && cmd.GPUStartTime > 0 &&
          cmd.GPUEndTime >= cmd.GPUStartTime);
    t.gpu = (cmd.GPUEndTime - cmd.GPUStartTime) * 1000;
    // Separate readback command, excluded from both timing intervals.
    auto copy = [queue commandBuffer];
    auto blit = [copy blitCommandEncoder];
    CHECK(copy && blit);
    [blit copyFromBuffer:output
             sourceOffset:0
                 toBuffer:readback
        destinationOffset:0
                     size:data.expected.size() * 4];
    [blit endEncoding];
    [copy commit];
    [copy waitUntilCompleted];
    CHECK(copy.status == MTLCommandBufferStatusCompleted);
    auto *actual = static_cast<const std::uint32_t *>(readback.contents);
    for (std::size_t i = 0; i < data.expected.size(); ++i) {
      auto expected = std::bit_cast<std::uint32_t>(data.expected[i]);
      if (!float_proof::equal(actual[i], expected)) {
        std::fprintf(stderr, "%s M=%lld K=%lld N=%lld cell=%zu expected=%08x actual=%08x\n",
                     names[layout], (long long)data.shape.rows, (long long)data.shape.inner,
                     (long long)data.shape.columns, i, expected, actual[i]);
        std::exit(1);
      }
    }
    return t;
  }
};
std::uint32_t tree(std::vector<std::uint32_t> values) {
  if (values.empty())
    return 0;
  while (values.size() > 1) {
    std::vector<std::uint32_t> next;
    for (std::size_t i = 0; i < values.size(); i += 2)
      next.push_back(i + 1 == values.size() ? values[i]
                                            : float_proof::oracle({values[i], values[i + 1]}, 0));
    values = std::move(next);
  }
  return values[0];
}
void qualify(id<MTLDevice> device, const std::array<id<MTLComputePipelineState>, 4> &pipelines) {
  std::uint32_t seed = 0x61dfc0ab;
  auto random = [&] {
    seed ^= seed << 13;
    seed ^= seed >> 17;
    seed ^= seed << 5;
    return seed;
  };
  std::uint64_t cases = 0, cells = 0, products = 0;
  auto run = [&](unsigned m, unsigned k, unsigned n, unsigned pattern) {
    @autoreleasepool {
      Data data({"conformance", true, m, k, n});
      auto fill = [&](std::vector<float> &values, bool left) {
        for (std::size_t i = 0; i < values.size(); ++i) {
          auto r = random(), bits = (r & 0x807fffffu) | ((120u + r % 15u) << 23);
          if (pattern == 1)
            bits = left ? 0x80000000u : 0x3f800000u;
          if (pattern == 2)
            bits =
                left ? r & 0x807fffffu : std::array{0x3f800000u, 0x3f000000u, 0x3f800001u}[i % 3];
          if (pattern == 3)
            bits = std::array{
                0x7f800000u, 0xff800000u, 0x7fc12345u, 0x7f800001u, 0u, 0x80000000u}[i % 6];
          if (pattern == 4)
            bits = left ? std::array{0x60ad78ecu, 0x3f800000u, 0xe0ad78ecu, 0x3f800000u}[i % 4]
                        : 0x3f800000u;
          if (pattern == 5)
            bits = r;
          values[i] = std::bit_cast<float>(bits);
        }
      };
      fill(data.a, true);
      fill(data.b, false);
      if (pattern == 6) {
        data.a = {std::bit_cast<float>(0x3f800001u), 1};
        data.b = {std::bit_cast<float>(0xbf7ffffeu), 1};
      }
      for (unsigned row = 0; row < m; ++row)
        for (unsigned col = 0; col < n; ++col) {
          std::vector<std::uint32_t> terms(k);
          for (unsigned i = 0; i < k; ++i)
            terms[i] = float_proof::oracle({std::bit_cast<std::uint32_t>(data.a[row * k + i]),
                                            std::bit_cast<std::uint32_t>(data.b[i * n + col])},
                                           1);
          data.expected[row * n + col] = std::bit_cast<float>(tree(std::move(terms)));
        }
      // Nonempty dummy allocations for K=0; shader parameters remain K=0.
      // A NaN sentinel exposes unintended reads/products in the empty contraction.
      if (data.a.empty())
        data.a.push_back(std::bit_cast<float>(0x7fc12345u));
      if (data.b.empty())
        data.b.push_back(std::bit_cast<float>(0x7fc12345u));
      for (unsigned layout = 0; layout < 4; ++layout) {
        TileDirect gpu(device, pipelines[layout], data, layout);
        // Poison the whole output plus a suffix guard before qualification.
        // This checks that even zero-valued cells are written, and that partial
        // tiles leave adjacent storage untouched. Timing runs omit this work.
        const auto payload = data.expected.size() * 4;
        gpu.output = [device newBufferWithLength:payload + 64
                                         options:MTLResourceStorageModePrivate];
        auto guard = [device newBufferWithLength:64 options:MTLResourceStorageModeShared];
        CHECK(gpu.output && guard);
        auto poison = [gpu.queue commandBuffer];
        auto fill = [poison blitCommandEncoder];
        CHECK(poison && fill);
        [fill fillBuffer:gpu.output range:NSMakeRange(0, payload + 64) value:0xa5];
        [fill endEncoding];
        [poison commit];
        [poison waitUntilCompleted];
        CHECK(poison.status == MTLCommandBufferStatusCompleted);
        gpu.sample(data);
        auto copy = [gpu.queue commandBuffer];
        auto blit = [copy blitCommandEncoder];
        CHECK(copy && blit);
        [blit copyFromBuffer:gpu.output
                 sourceOffset:payload
                     toBuffer:guard
            destinationOffset:0
                         size:64];
        [blit endEncoding];
        [copy commit];
        [copy waitUntilCompleted];
        CHECK(copy.status == MTLCommandBufferStatusCompleted);
        for (unsigned byte = 0; byte < 64; ++byte)
          CHECK(static_cast<const unsigned char *>(guard.contents)[byte] == 0xa5);
        gpu.immutable(data);
      }
      ++cases;
      cells += m * n;
      products += std::uint64_t(m) * k * n;
    }
  };
  for (unsigned k :
       {0u,  1u,  2u,  3u,   4u,   5u,   7u,   8u,   9u,   15u,  16u,  17u,  31u,   32u,   33u,
        63u, 64u, 65u, 127u, 128u, 129u, 255u, 256u, 257u, 511u, 512u, 513u, 1023u, 1024u, 1025u})
    for (auto shape : {std::array{1u, 1u}, std::array{3u, 5u}, std::array{8u, 9u}})
      for (unsigned pattern = 0; pattern < 6; ++pattern)
        run(shape[0], k, shape[1], pattern);
  // Partial register tiles, shared-memory tiles and complete threadgroup tails.
  for (unsigned m : {1u, 2u, 3u, 7u, 8u, 9u, 15u, 16u, 17u})
    for (unsigned n : {1u, 2u, 3u, 7u, 8u, 9u, 15u, 16u, 17u})
      for (unsigned k : {7u, 8u, 9u, 17u})
        for (unsigned pattern = 0; pattern < 6; ++pattern)
          run(m, k, n, pattern);
  run(1, 2, 1, 6);
  std::printf("{\"qualification\":{\"variants\":4,\"cases_per_variant\":%llu,\"cells_per_variant\":"
              "%llu,\"products_per_variant\":%llu,\"mismatches\":0,\"output_poison_and_suffix_"
              "guards_checked\":true}}\n",
              (unsigned long long)cases, (unsigned long long)cells, (unsigned long long)products);
}
int main(int argc, char **argv) {
  @autoreleasepool {
    CHECK(argc == 3 || argc == 5 || argc == 6);
    auto device = MTLCreateSystemDefaultDevice();
    CHECK(device);
    std::array<id<MTLComputePipelineState>, 4> pipelines;
    for (unsigned i = 0; i < 4; ++i) {
      auto path = std::string(argv[1]) + "/" + names[i] + ".metallib";
      NSError *error = nil;
      auto library = [device newLibraryWithURL:[NSURL fileURLWithPath:@(path.c_str())]
                                         error:&error];
      CHECK(library);
      auto function = [library newFunctionWithName:@(entries[i])];
      CHECK(function);
      pipelines[i] = [device newComputePipelineStateWithFunction:function error:&error];
      CHECK(pipelines[i] && pipelines[i].maxTotalThreadsPerThreadgroup >= 64);
    }
    if (argc == 3) {
      CHECK(std::string(argv[2]) == "--verify");
      qualify(device, pipelines);
      return 0;
    }
    unsigned warmups = std::stoul(argv[2]), samples = std::stoul(argv[3]),
             process = std::stoul(argv[4]);
    CHECK(warmups && samples);
    std::printf("{\"metadata\":{\"device\":\"%s\",\"registry_id\":%llu}}\n", device.name.UTF8String,
                (unsigned long long)device.registryID);
    std::vector<Shape> shapes = {
        {"matmul-8", true, 8, 8, 8},          {"matmul-32", true, 32, 32, 32},
        {"matmul-96", true, 96, 96, 96},      {"matmul-256", true, 256, 256, 256},
        {"matmul-512", true, 512, 512, 512},  {"matmul-deep-tail", true, 32, 1025, 65},
        {"matmul-wide", true, 128, 256, 512}, {"matmul-tall", true, 512, 256, 128}};
    std::vector<std::string> labels;
    if (argc == 6) {
      CHECK(std::string(argv[5]) == "crossover");
      shapes.clear();
      // Output occupancy, K depth, pair/quad tails and extreme aspect ratios.
      const std::vector<std::array<std::int64_t, 3>> sweep = {
          {128, 128, 128},  {128, 256, 128},  {128, 512, 128},  {181, 256, 181},  {256, 128, 256},
          {256, 255, 256},  {256, 256, 256},  {256, 257, 256},  {256, 511, 256},  {256, 512, 256},
          {256, 513, 256},  {256, 1025, 256}, {255, 256, 255},  {255, 256, 257},  {257, 256, 255},
          {257, 256, 257},  {256, 1, 256},    {256, 8, 256},    {256, 32, 256},   {256, 64, 256},
          {384, 256, 384},  {511, 256, 511},  {512, 256, 512},  {513, 256, 513},  {511, 512, 511},
          {512, 511, 512},  {512, 512, 512},  {512, 513, 512},  {513, 512, 513},  {128, 256, 512},
          {512, 256, 128},  {64, 256, 1024},  {1024, 256, 64},  {8, 256, 8192},   {8192, 256, 8},
          {2, 256, 32768},  {32768, 256, 2},  {1, 256, 65536},  {65536, 256, 1},  {16, 1025, 4096},
          {4096, 1025, 16}, {128, 1025, 512}, {512, 1025, 128}, {256, 256, 1024}, {1024, 256, 256},
          {127, 256, 513},  {513, 256, 127},  {128, 256, 511},  {511, 256, 128}};
      labels.reserve(sweep.size());
      for (auto dims : sweep)
        labels.push_back("m" + std::to_string(dims[0]) + "-k" + std::to_string(dims[1]) + "-n" +
                         std::to_string(dims[2]));
      for (std::size_t i = 0; i < sweep.size(); ++i)
        shapes.push_back({labels[i].c_str(), true, sweep[i][0], sweep[i][1], sweep[i][2]});
    }
    std::mt19937 rng(0x562214u + process);
    std::shuffle(shapes.begin(), shapes.end(), rng);
    for (auto shape : shapes) {
      @autoreleasepool {
        Data data(shape);
        std::vector<TileDirect> variants;
        for (unsigned i = 0; i < 4; ++i)
          variants.emplace_back(device, pipelines[i], data, i);
        for (unsigned round = 0; round < warmups + samples; ++round) {
          std::array<unsigned, 4> order{0, 1, 2, 3};
          std::shuffle(order.begin(), order.end(), rng);
          for (auto i : order) {
            auto t = variants[i].sample(data);
            if (round >= warmups)
              std::printf("{\"workload\":\"%s\",\"variant\":\"%s\",\"round\":%u,\"wall_ms\":%.9f,"
                          "\"gpu_ms\":%.9f,\"rows\":%lld,\"inner\":%lld,\"columns\":%lld}\n",
                          shape.name, names[i], round - warmups, t.wall, t.gpu,
                          (long long)shape.rows, (long long)shape.inner, (long long)shape.columns);
          }
        }
        data.immutable();
        for (auto &gpu : variants)
          gpu.immutable(data);
      }
    }
  }
}
