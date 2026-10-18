#pragma once
#include "kalandra/Semantics.h"
#include <algorithm>
#include <functional>
#include <unordered_set>

namespace kalandra {
inline bool hasRecordBacking(const TypedModule &module) {
  for (const auto &expression : module.expressions)
    if (isOwnedArray(expression.type))
      return true;
  for (const auto &symbol : module.symbols)
    if (isOwnedArray(symbol.type))
      return true;
  for (const auto &record : module.records)
    for (const auto &field : record.fields)
      if (field.type.tensor || field.type.builtin == BuiltinValue::String)
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
    if (!record.variants.empty()) {
      const auto &tag = record.fields.front().type;
      if (tag.builtin != BuiltinValue::Numeric || tag.element != NumericType::Int64 || tag.tensor ||
          tag.array || tag.task || tag.fallible || tag.device)
        return fail("invalid enum discriminator layout", record.declaration);
      std::unordered_set<std::string> names;
      std::vector<bool> used(record.fields.size());
      used[0] = true;
      for (const auto &variant : record.variants) {
        if (variant.name.empty() || !names.insert(variant.name).second)
          return fail("invalid or duplicate enum variant identity", variant.declaration);
        for (auto slot : variant.fields) {
          if (!slot || slot >= used.size() || used[slot])
            return fail("invalid enum payload field layout", variant.declaration);
          used[slot] = true;
          const auto &t = record.fields[slot].type;
          if (t.tensor || t.array ||
              (t.builtin != BuiltinValue::Numeric && t.builtin != BuiltinValue::Bool &&
               t.builtin != BuiltinValue::String))
            return fail("unsupported enum payload layout", variant.declaration);
        }
      }
      if (std::ranges::find(used, false) != used.end())
        return fail("enum layout has an unassigned payload slot", record.declaration);
    }
    for (const auto &field : record.fields) {
      const auto &type = field.type;
      if (type.task || type.fallible || type.device ||
          (type.tensor ? ((type.builtin != BuiltinValue::Numeric && !isBoolArray(type) &&
                           !isStringArray(type)) ||
                          type.shape.size() > 128 || (type.array && type.shape.size() != 1))
                       : (type.array || !type.shape.empty())))
        return fail("record fields require completed CPU numbers, numeric collections, Bool, Bool "
                    "arrays, Strings, String arrays or records",
                    field.declaration);
      if (type.builtin == BuiltinValue::Record) {
        if (!type.record || *type.record >= module.records.size())
          return fail("invalid nested record declaration identity", field.declaration);
      } else if (type.record ||
                 (type.builtin != BuiltinValue::Bool && type.builtin != BuiltinValue::String &&
                  (type.builtin != BuiltinValue::Numeric ||
                   !(type.array
                         ? numericCollectionStorageAvailable(type.element, NumericTarget::Cpu)
                     : type.tensor
                         ? numericTensorElementwiseAvailable(type.element, NumericTarget::Cpu)
                         : numericScalarArithmeticAvailable(type.element, NumericTarget::Cpu)))))
        return fail("record fields require CPU numbers, numeric collections, Bool, Bool arrays, "
                    "Strings, String arrays or records",
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
      std::size_t count = field.type.tensor ? 3 + 2 * field.type.shape.size()
                          : field.type.builtin == BuiltinValue::String ? 3
                                                                       : 1;
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
// Called only after finite-layout validation; memoize shared child declarations.
inline std::size_t recordInlineUnits(const TypedModule &module, std::size_t root) {
  std::vector<std::optional<std::size_t>> cache(module.records.size());
  std::function<std::size_t(std::size_t)> count = [&](std::size_t id) {
    if (cache[id])
      return *cache[id];
    std::size_t total = 0;
    for (const auto &field : module.records[id].fields)
      total += field.type.record                            ? count(*field.type.record)
               : field.type.tensor                          ? 3 + 2 * field.type.shape.size()
               : field.type.builtin == BuiltinValue::String ? 3
                                                            : 1;
    cache[id] = total;
    return total;
  };
  return count(root);
}
} // namespace kalandra
