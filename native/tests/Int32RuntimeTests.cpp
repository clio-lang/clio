#include "../runtime/Runtime.h"
#include <array>
#include <bit>
#include <cstdint>
#include <iostream>
#include <string_view>
extern "C" std::int32_t _mlir_ciface_kalandra_test_entry(std::int32_t, std::int32_t,
                                                         kalandra::runtime::Invocation *);
int main(int argc, char **argv) {
  if (argc != 2)
    return 2;
  const std::string_view op = argv[1];
  std::uint64_t count = 0, faults = 0;
  auto check = [&](std::int32_t a, std::int32_t b) {
    const std::int64_t x = a, y = b;
    bool bad = false;
    std::int64_t expected = 0;
    if (op == "add")
      expected = x + y;
    else if (op == "sub")
      expected = x - y;
    else if (op == "mul")
      expected = x * y;
    else if (op == "neg")
      expected = -x;
    else if (op == "div" || op == "rem") {
      bad = y == 0;
      if (!bad)
        expected = op == "div" ? x / y : x % y;
    } else
      return false;
    bad |= expected < INT32_MIN || expected > INT32_MAX;
    kalandra::runtime::Invocation context;
    const auto result = _mlir_ciface_kalandra_test_entry(a, b, &context);
    ++count;
    if (bad)
      ++faults;
    if (context.live() || context.hasTaskError() || context.status() != (bad ? 4 : 0) ||
        (!bad && result != expected) || (bad && (context.line() != 2 || context.column() == 0))) {
      std::cerr << op << '(' << a << ',' << b << ") result=" << result << " expected=" << expected
                << " status=" << context.status() << '\n';
      return false;
    }
    return true;
  };
  const std::array<std::int32_t, 19> edges{INT32_MIN,   INT32_MIN + 1,
                                           -1073741824, -65536,
                                           -46341,      -46340,
                                           -3,          -2,
                                           -1,          0,
                                           1,           2,
                                           3,           46340,
                                           46341,       65536,
                                           1073741824,  INT32_MAX - 1,
                                           INT32_MAX};
  for (auto a : edges)
    for (auto b : edges)
      if (!check(a, b))
        return 1;
  std::uint32_t state = 0x12345678;
  auto next = [&] {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    return std::bit_cast<std::int32_t>(state);
  };
  for (int i = 0; i < 10000; ++i) {
    const auto a = next(), b = next();
    if (!check(a, b))
      return 1;
  }
  if (!faults)
    return 1;
  std::cout << op << ": " << count << " runtime inputs, " << faults << " checked faults\n";
}
