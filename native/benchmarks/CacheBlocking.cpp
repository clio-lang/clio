// Research kernels, not compiler/runtime implementations. Preserve the strict
// adjacent-pair tree so layout experiments do not silently change arithmetic.
#define ACCELERATE_NEW_LAPACK
#include "../runtime/Runtime.h"
#include <Accelerate/Accelerate.h>
#include <algorithm>
#include <array>
#include <atomic>
#include <bit>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <memory>
#include <random>
#include <stdexcept>
#include <string_view>
#include <vector>
using kalandra::runtime::Invocation;
using Clock = std::chrono::steady_clock;
using Vec = float __attribute__((ext_vector_type(4)));
struct Matrix {
  float *allocated, *aligned;
  std::int64_t offset, sizes[2], strides[2];
};
extern "C" float _mlir_ciface_kalandra_test_entry(Matrix *, Matrix *, Invocation *);
static void check(bool ok) {
  if (!ok) {
    std::fputs("Cache-blocking experiment validation failed\n", stderr);
    std::exit(1);
  }
}
static bool same(float a, float b) {
  return (std::isnan(a) && std::isnan(b)) ||
         std::bit_cast<std::uint32_t>(a) == std::bit_cast<std::uint32_t>(b);
}
static void poll(Invocation &context, std::size_t i = 0) {
  if (i % 256 == 0 && context.poll())
    throw std::runtime_error("cancelled research kernel");
}
static float referenceSum(std::vector<float> values) {
  while (values.size() > 1) {
    std::vector<float> next;
    for (std::size_t i = 0; i < values.size(); i += 2) {
      if (i + 1 == values.size())
        next.push_back(values[i]);
      else {
        volatile float rounded = values[i] + values[i + 1];
        next.push_back(static_cast<float>(rounded));
      }
    }
    values = std::move(next);
  }
  return values.empty() ? 0.0f : values[0];
}
struct Shape {
  const char *name;
  std::size_t m, k, n;
};
static constexpr Shape shapes[] = {
    {"control-32", 32, 32, 32},          {"control-96", 96, 96, 96},
    {"wide-512", 64, 256, 512},          {"square-256", 256, 256, 256},
    {"tall-512", 512, 128, 256},         {"deep-1024", 128, 1024, 128},
    {"deep-tail", 128, 1025, 131},       {"wide-1024", 64, 64, 1024},
    {"mixed-tail", 65, 257, 259},        {"deep-4097", 32, 4097, 67},
    {"deep-8193", 16, 8193, 257},        {"square-512", 512, 512, 512},
    {"large-rectangle", 128, 1024, 1024}};
