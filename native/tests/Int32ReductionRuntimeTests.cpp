#include "../runtime/Tensor.h"
#include <array>
#include <bit>
#include <iostream>
#include <thread>
#include <vector>
#ifndef TENSOR_RANK
#define TENSOR_RANK 1
#endif
using namespace kalandra;
using namespace kalandra::runtime;
using Tensor = CpuTensor<NumericType::Int32, TENSOR_RANK>;
extern "C" std::int32_t _mlir_ciface_kalandra_test_entry(Tensor *, Invocation *);
static unsigned cases = 0, faults = 0;
template <std::size_t Rank>
static bool verify(std::vector<std::int32_t> values, std::array<std::int64_t, Rank> shape,
                   unsigned fail = 0, std::int64_t metadataFault = 0) {
  // Independent wider reference: adjacent pairs, with an unchanged odd tail.
  auto tree = values;
  bool overflow = false;
  while (tree.size() > 1 && !overflow) {
    std::vector<std::int32_t> next;
    for (std::size_t i = 0; i < tree.size(); i += 2) {
      const std::int64_t value = std::int64_t(tree[i]) + (i + 1 < tree.size() ? tree[i + 1] : 0);
      if (value < INT32_MIN || value > INT32_MAX) {
        overflow = true;
        break;
      }
      next.push_back(std::int32_t(value));
    }
    tree = std::move(next);
  }
  const auto expected = tree.empty() ? 0 : tree[0];
  // Offset view with padded strides: do not assume contiguous foreign input.
  std::vector<std::int32_t> storage(values.size() * 2 + 8, 1234567);
  for (std::size_t i = 0; i < values.size(); ++i)
    storage[3 + 2 * i] = values[i];
  auto before = storage;
  CpuTensor<NumericType::Int32, Rank> input{};
  input.allocated = storage.data();
  input.aligned = storage.data() + 1;
  input.offset = 2;
  if constexpr (Rank > 0) {
    input.sizes = shape;
    std::int64_t stride = 2;
    for (std::size_t i = Rank; i > 0; --i) {
      input.strides[i - 1] = stride;
      // Invalid dimensions are checked before any reads; avoid host-side overflow.
      if (!metadataFault)
        stride *= shape[i - 1];
    }
  }
  Invocation context;
  context.failAllocationAt(fail);
  auto result = _mlir_ciface_kalandra_test_entry(&input, &context);
  const auto code = metadataFault ? metadataFault : fail ? 2 : overflow ? 4 : 0;
  ++cases;
  faults += code != 0;
  if (context.status() != code || (!code && result != expected) || (code && result != 0) ||
      (code == 4 && (context.line() != 2 || context.column() != 3)) || storage != before) {
    std::cerr << "rank " << TENSOR_RANK << " case " << cases << " status " << context.status()
              << " expected " << code << " result " << result << " reference " << expected << '\n';
    return false;
  }
  context.settle();
  return context.live() == 0 && context.allocations() == context.releases();
}
template <std::size_t Rank> static bool cancelled() {
  const std::size_t count = Rank ? 1048576 : 1;
  std::vector<std::int32_t> storage(count, 1);
  CpuTensor<NumericType::Int32, Rank> input{};
  input.allocated = input.aligned = storage.data();
  if constexpr (Rank > 0) {
    input.sizes.fill(1);
    input.sizes.back() = count;
    input.strides.fill(count);
    input.strides.back() = 1;
  }
  Invocation context;
  std::atomic<bool> token{Rank == 0}, done{false};
  std::atomic<std::uint64_t> polls{0};
  context.bindCancellation(&token);
  context.watchPolls(&polls);
  std::thread signal([&] {
    while (!done.load() && polls.load() < 4)
      std::this_thread::yield();
    if (!done.load())
      token.store(true);
  });
  auto value = _mlir_ciface_kalandra_test_entry(&input, &context);
  done.store(true);
  signal.join();
  bool ok = token.load() && value == 0 && context.poll() == -1 && !context.status();
  context.settle();
  return ok && !context.live() && context.allocations() == context.releases();
}
int main() {
  std::array<std::int64_t, TENSOR_RANK> shape{};
  shape.fill(1);
  for (auto value : {INT32_MIN, INT32_MAX, 16777217, -1, 0, 1})
    if (!verify({value}, shape) || !verify({value}, shape, 1))
      return 1;
  if (!cancelled<TENSOR_RANK>())
    return 1;
  if constexpr (TENSOR_RANK > 0) {
    for (auto size : {255, 256, 257, 1023, 1024, 1025, 32769}) {
      shape.fill(1);
      shape.back() = size;
      std::vector<std::int32_t> values(size, 1);
      if (!verify(values, shape))
        return 1;
    }
    for (auto values : {std::vector<std::int32_t>{},
                        {INT32_MAX, 1, -1},
                        {INT32_MIN, -1, 1},
                        {INT32_MAX, 1, INT32_MIN, 0},
                        {INT32_MAX, 0, 1, 0},
                        {INT32_MIN, 0, -1, 0},
                        {INT32_MAX, INT32_MIN, 1},
                        {INT32_MAX, -1, 1},
                        {16777217, 1, 2, 3, 4},
                        {1, 2, 3, 4, 5, 6, 7}}) {
      shape.fill(1);
      shape.back() = values.size();
      if (!verify(values, shape))
        return 1;
    }
    for (std::size_t axis = 0; axis < TENSOR_RANK; ++axis) {
      shape.fill(3);
      shape[axis] = 0;
      if (!verify({}, shape))
        return 1;
    }
    std::uint32_t state = 0x9e3779b9;
    auto next = [&] {
      state ^= state << 13;
      state ^= state >> 17;
      state ^= state << 5;
      return state;
    };
    for (unsigned trial = 0; trial < 1200; ++trial) {
      std::size_t count = 1;
      for (auto &d : shape) {
        d = next() % 7;
        count *= d;
      }
      std::vector<std::int32_t> values(count);
      for (auto &v : values)
        v = trial % 2 ? std::bit_cast<std::int32_t>(next()) : std::int32_t(next() % 20001) - 10000;
      if (!verify(values, shape))
        return 1;
    }
    shape.fill(1);
    shape[0] = -1;
    if (!verify({1}, shape, 0, 1))
      return 1;
    shape[0] = INT64_MAX;
    if (!verify({1}, shape, 0, 2))
      return 1;
  }
  std::cout << "Int32 reduction rank " << TENSOR_RANK << ": " << cases << " runtime inputs, "
            << faults
            << " checked faults; exact adjacent tree, offsets/strides and settled owners passed\n";
}
