#pragma once
#include "kalandra/Semantics.h"
#include <expected>
namespace kalandra {
struct BackendOutput {
  std::string mlir;
  std::string llvm;
};
[[nodiscard]] std::expected<BackendOutput, std::string>
lowerNative(const TypedModule &module, std::optional<std::string> testEntry = {});
} // namespace kalandra
