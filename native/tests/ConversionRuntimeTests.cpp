#include "../metal-proof/Float64Oracle.h"
#include "../runtime/NumericStorage.h"
#include "../runtime/Runtime.h"
#include "llvm/ADT/APSInt.h"
#include <bit>
#include <iostream>
using namespace kalandra;
using namespace kalandra::runtime;
using namespace float64_proof;
#ifndef SOURCE_TYPE
#define SOURCE_TYPE 9
#endif
#ifndef DESTINATION_TYPE
#define DESTINATION_TYPE 6
#endif
constexpr auto source = static_cast<NumericType>(SOURCE_TYPE),
               destination = static_cast<NumericType>(DESTINATION_TYPE);
using Input = NumericValue<source>;
using Output = NumericValue<destination>;
extern "C" Output _mlir_ciface_kalandra_test_entry(Input, Invocation *);
#include "ConversionOracle.h"
int main() {
  try {
    auto inputs = conversionInputs();
    std::vector<Expected> expected;
    for (auto bits : inputs)
      expected.push_back(reference(bits));
    std::uint64_t cases = 0, faults = 0;
    {
      FpState state;
      for (unsigned environment = 0; environment < 8; ++environment) {
        state.set(environment);
        for (std::size_t i = 0; i < inputs.size(); ++i) {
          Invocation context;
          auto value = _mlir_ciface_kalandra_test_entry(std::bit_cast<Input>(Raw<Input>(inputs[i])),
                                                        &context);
          auto bits = std::uint64_t(std::bit_cast<Raw<Output>>(value));
          const auto valid = expected[i].valid;
          if (context.status() != (valid ? 0 : 4) || bits != (valid ? expected[i].bits : 0) ||
              (!valid && (context.line() != 2 || context.column() != 3))) {
            std::cerr << describeNumeric(source)->name << " -> "
                      << describeNumeric(destination)->name << " input " << std::hex << inputs[i]
                      << " result " << bits << " expected " << expected[i].bits << std::dec
                      << " status " << context.status() << " valid " << valid << '\n';
            throw std::runtime_error("conversion mismatch");
          }
          ++cases;
          faults += !valid;
          context.settle();
          if (context.live() || context.allocations() != context.releases())
            throw std::runtime_error("conversion leaked");
        }
        state.checkFlags();
      }
    }
    Invocation context;
    std::atomic<bool> token{true};
    context.bindCancellation(&token);
    auto value = _mlir_ciface_kalandra_test_entry(Input{}, &context);
    if (std::bit_cast<Raw<Output>>(value) != 0 || context.poll() != -1 || context.status())
      throw std::runtime_error("conversion cancellation failed");
    context.settle();
    std::cout << "conversion " << describeNumeric(source)->name << " -> "
              << describeNumeric(destination)->name << ": " << cases << " cases, " << faults
              << " faults; exact oracle bits, eight FP environments and settled owners passed\n";
  } catch (const std::exception &error) {
    std::cerr << error.what() << '\n';
    return 1;
  }
}
