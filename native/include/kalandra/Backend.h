#pragma once
#include "kalandra/Semantics.h"
#include <expected>
namespace kalandra {
struct BackendOutput {
  std::string mlir;
  std::string llvm;
};
// Nonempty exports emit checked C interfaces kalandra_cpu_0, ... without a CLI main.
// Exported functions must be synchronous; callers supply the invocation context.
[[nodiscard]] std::expected<BackendOutput, std::string>
lowerNative(const TypedModule &module, std::optional<std::string> testEntry = {},
            const std::vector<std::string> &exports = {});
} // namespace kalandra
