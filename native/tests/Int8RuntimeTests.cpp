#include "../runtime/Runtime.h"
#include <cstdint>
#include <iostream>
#include <limits>
#include <string_view>
#include <type_traits>
using Cell = std::conditional_t<UNSIGNED_VALUE, std::uint8_t, std::int8_t>;
#ifdef COMPARISON
extern "C" bool _mlir_ciface_kalandra_test_entry(Cell, Cell, kalandra::runtime::Invocation *);
#else
extern "C" Cell _mlir_ciface_kalandra_test_entry(Cell, Cell, kalandra::runtime::Invocation *);
#endif
int main(int argc, char **argv) {
  if (argc != 2)
    return 2;
  std::string_view op = argv[1];
  std::uint64_t cases = 0, faults = 0;
  for (int x = std::numeric_limits<Cell>::min(); x <= std::numeric_limits<Cell>::max(); ++x)
    for (int y = op == "neg" ? 0 : std::numeric_limits<Cell>::min();
         y <= (op == "neg" ? 0 : std::numeric_limits<Cell>::max()); ++y) {
      int expected = 0;
      bool invalid = false;
      if (op == "add")
        expected = x + y;
      else if (op == "sub")
        expected = x - y;
      else if (op == "mul")
        expected = x * y;
      else if (op == "neg")
        expected = -x;
      else if (op == "div" || op == "rem") {
        invalid = y == 0;
        if (!invalid)
          expected = op == "div" ? x / y : x % y;
      } else if (op == "eq")
        expected = x == y;
      else if (op == "ne")
        expected = x != y;
      else if (op == "lt")
        expected = x < y;
      else if (op == "le")
        expected = x <= y;
      else if (op == "gt")
        expected = x > y;
      else if (op == "ge")
        expected = x >= y;
      else
        return 2;
#ifndef COMPARISON
      invalid |= expected < std::numeric_limits<Cell>::min() ||
                 expected > std::numeric_limits<Cell>::max();
#endif
      kalandra::runtime::Invocation ctx;
      auto result = _mlir_ciface_kalandra_test_entry(Cell(x), Cell(y), &ctx);
      if (ctx.status() != (invalid ? 4 : 0) || int(result) != (invalid ? 0 : expected) ||
          (invalid && (ctx.line() != 2 || ctx.column() != 3)) || ctx.allocations()) {
        std::cerr << op << "(" << x << "," << y << "): " << int(result) << " expected " << expected
                  << " status " << ctx.status() << '\n';
        return 1;
      }
      ctx.settle();
      if (ctx.live())
        return 1;
      ++cases;
      faults += invalid;
    }
  std::cout << (UNSIGNED_VALUE ? "uint8" : "int8") << " " << op << ": " << cases
            << " exhaustive pairs, " << faults << " checked faults passed\n";
}
