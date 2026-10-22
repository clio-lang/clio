#pragma once
#include "RecordPhysicalLayout.h"
#include <unordered_set>

namespace kalandra {
inline bool hasRecursiveStorage(const RecordStoragePlan &storage) {
  return std::ranges::find(storage.recursive, true) != storage.recursive.end();
}
// Recursive execution remains synchronous; owned payloads need qualified dependency enumeration.
inline std::optional<Diagnostic> recursiveRecordLayoutError(const TypedModule &module,
                                                            const SemanticLimits &limits = {}) {
  auto storage = planRecordStorage(module);
  if (!storage)
    return storage.error();
  if (!hasRecursiveStorage(*storage))
    return recordLayoutError(module, limits);
  if (auto invalid = recordFieldError(module))
    return invalid;
  for (std::size_t id = 0; id < module.records.size(); ++id) {
    const auto &record = module.records[id];
    if (!storage->constructible[id]) {
      auto site = record.declaration;
      for (const auto &field : record.fields)
        if (field.type.record && !storage->constructible[*field.type.record]) {
          site = field.declaration;
          break;
        }
      return Diagnostic{
          "S068", "recursive type cycle has no finite construction: '" + record.name + "'", site};
    }
    if (record.error)
      return Diagnostic{
          "S068", "recursive programs do not yet support application-error payloads or channels",
          record.declaration};
    for (const auto &field : record.fields)
      if ((field.type.tensor && field.type.builtin != BuiltinValue::Numeric &&
           !isBoolArray(field.type) && !isStringArray(field.type) && !isRecordArray(field.type)) ||
          (field.type.builtin != BuiltinValue::Numeric &&
           field.type.builtin != BuiltinValue::Bool && field.type.builtin != BuiltinValue::String &&
           field.type.builtin != BuiltinValue::Record))
        return Diagnostic{"S068",
                          "recursive programs require numeric/Bool/String scalars, numeric "
                          "collections, Bool/String/record arrays "
                          "or direct nominal links; other owned payloads remain unsupported",
                          field.declaration};
  }
  auto physical = planRecordPhysicalLayout(module, limits);
  return physical ? std::optional<Diagnostic>{} : std::optional<Diagnostic>{physical.error()};
}
inline std::optional<std::string> recursiveProgramError(const TypedModule &module) {
  auto storage = planRecordStorage(module);
  if (!storage)
    return storage.error().message;
  if (!hasRecursiveStorage(*storage))
    return {};
  if (auto invalid = recursiveRecordLayoutError(module))
    return invalid->message;
  const auto supported = [](const ValueType &type) {
    return !type.task && !type.fallible && !type.errorRecord && !type.device &&
           type.builtin != BuiltinValue::Function && type.builtin != BuiltinValue::TaskError &&
           type.builtin != BuiltinValue::FaultKind && type.builtin != BuiltinValue::Device;
  };
  for (const auto &symbol : module.symbols)
    if (!supported(symbol.type))
      return "recursive programs currently require synchronous values without callable storage";
  for (const auto &function : module.functions)
    if (!supported(function.resultType) ||
        (function.declaredResult && !supported(*function.declaredResult)))
      return "recursive programs currently require ordinary synchronous function signatures";
  for (const auto &expression : module.expressions) {
    if (!supported(expression.type))
      return "recursive programs currently require synchronous values without callable storage";
    if (std::holds_alternative<TaskOperation>(expression.operation) ||
        std::holds_alternative<ParallelOperation>(expression.operation) ||
        std::holds_alternative<CatchOperation>(expression.operation) ||
        std::holds_alternative<FailOperation>(expression.operation) ||
        std::holds_alternative<GuardOperation>(expression.operation) ||
        std::holds_alternative<ErrorNarrow>(expression.operation) ||
        std::holds_alternative<ErrorFieldRead>(expression.operation) ||
        std::holds_alternative<FunctionReference>(expression.operation) ||
        std::holds_alternative<FunctionInvoke>(expression.operation))
      return "recursive programs currently require synchronous direct calls; workers, error "
             "control and callable values remain unsupported";
    if (const auto *match = std::get_if<MatchOperation>(&expression.operation)) {
      if (match->subject >= module.expressions.size() || match->cases.empty())
        return "invalid recursive match subject/cases";
      const auto &subject = module.expressions[match->subject].type;
      if (subject.builtin != BuiltinValue::Record || !subject.record ||
          *subject.record >= module.records.size() || subject.tensor || subject.task ||
          subject.fallible)
        return "recursive matches require completed ordinary enum subjects";
      const auto count = module.records[*subject.record].variants.size();
      if (!count || match->cases.size() > count)
        return "invalid recursive match case count";
      std::unordered_set<unsigned> seen;
      bool fallback = false;
      for (std::size_t index = 0; index < match->cases.size(); ++index) {
        const auto &arm = match->cases[index];
        if (arm.result >= module.expressions.size())
          return "invalid recursive match result";
        if (arm.tag) {
          if (!*arm.tag || *arm.tag > count || !seen.insert(*arm.tag).second || fallback)
            return "invalid recursive match tag";
        } else {
          if (fallback || index + 1 != match->cases.size())
            return "invalid recursive match fallback";
          fallback = true;
        }
        for (const auto &statement : arm.body)
          if (statement.value >= module.expressions.size() ||
              (statement.binding && *statement.binding >= module.symbols.size()))
            return "invalid recursive match statement";
      }
      if (!fallback && seen.size() != count)
        return "non-exhaustive recursive match";
    }
  }
  return {};
}
} // namespace kalandra
