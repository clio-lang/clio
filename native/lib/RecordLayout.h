#pragma once
#include "kalandra/Semantics.h"
#include <algorithm>

namespace kalandra {
inline bool hasRecordCollections(const TypedModule &module) {
  for (const auto &record : module.records)
    for (const auto &field : record.fields)
      if (field.type.tensor)
        return true;
  return false;
}
// Inline records must have a finite layout. Bound depth and expanded storage
// units before recursive target type construction or textual IR printing.
inline std::optional<Diagnostic> recordLayoutError(const TypedModule &module,
                                                   const SemanticLimits &limits = {}) {
  const auto fail = [](std::string message, SourceSpan span) {
    return std::optional<Diagnostic>{{"S068", std::move(message), span}};
  };
  for (const auto &record : module.records) {
    if (record.fields.empty())
      return fail("record declarations require fields", record.declaration);
    for (const auto &field : record.fields) {
      const auto &type = field.type;
      if (type.task || type.fallible || type.device ||
          (type.tensor ? (type.builtin != BuiltinValue::Numeric || type.shape.size() > 128 ||
                          (type.array && type.shape.size() != 1))
                       : (type.array || !type.shape.empty())))
        return fail(
            "record fields require completed CPU numbers, numeric collections, Bool or records",
            field.declaration);
      if (type.builtin == BuiltinValue::Record) {
        if (!type.record || *type.record >= module.records.size())
          return fail("invalid nested record declaration identity", field.declaration);
      } else if (type.record || (type.builtin != BuiltinValue::Bool &&
                                 (type.builtin != BuiltinValue::Numeric ||
                                  !numericArithmeticAvailable(type.element, NumericTarget::Cpu))))
        return fail("record fields require CPU numbers, numeric collections, Bool or records",
                    field.declaration);
    }
  }
  struct Frame {
    std::size_t record, next = 0;
  };
  std::vector<unsigned> state(module.records.size());
  std::vector<std::size_t> heights(module.records.size(), 1), leaves(module.records.size());
  for (std::size_t root = 0; root < module.records.size(); ++root) {
    if (state[root] == 2)
      continue;
    std::vector<Frame> stack{{root}};
    state[root] = 1;
    while (!stack.empty()) {
      auto &frame = stack.back();
      const auto id = frame.record;
      const auto &record = module.records[id];
      if (frame.next == record.fields.size()) {
        if (heights[id] > limits.maxDepth)
          return fail("record layout exceeds configured nesting depth", record.declaration);
        state[id] = 2;
        stack.pop_back();
        continue;
      }
      const auto &field = record.fields[frame.next];
      std::size_t count = field.type.tensor ? 3 + 2 * field.type.shape.size() : 1;
      if (field.type.record) {
        const auto child = *field.type.record;
        if (state[child] == 1)
          return fail("record fields form an inline storage cycle", field.declaration);
        if (!state[child]) {
          // Also bound the explicit DFS stack before completing a long chain.
          if (stack.size() >= limits.maxDepth)
            return fail("record layout exceeds configured nesting depth", field.declaration);
          state[child] = 1;
          stack.push_back({child});
          continue;
        }
        heights[id] = std::max(heights[id], heights[child] + 1);
        count = leaves[child];
      }
      if (count > limits.maxValues - leaves[id])
        return fail("record layout exceeds configured expanded scalar-field budget",
                    field.declaration);
      leaves[id] += count;
      ++frame.next;
    }
  }
  return {};
}
} // namespace kalandra
