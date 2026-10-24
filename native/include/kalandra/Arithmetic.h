#pragma once
#include <optional>
#include <string_view>
namespace kalandra {
enum class ArithmeticMode { Hardware, Software, HardwareWithSoftwareFallback };
inline std::optional<ArithmeticMode> parseArithmeticMode(std::string_view value) {
  if (value == "hardware")
    return ArithmeticMode::Hardware;
  if (value == "software")
    return ArithmeticMode::Software;
  if (value == "hardware-with-software-fallback")
    return ArithmeticMode::HardwareWithSoftwareFallback;
  return {};
}
inline std::string_view arithmeticModeName(ArithmeticMode mode) {
  switch (mode) {
  case ArithmeticMode::Hardware:
    return "hardware";
  case ArithmeticMode::Software:
    return "software";
  case ArithmeticMode::HardwareWithSoftwareFallback:
    return "hardware-with-software-fallback";
  }
  return "invalid";
}
} // namespace kalandra
