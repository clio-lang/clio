#include "../runtime/Tensor.h"
#include <iostream>
#include <stdexcept>
#include <thread>
#include <vector>
using namespace kalandra;
using namespace kalandra::runtime;
constexpr auto element = static_cast<NumericType>(NUMERIC_TYPE);
using Cell = NumericValue<element>;
using Tensor = CpuTensor<element, 1>;
extern "C" void _mlir_ciface_kalandra_test_entry(Tensor *, Tensor *, Invocation *);
static void require(bool ok, const char *message) {
  if (!ok)
    throw std::runtime_error(message);
}
static void metadata(std::int64_t extent, int code, unsigned fail = 0) {
  Cell cell{};
  Tensor input{}, output{};
  input.allocated = input.aligned = &cell;
  input.sizes = {extent};
  input.strides = {1};
  Invocation context;
  context.failAllocationAt(fail);
  _mlir_ciface_kalandra_test_entry(&output, &input, &context);
  require(context.status() == code && !output.allocated && !output.aligned,
          "constructor accepted invalid extent/byte metadata");
  context.settle();
  require(!context.live() && context.allocations() == context.releases(),
          "constructor metadata failure leaked owners");
}
static void cancellation(bool active) {
  std::vector<Cell> cells(active ? 1048576 : 1, Cell{7});
  Tensor input{}, output{};
  input.allocated = input.aligned = cells.data();
  input.sizes = {std::int64_t(cells.size())};
  input.strides = {1};
  Invocation context;
  std::atomic<bool> token{!active}, done{false};
  std::atomic<std::uint64_t> polls{0};
  context.bindCancellation(&token);
  context.watchPolls(&polls);
  std::thread sender;
  if (active)
    sender = std::thread([&] {
      while (!done.load() && polls.load() < 128)
        std::this_thread::yield();
      if (!done.load())
        token.store(true);
    });
  _mlir_ciface_kalandra_test_entry(&output, &input, &context);
  done.store(true);
  if (active)
    sender.join();
  require(token.load() && context.poll() == -1 && !context.status() && !output.allocated &&
              !output.aligned,
          "cancelled constructor published output or lost cancellation");
  if (active)
    require(polls.load() >= 128 && context.allocations(), "active copy was not entered");
  for (auto cell : cells)
    require(cell == Cell{7}, "cancelled constructor mutated input");
  context.settle();
  require(!context.live() && context.allocations() == context.releases(),
          "cancelled constructor leaked owners");
}
int main() {
  try {
    metadata(-1, 1);
    metadata(INT64_MAX / sizeof(Cell) + 1, 2);
    metadata(INT64_MAX / sizeof(Cell), 2, 1);
    cancellation(false);
    cancellation(true);
    std::cout << "array tensor bounds/cancellation " << describeNumeric(element)->name
              << ": 3 metadata and 2 cancellation cases; active copy interrupted, no partial "
                 "result, immutable input and settled owners passed\n";
  } catch (const std::exception &error) {
    std::cerr << error.what() << '\n';
    return 1;
  }
}