struct Data {
  Shape shape;
  std::vector<float> left, right, cells;
  Matrix a, b;
  float expected;
  explicit Data(Shape s, unsigned mode = 0)
      : shape(s), left(s.m * s.k), right(s.k * s.n), cells(s.m * s.n),
        a{left.data(),
          left.data(),
          0,
          {std::int64_t(s.m), std::int64_t(s.k)},
          {std::int64_t(s.k), 1}},
        b{right.data(),
          right.data(),
          0,
          {std::int64_t(s.k), std::int64_t(s.n)},
          {std::int64_t(s.n), 1}} {
    const auto value = [mode](std::size_t i) {
      static constexpr std::uint32_t edges[] = {
          0,          0x80000000, 1,          0x80000001, 0x007fffff, 0x00800000, 0x7f7fffff,
          0xff7fffff, 0x7f800000, 0xff800000, 0x7fc00001, 0x3f800001, 0xbf800000};
      if (mode == 2)
        return std::bit_cast<float>(edges[i % std::size(edges)]);
      if (mode == 1) {
        auto x = std::uint32_t(i + 1) * 2654435761U;
        x ^= x >> 13;
        return std::bit_cast<float>((x & 0x807fffff) | (((x >> 23) % 46 + 100) << 23));
      }
      return float(int(i % 17) - 8) / 8.0f;
    };
    for (std::size_t i = 0; i < left.size(); ++i)
      left[i] = value(i + 1);
    for (std::size_t i = 0; i < right.size(); ++i)
      right[i] = value(i + 7);
    for (std::size_t row = 0; row < s.m; ++row)
      for (std::size_t col = 0; col < s.n; ++col) {
        std::vector<float> products;
        products.reserve(s.k);
        for (std::size_t k = 0; k < s.k; ++k) {
          volatile float rounded = left[row * s.k + k] * right[k * s.n + col];
          products.push_back(static_cast<float>(rounded));
        }
        cells[row * s.n + col] = referenceSum(std::move(products));
      }
    expected = referenceSum(cells);
  }
};
static float finalSum(const std::vector<float> &output, Invocation &context) {
  // Keep the output and final reduction buffers separate, as in generated code.
  auto scratch = output;
  auto length = scratch.size();
  while (length > 1) {
    poll(context);
    auto pairs = length / 2;
    for (std::size_t i = 0; i < pairs; ++i) {
      poll(context, i);
      scratch[i] = scratch[2 * i] + scratch[2 * i + 1];
    }
    if (length % 2)
      scratch[pairs] = scratch[length - 1];
    length = pairs + length % 2;
  }
  return length ? scratch[0] : 0.0f;
}
// A power-of-two K block forms one aligned subtree of the global balanced
// reduction. Reducing block roots with that same tree preserves every pairing,
// including a partially filled last block (odd elements are carried unchanged).
template <unsigned Rows, unsigned Columns, unsigned Block>
static float prototype(Data &data, Invocation &context, bool verifyCells) {
  static_assert(Columns % 4 == 0 && (Block == 0 || (Block & (Block - 1)) == 0));
  const auto [name, m, k, n] = data.shape;
  (void)name;
  constexpr std::size_t groups = Columns / 4, stride = Rows * groups;
  const auto blockSize = Block ? std::min<std::size_t>(Block, k) : k;
  const auto chunks = [&] {
    if constexpr (Block)
      return k ? (k + Block - 1) / Block : 0;
    else
      return std::size_t(k != 0);
  }();
  std::vector<float> output(m * n, 0.0f);
  const auto count = (blockSize + (Block ? chunks : 0)) * stride;
  auto storage = std::make_unique_for_overwrite<Vec[]>(count);
  auto products = storage.get();
  auto roots = Block && count ? products + blockSize * stride : nullptr;
  for (std::size_t row = 0; row < m; row += Rows) {
    poll(context, row / Rows);
    auto activeRows = std::min<std::size_t>(Rows, m - row);
    for (std::size_t col = 0; col < n; col += Columns) {
      poll(context, col / Columns);
      auto activeColumns = std::min<std::size_t>(Columns, n - col);
      auto activeGroups = (activeColumns + 3) / 4;
      const auto reduce = [&](Vec *values, std::size_t length) {
        while (length > 1) {
          poll(context);
          auto pairs = length / 2;
          for (std::size_t i = 0; i < pairs; ++i) {
            poll(context, i);
            for (std::size_t r = 0; r < activeRows; ++r)
              for (std::size_t g = 0; g < activeGroups; ++g) {
                auto at = r * groups + g;
                values[i * stride + at] =
                    values[2 * i * stride + at] + values[(2 * i + 1) * stride + at];
              }
          }
          if (length % 2)
            for (std::size_t r = 0; r < activeRows; ++r)
              for (std::size_t g = 0; g < activeGroups; ++g) {
                auto at = r * groups + g;
                values[pairs * stride + at] = values[(length - 1) * stride + at];
              }
          length = pairs + length % 2;
        }
      };
      for (std::size_t chunk = 0; chunk < chunks; ++chunk) {
        poll(context, chunk);
        auto start = chunk * blockSize;
        auto length = std::min(blockSize, k - start);
        for (std::size_t i = 0; i < length; ++i) {
          poll(context, i);
          for (std::size_t g = 0; g < activeGroups; ++g) {
            Vec right{};
            for (unsigned lane = 0; lane < 4; ++lane)
              if (g * 4 + lane < activeColumns)
                right[lane] = data.right[(start + i) * n + col + g * 4 + lane];
            for (std::size_t r = 0; r < activeRows; ++r) {
              auto x = data.left[(row + r) * k + start + i];
              Vec broadcast{x, x, x, x};
              products[i * stride + r * groups + g] = broadcast * right;
            }
          }
        }
        reduce(products, length);
        if constexpr (Block)
          for (std::size_t r = 0; r < activeRows; ++r)
            for (std::size_t g = 0; g < activeGroups; ++g) {
              auto at = r * groups + g;
              roots[chunk * stride + at] = products[at];
            }
      }
      if (k) {
        auto values = Block ? roots : products;
        if constexpr (Block)
          reduce(roots, chunks);
        for (std::size_t r = 0; r < activeRows; ++r)
          for (std::size_t c = 0; c < activeColumns; ++c)
            output[(row + r) * n + col + c] = values[r * groups + c / 4][c % 4];
      }
    }
  }
  if (verifyCells)
    for (std::size_t i = 0; i < output.size(); ++i)
      check(same(output[i], data.cells[i]));
  return finalSum(output, context);
}
static float native(Data &data, Invocation &context, bool) {
  return _mlir_ciface_kalandra_test_entry(&data.a, &data.b, &context);
}
static float blas(Data &data, Invocation &context, bool verifyCells) {
  auto [name, m, k, n] = data.shape;
  (void)name;
  std::vector<float> output(m * n, 0.0f);
  if (m && n && k)
    cblas_sgemm(CblasRowMajor, CblasNoTrans, CblasNoTrans, m, n, k, 1, data.left.data(), k,
                data.right.data(), n, 0, output.data(), n);
  // BLAS is a performance reference with a different arithmetic policy. It is
  // validated against a scalar double oracle, not passed off as bitwise strict.
  if (verifyCells)
    for (std::size_t row = 0; row < m; ++row)
      for (std::size_t col = 0; col < n; ++col) {
        double expected = 0, scale = 0;
        for (std::size_t i = 0; i < k; ++i) {
          auto term = double(data.left[row * k + i]) * data.right[i * n + col];
          expected += term;
          scale += std::abs(term);
        }
        auto actual = output[row * n + col];
        check(std::isfinite(actual) && std::abs(double(actual) - expected) <= 1e-5 * (1 + scale));
      }
  return finalSum(output, context);
}
struct Variant {
  const char *name;
  unsigned rows, columns, block;
  float (*call)(Data &, Invocation &, bool);
};
static constexpr Variant variants[] = {{"native", 1, 4, 0, native},
                                       {"cpp-unblocked", 1, 4, 0, prototype<1, 4, 0>},
                                       {"cpp-k64", 1, 4, 64, prototype<1, 4, 64>},
                                       {"cpp-k256", 1, 4, 256, prototype<1, 4, 256>},
                                       {"cpp-k1024", 1, 4, 1024, prototype<1, 4, 1024>},
                                       {"cpp-n16-unblocked", 1, 16, 0, prototype<1, 16, 0>},
                                       {"cpp-n16-k256", 1, 16, 256, prototype<1, 16, 256>},
                                       {"cpp-m4-n16-unblocked", 4, 16, 0, prototype<4, 16, 0>},
                                       {"cpp-m4-n16-k64", 4, 16, 64, prototype<4, 16, 64>},
                                       {"cpp-m4-n16-k256", 4, 16, 256, prototype<4, 16, 256>},
                                       {"cpp-m4-n16-k1024", 4, 16, 1024, prototype<4, 16, 1024>},
                                       {"accelerate-single", 0, 0, 0, blas}};
