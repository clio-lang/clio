#include "../runtime/Runtime.h"
#include <atomic>
#include <cstdint>
#include <iostream>
#include <stdexcept>

using kalandra::runtime::Invocation;
extern "C" std::int64_t _mlir_ciface_kalandra_test_entry(std::int64_t, Invocation *);
static void require(bool ok, const char *message) {
  if (!ok)
    throw std::runtime_error(message);
}
int main() {
  try {
#ifdef KALANDRA_FUNCTION_OWNERSHIP
    for (unsigned attempt = 0; attempt <= 24; ++attempt) {
      Invocation context;
      context.failAllocationAt(attempt);
      auto result = _mlir_ciface_kalandra_test_entry(0, &context);
      require((context.status() == 0 && result == 44) || (context.status() == 2 && result == 0),
              "indirect aggregate call lost allocation failure or published a partial result");
      context.settle();
      require(context.live() == 0 && context.allocations() == context.releases(),
              "indirect aggregate invocation leaked retained field storage");
    }
    std::cout << "Indirect aggregate ownership and allocation-failure cleanup passed\n";
#else
    for (auto input : {std::int64_t(-7), std::int64_t(1), std::int64_t(2), std::int64_t(7)}) {
      Invocation context;
      std::atomic<std::uint64_t> polls{0};
      context.watchPolls(&polls);
      auto result = _mlir_ciface_kalandra_test_entry(input, &context);
      require(context.status() == 0 && result == 84 / input && context.live() == 0,
              "indirect invocation changed a scalar result or retained storage");
      require(polls.load() >= 4, "indirect target bypassed checked invocation polling");
    }
    Invocation fault;
    require(_mlir_ciface_kalandra_test_entry(0, &fault) == 0 && fault.status() == 4 &&
                fault.line() == 2 && fault.column() == 3 && fault.live() == 0,
            "indirect arithmetic fault lost its context or original source location");
    Invocation alreadyFailed;
    alreadyFailed.fault(1, 99, 12);
    require(_mlir_ciface_kalandra_test_entry(0, &alreadyFailed) == 0 &&
                alreadyFailed.status() == 1 && alreadyFailed.line() == 99 &&
                alreadyFailed.column() == 12,
            "failed context executed the function pointer or replaced its primary fault");
    std::atomic<bool> cancel{true};
    Invocation cancelled;
    cancelled.bindCancellation(&cancel);
    require(_mlir_ciface_kalandra_test_entry(0, &cancelled) == 0 && cancelled.status() == 0 &&
                cancelled.live() == 0,
            "cancelled context entered the indirect target");
    std::cout << "Checked indirect invocation results, faults and cancellation passed\n";
#endif
    return 0;
  } catch (const std::exception &error) {
    std::cerr << error.what() << '\n';
    return 1;
  }
}
