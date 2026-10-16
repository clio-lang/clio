#include "../runtime/Runtime.h"
#include <array>
#include <iostream>
#include <string_view>
extern "C" std::uint32_t _mlir_ciface_kalandra_test_entry(std::uint32_t, std::uint32_t,
                                                          kalandra::runtime::Invocation *);
int main(int argc, char **argv) {
  if (argc != 2)
    return 2;
  const std::string_view op = argv[1];
  std::uint64_t cases = 0, faults = 0;
  auto verify = [&](std::uint32_t a, std::uint32_t b) {
    const std::uint64_t x = a, y = b;
    std::uint64_t expected = 0;
    bool bad = false;
    if (op == "add")
      expected = x + y;
    else if (op == "sub") {
      bad = x < y;
      if (!bad)
        expected = x - y;
    } else if (op == "mul")
      expected = x * y;
    else if (op == "div" || op == "rem") {
      bad = y == 0;
      if (!bad)
        expected = op == "div" ? x / y : x % y;
    } else if (op == "neg")
      bad = x != 0;
    else if (op == "pos")
      expected = x;
    else
      return false;
    bad |= expected > UINT32_MAX;
    kalandra::runtime::Invocation context;
    auto result = _mlir_ciface_kalandra_test_entry(a, b, &context);
    ++cases;
    faults += bad;
    if (context.live() || context.hasTaskError() || context.status() != (bad ? 4 : 0) ||
        (!bad && result != expected) ||
        (bad && (result != 0 || context.line() != 2 || context.column() != 3))) {
      std::cerr << op << '(' << a << ',' << b << ") result=" << result << " expected=" << expected
                << " status=" << context.status() << '\n';
      return false;
    }
    return true;
  };
  const std::array<std::uint32_t, 16> edges{0,
                                            1,
                                            2,
                                            3,
                                            255,
                                            256,
                                            65535,
                                            65536,
                                            65537,
                                            16777217,
                                            2147483647,
                                            2147483648,
                                            2147483649,
                                            UINT32_MAX - 2,
                                            UINT32_MAX - 1,
                                            UINT32_MAX};
  for (auto a : edges)
    for (auto b : edges)
      if (!verify(a, b))
        return 1;
  std::uint32_t state = 0x12345678;
  auto next = [&] {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    return state;
  };
  for (unsigned i = 0; i < 10000; ++i) {
    auto a = next(), b = next();
    if (!verify(a, b))
      return 1;
  }
  std::cout << "uint32 " << op << ": " << cases << " runtime inputs, " << faults
            << " checked faults passed\n";
}
