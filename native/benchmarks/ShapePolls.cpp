// Untimed diagnostic. Atomic poll counting must never enter throughput samples.
#include "../runtime/Runtime.h"
#include <atomic>
#include <cstdio>
#include <cstdlib>
#include <vector>
struct Matrix {
  float *allocated, *aligned;
  std::int64_t offset, sizes[2], strides[2];
};
extern "C" float _mlir_ciface_kalandra_test_entry(Matrix *, Matrix *,
                                                  kalandra::runtime::Invocation *);
int main(int argc, char **argv) {
  if (argc != 4)
    return 2;
  std::int64_t dimensions[3];
  for (unsigned i = 0; i < 3; ++i) {
    char *end;
    auto n = std::strtoul(argv[i + 1], &end, 10);
    if (!*argv[i + 1] || *end || !n || n > 32768)
      return 2;
    dimensions[i] = n;
  }
  auto [rows, inner, columns] = dimensions;
  if (rows * inner * columns > (1 << 24))
    return 2;
  std::vector<float> a(rows * inner, 1), b(inner * columns, 1);
  Matrix left{a.data(), a.data(), 0, {rows, inner}, {inner, 1}};
  Matrix right{b.data(), b.data(), 0, {inner, columns}, {columns, 1}};
  std::atomic<std::uint64_t> polls{0};
  kalandra::runtime::Invocation context;
  context.watchPolls(&polls);
  auto result = _mlir_ciface_kalandra_test_entry(&left, &right, &context);
  if (context.status() || result != float(rows * inner * columns))
    return 1;
  context.settle();
  if (context.live() || context.allocations() != context.releases())
    return 1;
  std::printf("{\"rows\":%lld,\"inner\":%lld,\"columns\":%lld,\"polls\":%llu,"
              "\"allocations\":%llu,\"releases\":%llu}\n",
              (long long)rows, (long long)inner, (long long)columns,
              (unsigned long long)polls.load(), (unsigned long long)context.allocations(),
              (unsigned long long)context.releases());
}
