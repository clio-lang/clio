#define main generated_main
#include "host.cpp"
#undef main
#include "../metal-proof/FloatOracle.h"
#include <chrono>
#include <thread>
#define CHECK(x)                                                                                   \
  do {                                                                                             \
    if (!(x)) {                                                                                    \
      std::fprintf(stderr, "Matmul reduction assertion %d: %s\n", __LINE__, #x);                   \
      std::abort();                                                                                \
    }                                                                                              \
  } while (false)
void empty(m::Runtime &runtime, std::optional<std::uint64_t> baseline = {}) {
  auto s = runtime.stats();
  CHECK(s.bytes == baseline.value_or(0) && !s.inFlight && !s.stagingBuffers && !s.argumentBytes &&
        !s.argumentPacks);
  if (!baseline)
    CHECK(!s.metalBuffers && !s.hostBackings && !s.deviceBackings);
}
void retire(TaskCore &core, GroupHandle group) {
  CHECK(core.close(group) && core.drain() && core.release(group));
  auto s = core.stats();
  CHECK(!s.records && !s.groups && !s.retainedOwners && !s.retainedBytes && !s.externalPending);
}
m::Buffer observe(TaskCore &core, TaskHandle task) {
  Invocation context;
  alignas(m::Buffer) std::byte slot[sizeof(m::Buffer)];
  CHECK(core.observe(task, m::Runtime::bufferLayout(), context, slot));
  auto *v = std::launder(reinterpret_cast<m::Buffer *>(slot));
  auto result = *v;
  v->~Buffer();
  return result;
}
m::Buffer upload(m::Runtime &r, std::span<const std::uint32_t> bits,
                 std::array<std::int64_t, 2> shape) {
  auto host = r.hostTensor(std::as_bytes(bits), shape, m::Format::Float32);
  CHECK(host);
  auto d = r.device();
  CHECK(d);
  auto core = TaskCore::create();
  CHECK(core);
  auto group = core->openRoot();
  auto task = r.upload(*core, group, *host, *d);
  CHECK(task && core->drain());
  auto result = observe(*core, task);
  retire(*core, group);
  return result;
}
std::uint32_t sum(std::vector<std::uint32_t> v) {
  if (v.empty())
    return 0;
  while (v.size() > 1) {
    auto n = v.size();
    for (std::size_t i = 0; i < n / 2; ++i)
      v[i] = float_proof::oracle({v[2 * i], v[2 * i + 1]}, 0);
    if (n % 2)
      v[n / 2] = v.back();
    v.resize((n + 1) / 2);
  }
  return v[0];
}
template <class F> void until(TaskCore &core, F predicate) {
  auto end = std::chrono::steady_clock::now() + std::chrono::seconds(10);
  while (!predicate()) {
    CHECK(std::chrono::steady_clock::now() < end);
    core.step();
    std::this_thread::yield();
  }
}
std::uint32_t scalar(TaskCore &core, TaskHandle task) {
  Invocation context;
  float value = 123;
  CHECK(core.observe(task, m::Runtime::scalarLayout(), context, &value));
  return std::bit_cast<std::uint32_t>(value);
}
int main(int argc, char **argv) {
  CHECK(argc == 2);
  const std::string directory = argv[1];
  auto owner = m::Runtime::create();
  CHECK(owner);
  auto &r = **owner;
  auto d = r.device();
  CHECK(d);
  auto matrix = r.loadMatmulKernel(directory + "/kernel0.metallib", *d);
  auto reduce = r.loadReductionKernel(directory + "/kernel0-reduce.metallib", *d);
  auto left = r.loadElementwiseKernel(directory + "/kernel0-left.metallib", *d, {2, 1},
                                      std::array<std::uint32_t, 1>{0});
  auto right = r.loadElementwiseKernel(directory + "/kernel0-right.metallib", *d, {2, 1},
                                       std::array<std::uint32_t, 1>{1});
  CHECK(matrix && reduce && left && right);
  auto graph = [&](TaskCore &core, GroupHandle group, m::Buffer a, m::Buffer b, float scale) {
    return r.matmulReduceSum(core, group, *matrix, *reduce, a, b, *left, *right, std::array{a, b},
                             std::array{scale});
  };
  std::uint64_t cases = 0;
  std::uint32_t seed = 0x7a351b43;
  auto random = [&] {
    seed ^= seed << 13;
    seed ^= seed >> 17;
    seed ^= seed << 5;
    return seed;
  };
  for (auto shape : {std::array<std::int64_t, 3>{0, 3, 2},
                     {2, 3, 0},
                     {2, 0, 3},
                     {1, 1, 1},
                     {3, 5, 3},
                     {4, 5, 4},
                     {9, 17, 7},
                     {17, 33, 16}}) {
    auto [m, k, n] = shape;
    for (unsigned pattern = 0; pattern < 6; ++pattern)
      for (float scale : {-1.5f, 0.0f}) {
        auto values = [&](std::size_t size) {
          std::vector<std::uint32_t> bits(size);
          for (auto &v : bits) {
            auto x = random();
            v = (x & 0x807fffffu) | ((120 + x % 15) << 23);
            if (pattern == 1)
              v = x & 0x807fffffu;
            if (pattern == 2)
              v = (x & 1) ? 0x80000000u : 0;
            if (pattern == 3)
              v = std::array{0x7f800000u, 0xff800000u, 0x7fc12345u, 0x7f800001u,
                             0x3f800000u}[x % 5];
            if (pattern == 4)
              v = std::array{0x60ad78ecu, 0x3f800000u, 0xe0ad78ecu, 0x3f800000u}[x % 4];
            if (pattern == 5)
              v = x;
          }
          return bits;
        };
        auto a = values(m * k), b = values(k * n);
        auto ga = upload(r, a, {m, k}), gb = upload(r, b, {k, n});
        const auto baseline = r.stats().bytes;
        for (bool mapped : {false, true}) {
          auto core = TaskCore::create();
          CHECK(core);
          auto group = core->openRoot();
          auto work = mapped ? graph(*core, group, ga, gb, scale)
                             : r.matmulReduceSum(*core, group, *matrix, *reduce, ga, gb);
          CHECK(work && core->drain());
          auto al = ga, br = gb;
          if (mapped) {
            auto l = r.elementwise(*core, group, *left, std::array{ga, gb}, std::array{scale});
            auto q = r.elementwise(*core, group, *right, std::array{ga, gb}, std::array{scale});
            CHECK(l && q && core->drain());
            al = observe(*core, l);
            br = observe(*core, q);
          }
          auto mul = r.matmul(*core, group, *matrix, al, br);
          CHECK(mul && core->drain());
          auto resident = observe(*core, mul);
          auto separate = r.reduceSum(*core, group, *reduce, resident);
          CHECK(separate && core->drain());
          Invocation cpuContext;
          auto descriptor = [&](const auto &bits, std::array<std::int64_t, 2> dims) {
            auto *data = static_cast<float *>(cpuContext.allocate(bits.size() * 4));
            CHECK(data);
            if (!bits.empty())
              std::memcpy(data, bits.data(), bits.size() * 4);
            return Float32Tensor<2>{data, data, 0, dims, {dims[1], 1}};
          };
          auto ca = descriptor(a, {m, k}), cb = descriptor(b, {k, n});
          auto cpu = mapped ? _mlir_ciface_kalandra_cpu_0(&ca, scale, &cb, &cpuContext)
                            : _mlir_ciface_kalandra_cpu_1(&ca, &cb, &cpuContext);
          CHECK(!cpuContext.status());
          std::vector<std::uint32_t> products;
          for (std::int64_t row = 0; row < m; ++row)
            for (std::int64_t col = 0; col < n; ++col) {
              std::vector<std::uint32_t> terms(k);
              for (std::int64_t i = 0; i < k; ++i) {
                auto x = a[row * k + i], y = b[i * n + col];
                if (mapped) {
                  x = float_proof::oracle({x, std::bit_cast<std::uint32_t>(scale)}, 0);
                  y = float_proof::oracle({y, 0x3f800000u}, 3);
                }
                terms[i] = float_proof::oracle({x, y}, 1);
              }
              products.push_back(sum(std::move(terms)));
            }
          auto expected = sum(std::move(products));
          CHECK(float_proof::equal(scalar(*core, work), expected));
          CHECK(float_proof::equal(scalar(*core, separate), expected));
          CHECK(float_proof::equal(std::bit_cast<std::uint32_t>(cpu), expected));
          CHECK(scalar(*core, work) == scalar(*core, work));
          al = {};
          br = {};
          resident = {};
          retire(*core, group);
          empty(r, baseline);
          ++cases;
        }
      }
  }
  empty(r);
  auto a = upload(r, std::vector<std::uint32_t>(15, 0x3f800000u), {3, 5});
  auto b = upload(r, std::vector<std::uint32_t>(20, 0x40000000u), {5, 4});
  auto baseline = r.stats().bytes;
  auto run = [&](bool success) {
    auto core = TaskCore::create();
    CHECK(core);
    auto group = core->openRoot();
    auto work = graph(*core, group, a, b, 2);
    CHECK(work && core->drain());
    if (success)
      CHECK(scalar(*core, work) == std::bit_cast<std::uint32_t>(180.0f));
    else {
      CHECK(core->failure(work).kind == TaskFailure::Fault && core->failure(work).code == 2);
      Invocation context;
      float value = 123;
      CHECK(!core->observe(work, m::Runtime::scalarLayout(), context, &value) && value == 123);
    }
    retire(*core, group);
    empty(r, baseline);
  };
  r.failAllocationAt(0);
  run(true);
  auto attempts = r.stats().attempts;
  for (std::uint64_t i = 1; i <= attempts; ++i) {
    r.failAllocationAt(i);
    run(false);
  }
  r.failAllocationAt(0);
  for (unsigned stage = 0; stage < 4; ++stage)
    for (unsigned scenario = 0; scenario < 3; ++scenario) {
      auto core = TaskCore::create();
      CHECK(core);
      auto group = core->openRoot();
      auto before = r.stats().submissions;
      r.holdCompletions(true);
      auto work = graph(*core, group, a, b, 2);
      CHECK(work);
      for (unsigned j = 0; j < stage; ++j) {
        until(*core, [&] {
          return r.stats().submissions == before + j + 1 && core->stats().externalPending == 1;
        });
        r.holdCompletions(false);
        auto end = std::chrono::steady_clock::now() + std::chrono::seconds(10);
        while (r.stats().completions < before + j + 1) {
          CHECK(std::chrono::steady_clock::now() < end);
          std::this_thread::yield();
        }
        r.holdCompletions(true);
      }
      until(*core, [&] {
        return r.stats().submissions == before + stage + 1 && core->stats().externalPending == 1;
      });
      if (scenario < 2)
        CHECK(core->cancel(group, scenario == 1));
      else
        r.failNextCompletion();
      r.holdCompletions(false);
      CHECK(core->drain());
      CHECK(core->failure(work).kind ==
            (scenario < 2 ? TaskFailure::Cancelled : TaskFailure::Fault));
      if (scenario == 1)
        CHECK(core->failure(group).kind == TaskFailure::DeadlineExceeded);
      retire(*core, group);
      empty(r, baseline);
    }
  {
    auto core = TaskCore::create();
    CHECK(core);
    auto group = core->openRoot();
    r.holdCompletions(true);
    CHECK(graph(*core, group, a, b, 2));
    until(*core, [&] { return core->stats().externalPending == 1; });
    std::thread release([&] {
      std::this_thread::sleep_for(std::chrono::milliseconds(10));
      r.holdCompletions(false);
    });
    core.reset();
    release.join();
    empty(r, baseline);
  }
  for (auto invalid : {m::Kernel{}, *matrix}) {
    auto core = TaskCore::create();
    CHECK(core);
    auto group = core->openRoot();
    auto before = r.stats().submissions;
    auto work = r.matmulReduceSum(*core, group, *matrix, invalid, a, b);
    CHECK(work && core->drain());
    CHECK(core->failure(work).kind == TaskFailure::Fault && core->failure(work).code == 3);
    CHECK(r.stats().submissions == before);
    retire(*core, group);
    empty(r, baseline);
  }
  // Final scalars remain observable after all original inputs are released.
  {
    auto core = TaskCore::create();
    CHECK(core);
    auto group = core->openRoot();
    auto work = graph(*core, group, a, b, 2);
    CHECK(work && core->drain());
    a = {};
    b = {};
    empty(r);
    CHECK(scalar(*core, work) == std::bit_cast<std::uint32_t>(180.0f));
    retire(*core, group);
  }
  // A single in-flight slot suffices; reject reduction scratch after matrix acknowledgement.
  for (bool limited : {false, true}) {
    auto owner = m::Runtime::create({.maxBytes = 512, .maxInFlight = 1});
    CHECK(owner);
    auto &rt = **owner;
    auto dev = rt.device();
    CHECK(dev);
    auto mul = rt.loadMatmulKernel(directory + "/kernel0.metallib", *dev);
    auto red = rt.loadReductionKernel(directory + "/kernel0-reduce.metallib", *dev);
    CHECK(mul && red);
    auto x = upload(rt, std::vector<std::uint32_t>(15, 0x3f800000u), {3, 5});
    auto y = upload(rt, std::vector<std::uint32_t>(20, 0x40000000u), {5, 4});
    m::Buffer padding;
    if (limited) {
      std::vector<std::uint32_t> data(78);
      std::array<std::int64_t, 2> dims{1, 78};
      auto host = rt.hostTensor(std::as_bytes(std::span(data)), dims, m::Format::Float32);
      CHECK(host);
      padding = *host;
    }
    auto core = TaskCore::create();
    CHECK(core);
    auto group = core->openRoot();
    auto before = rt.stats().submissions;
    auto work = rt.matmulReduceSum(*core, group, *mul, *red, x, y);
    CHECK(work && core->drain());
    if (limited) {
      CHECK(core->failure(work).kind == TaskFailure::Fault && core->failure(work).code == 6);
      CHECK(rt.stats().submissions == before + 1);
    } else
      CHECK(scalar(*core, work) == std::bit_cast<std::uint32_t>(120.0f));
    retire(*core, group);
    x = {};
    y = {};
    padding = {};
    empty(rt);
  }
  CHECK(generated_main(argc, argv) == 0);
  empty(r);
  std::printf("Matrix reduction: %llu CPU/GPU/separate/APFloat cases, %llu allocation checkpoints, "
              "all-stage cancellation/failure passed\n",
              (unsigned long long)cases, (unsigned long long)attempts);
}
