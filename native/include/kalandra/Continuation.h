#pragma once
#include "kalandra/Semantics.h"
#include <expected>
#include <map>
#include <memory>

namespace kalandra::continuation {
using Slot = std::size_t;
enum class Code {
  Literal,
  Unary,
  Binary,
  Kernel,
  Copy,
  Open,
  Spawn,
  Await,
  Try,
  Join,
  Label,
  Return,
  Catch,
  Case,
  Jump,
  Field,
  Fail,
  Call,
  Device,
  Transfer
};
struct Instruction {
  Code code;
  Slot output = 0;
  std::vector<Slot> args;
  std::size_t target = 0, group = 0, jump = 0;
  ValueId source = 0;
  std::optional<Slot> placement = {};
};
struct Plan {
  std::vector<ValueType> slots;
  std::vector<Slot> parameters;
  std::vector<Instruction> code;
  std::size_t groups = 0;
  Slot result = 0;
};
struct Options {
  // Keep synchronous calls as backend dispatches instead of inlining CPU bodies.
  bool preserveCalls = false;
  // Plan a selected entry; other function IDs retain their original positions.
  std::optional<FunctionId> entry = {};
};
struct ModulePlan {
  // The source typed module must outlive its plan and target emission.
  const TypedModule &input;
  TypedModule kernels;
  std::vector<std::unique_ptr<Plan>> plans;
  std::map<ValueId, FunctionId> kernelIds;
  explicit ModulePlan(const TypedModule &input) : input(input) {}
};
[[nodiscard]] std::expected<ModulePlan, std::string> plan(const TypedModule &input,
                                                          Options options = {});
[[nodiscard]] std::string dump(const ModulePlan &module);
} // namespace kalandra::continuation
