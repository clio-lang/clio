#include "kalandra/Continuation.h"
#include <algorithm>
#include <limits>

namespace kalandra {
bool sameFunctionValueType(const ValueType &a, const ValueType &b, std::size_t depth) {
  std::size_t remaining = 300000;
  const auto compare = [&](auto &&self, const ValueType &a, const ValueType &b,
                           std::size_t depth) -> bool {
    if (!remaining)
      return false;
    --remaining;
    if (depth >= 128 || a.builtin != b.builtin || a.tensor != b.tensor || a.array != b.array ||
        a.task != b.task || a.fallible != b.fallible || a.device != b.device ||
        a.record != b.record || a.errorRecord != b.errorRecord ||
        a.shape.size() != b.shape.size() ||
        (a.builtin == BuiltinValue::Numeric && a.element != b.element))
      return false;
    for (std::size_t i = 0; i < a.shape.size(); ++i)
      if (a.shape[i].constant != b.shape[i].constant)
        return false;
    if (a.builtin != BuiltinValue::Function)
      return !a.callable && !b.callable;
    if (!a.callable || !b.callable ||
        a.callable->parameters.size() != b.callable->parameters.size())
      return false;
    for (std::size_t i = 0; i < a.callable->parameters.size(); ++i)
      if (!self(self, a.callable->parameters[i], b.callable->parameters[i], depth + 1))
        return false;
    return self(self, a.callable->result, b.callable->result, depth + 1);
  };
  return compare(compare, a, b, depth);
}

std::optional<std::string> functionValueCapabilityError(const TypedModule &module,
                                                        NumericTarget target) {
  bool present = false;
  const bool placed = hasPlacement(module);
  std::size_t visited = 0;
  const auto valid = [&](auto &&self, const ValueType &type, std::size_t depth) -> bool {
    if (type.builtin != BuiltinValue::Function)
      return !type.callable;
    if (++visited > 300000 || depth >= 128)
      return false;
    present = true;
    if (target != NumericTarget::Cpu || placed || !type.callable || type.tensor || type.array ||
        type.task || type.fallible || type.device || type.record || type.errorRecord ||
        !type.shape.empty())
      return false;
    if (type.callable->parameters.size() > 300000 - visited)
      return false;
    visited += type.callable->parameters.size();
    const auto plain = [&](const ValueType &value) {
      const bool collection =
          value.tensor ? (value.shape.size() <= 128 &&
                          std::ranges::all_of(
                              value.shape,
                              [](const auto &extent) {
                                return !extent.constant ||
                                       *extent.constant <=
                                           std::uint64_t(std::numeric_limits<std::int64_t>::max());
                              }) &&
                          (!value.array || (value.shape.size() == 1 && !value.shape[0].constant)) &&
                          (value.builtin == BuiltinValue::Numeric || isOwnedArray(value)))
                       : (!value.array && value.shape.empty());
      return collection && !value.task && !value.fallible && !value.device && !value.errorRecord &&
             (value.builtin == BuiltinValue::Numeric || value.builtin == BuiltinValue::Bool ||
              value.builtin == BuiltinValue::String || value.builtin == BuiltinValue::Record ||
              value.builtin == BuiltinValue::TaskError ||
              value.builtin == BuiltinValue::FaultKind ||
              value.builtin == BuiltinValue::Function) &&
             (value.builtin == BuiltinValue::Record
                  ? value.record && *value.record < module.records.size()
                  : !value.record) &&
             (value.builtin != BuiltinValue::Numeric ||
              numericScalarArithmeticAvailable(value.element, NumericTarget::Cpu)) &&
             self(self, value, depth + 1);
    };
    return plain(type.callable->result) && std::ranges::all_of(type.callable->parameters, plain);
  };
  for (const auto &symbol : module.symbols)
    if (!valid(valid, symbol.type, 0))
      return "invalid or unsupported function-value type";
  for (const auto &fn : module.functions) {
    if (!valid(valid, fn.resultType, 0) ||
        (fn.declaredResult && !valid(valid, *fn.declaredResult, 0)))
      return "invalid or unsupported function-value result";
  }
  for (const auto &expression : module.expressions) {
    present |= std::holds_alternative<FunctionReference>(expression.operation) ||
               std::holds_alternative<FunctionInvoke>(expression.operation);
    if (!valid(valid, expression.type, 0))
      return "invalid or unsupported function-value type";
  }
  if (!present)
    return {};
  for (const auto &fn : module.functions) {
    if (fn.result >= module.expressions.size())
      return "function has an invalid result";
    if (fn.resultType.builtin == BuiltinValue::Function &&
        (!sameFunctionValueType(fn.resultType, module.expressions[fn.result].type) ||
         (fn.declaredResult && !sameFunctionValueType(fn.resultType, *fn.declaredResult))))
      return "function changes its returned callable signature";
  }
  for (ValueId id = 0; id < module.expressions.size(); ++id) {
    const auto &expression = module.expressions[id];
    if (expression.type.builtin == BuiltinValue::Function) {
      if (const auto *read = std::get_if<SymbolRead>(&expression.operation)) {
        if (read->symbol >= module.symbols.size() ||
            !sameFunctionValueType(expression.type, module.symbols[read->symbol].type))
          return "function read changes its binding signature";
      } else if (const auto *choice = std::get_if<ConditionalOperation>(&expression.operation)) {
        if (choice->trueResult >= id || choice->falseResult >= id ||
            !sameFunctionValueType(expression.type, module.expressions[choice->trueResult].type) ||
            !sameFunctionValueType(expression.type, module.expressions[choice->falseResult].type))
          return "conditional changes a function-value signature";
      } else if (!std::holds_alternative<FunctionReference>(expression.operation) &&
                 !std::holds_alternative<FunctionInvoke>(expression.operation) &&
                 !std::holds_alternative<FunctionCall>(expression.operation))
        return "unsupported function-value producer";
    }
    if (const auto *ref = std::get_if<FunctionReference>(&expression.operation)) {
      if (ref->function >= module.functions.size() || !expression.type.callable)
        return "function reference has an invalid target or signature";
      const auto &fn = module.functions[ref->function];
      auto result = fn.declaredResult.value_or(fn.resultType);
      // An inferred array length is not a promise in its callable signature.
      if (result.array && result.shape.size() == 1 && expression.type.callable->result.array &&
          expression.type.callable->result.shape.size() == 1)
        result.shape[0] = expression.type.callable->result.shape[0];
      if (fn.parameters.size() != expression.type.callable->parameters.size() ||
          !sameFunctionValueType(result, expression.type.callable->result))
        return "function reference changes the target signature";
      for (std::size_t i = 0; i < fn.parameters.size(); ++i)
        if (fn.parameters[i] >= module.symbols.size() ||
            !sameFunctionValueType(module.symbols[fn.parameters[i]].type,
                                   expression.type.callable->parameters[i]))
          return "function reference changes a target parameter";
    }
    if (const auto *call = std::get_if<FunctionInvoke>(&expression.operation)) {
      if (call->callee >= id)
        return "function-value call has an invalid callee";
      const auto &callee = module.expressions[call->callee].type;
      if (callee.builtin != BuiltinValue::Function || !callee.callable ||
          callee.callable->parameters.size() != call->arguments.size() ||
          !sameFunctionValueType(expression.type, callee.callable->result))
        return "function-value call changes its signature";
      for (std::size_t i = 0; i < call->arguments.size(); ++i)
        if (call->arguments[i] >= id || !([&] {
              auto actual = module.expressions[call->arguments[i]].type;
              const auto &formal = callee.callable->parameters[i];
              if (actual.shape.size() != formal.shape.size())
                return false;
              // Dynamic formal extents accept concrete sizes. Fixed formal
              // extents must already have been checked by semantic conformance.
              for (std::size_t axis = 0; axis < formal.shape.size(); ++axis)
                if (!formal.shape[axis].constant)
                  actual.shape[axis] = formal.shape[axis];
              return sameFunctionValueType(actual, formal);
            })())
          return "function-value call changes an argument type";
    }
    if (const auto *call = std::get_if<FunctionCall>(&expression.operation)) {
      if (call->function >= module.functions.size())
        return "call has an invalid function target";
      const auto &fn = module.functions[call->function];
      if (fn.parameters.size() != call->arguments.size())
        return "call has an invalid argument count";
      if (expression.type.builtin == BuiltinValue::Function &&
          !sameFunctionValueType(expression.type, fn.declaredResult.value_or(fn.resultType)))
        return "call changes a returned function signature";
      for (std::size_t i = 0; i < call->arguments.size(); ++i) {
        if (fn.parameters[i] >= module.symbols.size() || call->arguments[i] >= id)
          return "call has an invalid argument";
        const auto &actual = module.expressions[call->arguments[i]].type;
        const auto &formal = module.symbols[fn.parameters[i]].type;
        if ((actual.builtin == BuiltinValue::Function ||
             formal.builtin == BuiltinValue::Function) &&
            !sameFunctionValueType(actual, formal))
          return "call changes a function parameter signature";
      }
    }
    if (const auto *map = std::get_if<ArrayMap>(&expression.operation))
      if (map->function >= module.functions.size())
        return "map has an invalid function target";
    if (const auto *task = std::get_if<TaskOperation>(&expression.operation);
        task && task->prefix == TaskPrefix::Spawn) {
      if (task->operand >= module.expressions.size())
        return "spawn has an invalid operand";
      const auto &invocation = module.expressions[task->operand];
      std::vector<ValueId> arguments;
      if (const auto *call = std::get_if<FunctionCall>(&invocation.operation))
        arguments = call->arguments;
      else if (const auto *map = std::get_if<ArrayMap>(&invocation.operation))
        arguments = map->captures;
      else if (std::holds_alternative<FunctionInvoke>(invocation.operation))
        return "indirect spawn is not implemented yet";
      if (invocation.type.builtin == BuiltinValue::Function)
        return "function-valued worker results are not implemented yet";
      for (auto argument : arguments)
        if (argument >= module.expressions.size() ||
            module.expressions[argument].type.builtin == BuiltinValue::Function)
          return "function-valued worker captures are not implemented yet";
    }
  }
  const auto resumable = continuation::resumableFunctions(module);
  for (const auto &expression : module.expressions)
    if (const auto *ref = std::get_if<FunctionReference>(&expression.operation))
      if (resumable[ref->function])
        return "function values require transitively synchronous targets; task coordination "
               "and fallible targets are not implemented yet";
  return {};
}
} // namespace kalandra
