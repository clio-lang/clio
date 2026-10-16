#pragma once
#include <array>
#include <cstdint>
#include <limits>
#include <optional>
#include <string_view>

namespace kalandra {
// Concrete core types, independent of aliases, host C++ types and target ABI.
// This internal identity is not a serialized contract/versioned ABI identifier.
enum class NumericType {
  Int8,
  Int16,
  Int32,
  Int64,
  UInt8,
  UInt16,
  UInt32,
  UInt64,
  Float32,
  Float64
};
enum class NumericFamily { SignedInteger, UnsignedInteger, BinaryFloat };
struct NumericDescription {
  NumericType type;
  std::string_view name;
  NumericFamily family;
  unsigned bits;
  constexpr unsigned bytes() const { return bits / 8; }
};
inline constexpr std::array numericTypes{
    NumericDescription{NumericType::Int8, "int8", NumericFamily::SignedInteger, 8},
    NumericDescription{NumericType::Int16, "int16", NumericFamily::SignedInteger, 16},
    NumericDescription{NumericType::Int32, "int32", NumericFamily::SignedInteger, 32},
    NumericDescription{NumericType::Int64, "int64", NumericFamily::SignedInteger, 64},
    NumericDescription{NumericType::UInt8, "uint8", NumericFamily::UnsignedInteger, 8},
    NumericDescription{NumericType::UInt16, "uint16", NumericFamily::UnsignedInteger, 16},
    NumericDescription{NumericType::UInt32, "uint32", NumericFamily::UnsignedInteger, 32},
    NumericDescription{NumericType::UInt64, "uint64", NumericFamily::UnsignedInteger, 64},
    NumericDescription{NumericType::Float32, "float32", NumericFamily::BinaryFloat, 32},
    NumericDescription{NumericType::Float64, "float64", NumericFamily::BinaryFloat, 64}};
constexpr std::optional<NumericDescription> describeNumeric(NumericType type) {
  for (auto description : numericTypes)
    if (description.type == type)
      return description;
  return {};
}
constexpr std::optional<NumericType> resolveNumeric(std::string_view name) {
  if (name == "int")
    return NumericType::Int64;
  if (name == "uint")
    return NumericType::UInt64;
  if (name == "float")
    return NumericType::Float64;
  for (auto description : numericTypes)
    if (description.name == name)
      return description.type;
  return {};
}
// Type-level availability is necessary but does not promise every operation,
// rank or device capability. Those checks remain with the corresponding backend.
enum class NumericTarget { Cpu, AppleGpu };
constexpr bool numericArithmeticAvailable(NumericType type, NumericTarget target) {
  switch (target) {
  case NumericTarget::Cpu:
    return type == NumericType::Float32 || type == NumericType::Int32;
  case NumericTarget::AppleGpu:
    return type == NumericType::Float32;
  }
  return false;
}
constexpr std::optional<std::uint64_t>
checkedNumericBytes(NumericType type, std::uint64_t count,
                    std::uint64_t limit = std::numeric_limits<std::uint64_t>::max()) {
  auto description = describeNumeric(type);
  if (!description || count > limit / description->bytes())
    return {};
  return count * description->bytes();
}
} // namespace kalandra