static std::int64_t scratchBytes(const Variant &variant, Shape s) {
  if (variant.call == blas)
    return -1; // Accelerate workspace is opaque, not zero.
  if (variant.call == native)
    return s.m && s.n ? s.k * (s.n >= 4 ? 4 : s.n >= 2 ? 2 : 1) * sizeof(float) : 0;
  auto count = variant.block ? std::min<std::size_t>(variant.block, s.k) +
                                   (s.k ? (s.k + variant.block - 1) / variant.block : 0)
                             : s.k;
  return count * variant.rows * variant.columns * sizeof(float);
}
static float invoke(const Variant &v, Data &data, bool cells) {
  Invocation context;
  auto result = v.call(data, context, cells);
  check(!context.status());
  context.settle();
  check(!context.live() && context.allocations() == context.releases());
  return result;
}
static void verify() {
  unsigned cases = 0;
  for (auto k : {0U,   1U,   2U,   3U,   63U,  64U,  65U,  127U, 128U,  129U,  255U,
                 256U, 257U, 511U, 512U, 513U, 767U, 768U, 769U, 1023U, 1024U, 1025U})
    for (auto n : {0U, 1U, 2U, 3U, 4U, 7U, 15U, 16U, 17U, 18U, 19U, 31U, 32U, 33U})
      for (auto m : {0U, 1U, 2U, 3U, 4U, 5U, 7U})
        for (unsigned mode = 0; mode < 3; ++mode) {
          Data data({"verification", m, k, n}, mode);
          auto a = data.left, b = data.right;
          for (const auto &variant : variants) {
            if (variant.call == blas && mode != 0)
              continue;
            auto value = invoke(variant, data, true);
            if (variant.call != blas)
              check(same(value, data.expected));
          }
          check((a.empty() || !std::memcmp(a.data(), data.left.data(), a.size() * sizeof(float))) &&
                (b.empty() || !std::memcmp(b.data(), data.right.data(), b.size() * sizeof(float))));
          ++cases;
        }
  // Every research candidate must cooperate with cancellation, including tails.
  Data data({"cancel", 5, 257, 17});
  std::atomic<bool> cancelled{true};
  for (const auto &v : variants) {
    if (!std::string_view(v.name).starts_with("cpp-"))
      continue;
    Invocation context;
    context.bindCancellation(&cancelled);
    bool caught = false;
    try {
      (void)v.call(data, context, false);
    } catch (const std::runtime_error &) {
      caught = true;
    }
    check(caught);
    context.settle();
    check(!context.live());
  }
  std::printf("{\"verified_cases\":%u,\"strict_variants\":%zu,\"blas_threading\":\"single\"}\n",
              cases, std::size(variants) - 1);
}
int main(int argc, char **argv) {
  check(BLASSetThreading(BLAS_THREADING_SINGLE_THREADED) == 0 &&
        BLASGetThreading() == BLAS_THREADING_SINGLE_THREADED);
  if (argc == 2 && std::string_view(argv[1]) == "--verify") {
    verify();
    return 0;
  }
  unsigned seed = 20261015;
  if (argc == 3 && std::string_view(argv[1]) == "--seed") {
    char *end;
    seed = std::strtoul(argv[2], &end, 10);
    check(*argv[2] && !*end);
  } else
    check(argc == 1);
  std::mt19937 random(seed);
  std::vector<Shape> order(std::begin(shapes), std::end(shapes));
  std::shuffle(order.begin(), order.end(), random);
  for (auto shape : order) {
    Data data(shape);
    auto originalLeft = data.left, originalRight = data.right;
    std::array<float, std::size(variants)> expected{};
    for (unsigned v = 0; v < std::size(variants); ++v) {
      expected[v] = invoke(variants[v], data, true);
      if (variants[v].call != blas)
        check(same(expected[v], data.expected));
      std::printf(
          "{\"case\":\"%s\",\"variant\":\"%s\",\"m\":%zu,\"k\":%zu,\"n\":%zu,"
          "\"product_scratch_bytes\":%lld,\"output_and_sum_bytes\":%zu,\"expected_bits\":%u}\n",
          shape.name, variants[v].name, shape.m, shape.k, shape.n,
          (long long)scratchBytes(variants[v], shape), 2 * shape.m * shape.n * sizeof(float),
          std::bit_cast<std::uint32_t>(expected[v]));
    }
    std::vector<unsigned> choices(std::size(variants));
    for (unsigned v = 0; v < choices.size(); ++v)
      choices[v] = v;
    // Warm every variant before interleaved measured rounds.
    for (unsigned warm = 0; warm < 3; ++warm) {
      std::shuffle(choices.begin(), choices.end(), random);
      for (auto v : choices)
        check(same(invoke(variants[v], data, false), expected[v]));
    }
    for (unsigned round = 0; round < 7; ++round) {
      std::shuffle(choices.begin(), choices.end(), random);
      for (auto v : choices) {
        auto start = Clock::now();
        auto value = invoke(variants[v], data, false);
        auto duration = std::chrono::duration<double, std::milli>(Clock::now() - start).count();
        check(same(value, expected[v]));
        std::printf("{\"case\":\"%s\",\"variant\":\"%s\",\"round\":%u,\"ms\":%.6f}\n", shape.name,
                    variants[v].name, round, duration);
      }
    }
    check(
        !std::memcmp(originalLeft.data(), data.left.data(), originalLeft.size() * sizeof(float)) &&
        !std::memcmp(originalRight.data(), data.right.data(),
                     originalRight.size() * sizeof(float)));
  }
}
