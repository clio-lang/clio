#include "kalandra/Continuation.h"
#include <algorithm>
#include <limits>
#include <unordered_map>
#include <unordered_set>

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

bool workerClosureCaptureTypeSupported(const TypedModule &module, const ValueType &root) {
  std::vector<ValueType> pending{root};
  std::unordered_set<std::size_t> visited;
  while (!pending.empty()) {
    const auto value = pending.back();
    pending.pop_back();
    if (value.task || value.fallible || value.device || value.errorRecord ||
        (value.builtin != BuiltinValue::Numeric && value.builtin != BuiltinValue::Bool &&
         value.builtin != BuiltinValue::String && value.builtin != BuiltinValue::Record &&
         value.builtin != BuiltinValue::Function))
      return false;
    if (value.builtin == BuiltinValue::Function &&
        (!value.callable || (value.tensor && !isFunctionArray(value))))
      return false;
    if (value.builtin == BuiltinValue::Record) {
      if (!value.record || *value.record >= module.records.size())
        return false;
      if (visited.insert(*value.record).second)
        for (const auto &field : module.records[*value.record].fields)
          pending.push_back(field.type);
    }
  }
  return true;
}
bool containsFunctionStorage(const TypedModule &module, const ValueType &type) {
  std::vector<const ValueType *> pending{&type};
  std::unordered_set<std::size_t> visited;
  while (!pending.empty()) {
    const auto &value = *pending.back();
    pending.pop_back();
    if (value.builtin == BuiltinValue::Function)
      return true;
    for (auto record : {value.record, value.errorRecord})
      if (record && *record < module.records.size() && visited.insert(*record).second)
        for (const auto &field : module.records[*record].fields)
          pending.push_back(&field.type);
  }
  return false;
}
namespace {
// Whole-module, conservative provenance. Every direct caller contributes to a
// parameter, so one unsafe source cannot be hidden by another safe call site.
// Lifted capture parameters come from their closure construction sites. Explicit
// parameters of functions used as values remain staged: those can also be fed by
// indirect calls and map callbacks, outside this direct-call source graph.
bool workerValueProvenance(const TypedModule &module, ValueId root) {
  std::unordered_map<SymbolId, ValueId> bindings;
  const auto statements = [&](const auto &body) {
    for (const auto &statement : body)
      if (statement.binding)
        bindings.emplace(*statement.binding, statement.value);
  };
  for (const auto &fn : module.functions)
    statements(fn.body);
  for (const auto &expression : module.expressions)
    std::visit(
        [&](const auto &op) {
          if constexpr (requires { op.body; })
            statements(op.body);
          else if constexpr (std::is_same_v<std::decay_t<decltype(op)>, ConditionalOperation>) {
            statements(op.whenTrue);
            statements(op.whenFalse);
          } else if constexpr (std::is_same_v<std::decay_t<decltype(op)>, MatchOperation>)
            for (const auto &arm : op.cases)
              statements(arm.body);
        },
        expression.operation);
  std::unordered_map<SymbolId, std::vector<ValueId>> parameterSources;
  std::unordered_set<SymbolId> indirectParameters;
  for (const auto &expression : module.expressions) {
    if (const auto *call = std::get_if<FunctionCall>(&expression.operation)) {
      if (call->function >= module.functions.size())
        return false;
      const auto &fn = module.functions[call->function];
      if (call->arguments.size() != fn.parameters.size())
        return false;
      for (std::size_t i = 0; i < fn.parameters.size(); ++i)
        parameterSources[fn.parameters[i]].push_back(call->arguments[i]);
    } else if (const auto *map = std::get_if<ArrayMap>(&expression.operation)) {
      // Named map callbacks do not necessarily have a FunctionReference node.
      // Do not mistake their element/capture parameters for direct-call-only ones.
      if (map->function >= module.functions.size())
        return false;
      for (auto parameter : module.functions[map->function].parameters)
        indirectParameters.insert(parameter);
    } else if (const auto *ref = std::get_if<FunctionReference>(&expression.operation)) {
      if (ref->function >= module.functions.size())
        return false;
      const auto &fn = module.functions[ref->function];
      if (fn.captureCount > fn.parameters.size() || ref->captures.size() != fn.captureCount)
        return false;
      const auto explicitCount = fn.parameters.size() - fn.captureCount;
      for (std::size_t i = 0; i < explicitCount; ++i)
        indirectParameters.insert(fn.parameters[i]);
      for (std::size_t i = 0; i < fn.captureCount; ++i)
        parameterSources[fn.parameters[explicitCount + i]].push_back(ref->captures[i]);
    }
  }
  std::vector<ValueId> pending{root};
  std::unordered_set<ValueId> visited;
  std::size_t budget = 300000;
  bool found = false;
  while (!pending.empty()) {
    if (!budget--)
      return false;
    const auto id = pending.back();
    pending.pop_back();
    if (id >= module.expressions.size())
      return false;
    if (!visited.insert(id).second)
      continue;
    const auto &value = module.expressions[id];
    if (value.type.device)
      return false;
    if (!containsFunctionStorage(module, value.type))
      continue;
    if (const auto *ref = std::get_if<FunctionReference>(&value.operation)) {
      if (ref->function >= module.functions.size())
        return false;
      const auto &fn = module.functions[ref->function];
      if (ref->captures.size() != fn.captureCount)
        return false;
      for (auto capture : ref->captures) {
        if (capture >= module.expressions.size() ||
            !workerClosureCaptureTypeSupported(module, module.expressions[capture].type))
          return false;
        if (containsFunctionStorage(module, module.expressions[capture].type))
          pending.push_back(capture);
      }
      found = true;
    } else if (const auto *record = std::get_if<RecordValue>(&value.operation)) {
      if (record->base)
        pending.push_back(*record->base);
      for (const auto &field : record->fields)
        pending.push_back(field.value);
      found = true;
    } else if (const auto *array = std::get_if<TensorLiteral>(&value.operation)) {
      for (auto element : array->elements)
        pending.push_back(element);
      found = true;
    } else if (const auto *field = std::get_if<RecordFieldRead>(&value.operation)) {
      pending.push_back(field->input);
    } else if (const auto *index = std::get_if<ArrayIndex>(&value.operation)) {
      pending.push_back(index->input);
    } else if (const auto *slice = std::get_if<ArraySlice>(&value.operation)) {
      pending.push_back(slice->input);
    } else if (const auto *concat = std::get_if<ArrayConcat>(&value.operation)) {
      pending.push_back(concat->left);
      pending.push_back(concat->right);
    } else if (const auto *shape = std::get_if<ShapeCheck>(&value.operation)) {
      pending.push_back(shape->input);
    } else if (const auto *call = std::get_if<FunctionCall>(&value.operation)) {
      if (call->function >= module.functions.size())
        return false;
      pending.push_back(module.functions[call->function].result);
    } else if (const auto *task = std::get_if<TaskOperation>(&value.operation)) {
      if (task->operand >= id)
        return false;
      pending.push_back(task->operand);
    } else if (const auto *group = std::get_if<ParallelOperation>(&value.operation)) {
      if (group->result >= id)
        return false;
      pending.push_back(group->result);
    } else if (const auto *caught = std::get_if<CatchOperation>(&value.operation)) {
      if (caught->operand >= id || caught->result >= id)
        return false;
      pending.push_back(caught->operand);
      pending.push_back(caught->result);
    } else if (std::holds_alternative<FailOperation>(value.operation) && value.type.fallible) {
      // An expected-error path publishes no function payload.
      found = true;
    } else if (const auto *read = std::get_if<SymbolRead>(&value.operation)) {
      const auto binding = bindings.find(read->symbol);
      if (read->symbol >= module.symbols.size())
        return false;
      if (module.symbols[read->symbol].parameter) {
        const auto sources = parameterSources.find(read->symbol);
        if (indirectParameters.contains(read->symbol) || sources == parameterSources.end() ||
            sources->second.empty())
          return false;
        pending.insert(pending.end(), sources->second.begin(), sources->second.end());
      } else {
        if (binding == bindings.end() || binding->second >= id)
          return false;
        pending.push_back(binding->second);
      }
    } else if (const auto *choice = std::get_if<ConditionalOperation>(&value.operation)) {
      if (choice->trueResult >= id || choice->falseResult >= id)
        return false;
      pending.push_back(choice->trueResult);
      pending.push_back(choice->falseResult);
    } else if (const auto *match = std::get_if<MatchOperation>(&value.operation)) {
      if (match->cases.empty())
        return false;
      for (const auto &arm : match->cases) {
        if (arm.result >= id)
          return false;
        pending.push_back(arm.result);
      }
    } else
      return false;
  }
  return found;
}
} // namespace
std::optional<std::string> functionValueTransportError(const TypedModule &module,
                                                       const TypedExpr &invocation) {
  if (invocation.type.errorRecord) {
    ValueType error;
    error.builtin = BuiltinValue::Record;
    error.record = invocation.type.errorRecord;
    if (containsFunctionStorage(module, error))
      return "function-containing worker error payloads are not implemented yet";
  }
  if (containsFunctionStorage(module, invocation.type)) {
    const auto *call = std::get_if<FunctionCall>(&invocation.operation);
    if (!call || call->function >= module.functions.size() ||
        !workerValueProvenance(module, module.functions[call->function].result))
      return "function-valued worker results require proven CPU closure captures; "
             "unproven result provenance is not implemented yet";
  }
  const auto arguments = std::visit(
      [](const auto &op) -> std::vector<ValueId> {
        using T = std::decay_t<decltype(op)>;
        if constexpr (std::is_same_v<T, FunctionCall> || std::is_same_v<T, FunctionInvoke>)
          return op.arguments;
        else if constexpr (std::is_same_v<T, ArrayMap>) {
          auto args = op.captures;
          args.push_back(op.input);
          return args;
        } else if constexpr (requires { op.input; })
          return {op.input};
        else if constexpr (requires {
                             op.left;
                             op.right;
                           })
          return {op.left, op.right};
        else
          return {};
      },
      invocation.operation);
  if (std::holds_alternative<FunctionInvoke>(invocation.operation))
    return "indirect spawn is not implemented yet";
  for (auto id : arguments) {
    if (id >= module.expressions.size())
      return "worker argument has invalid provenance";
    const auto &type = module.expressions[id].type;
    if (!containsFunctionStorage(module, type))
      continue;
    if (std::holds_alternative<FunctionCall>(invocation.operation) && !type.task &&
        !type.fallible && workerValueProvenance(module, id))
      continue;
    return "function-valued worker arguments require proven CPU closure captures; unproven "
           "capture provenance is not implemented yet";
  }
  return {};
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
    const bool array = isFunctionArray(type);
    if (target != NumericTarget::Cpu || placed || !type.callable ||
        (array
             ? (!type.tensor || type.shape.size() != 1 ||
                (type.shape[0].constant && *type.shape[0].constant > std::uint64_t(INT64_MAX) / 16))
             : (type.tensor || !type.shape.empty())) ||
        type.device || type.record ||
        (type.errorRecord && (!type.fallible || *type.errorRecord >= module.records.size() ||
                              !module.records[*type.errorRecord].error)))
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
    auto result = type.callable->result;
    if (result.errorRecord && (!result.fallible || *result.errorRecord >= module.records.size() ||
                               !module.records[*result.errorRecord].error))
      return false;
    result.fallible = false;
    result.errorRecord.reset();
    return plain(result) && std::ranges::all_of(type.callable->parameters, plain);
  };
  for (const auto &record : module.records)
    for (const auto &field : record.fields)
      if (!valid(valid, field.type, 0))
        return "invalid or unsupported function-valued field type";
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
  // Array lengths are value facts; compare stored element signatures separately.
  const auto sameStorageType = [](ValueType a, ValueType b) {
    if (isFunctionArray(a) && isFunctionArray(b) && a.shape.size() == 1 && b.shape.size() == 1) {
      a.shape[0] = b.shape[0] = Extent{};
    }
    return sameFunctionValueType(a, b);
  };
  const auto completed = [](ValueType type) {
    type.fallible = false;
    type.errorRecord.reset();
    return type;
  };
  const auto bindings = [&](const std::vector<TypedStatement> &body) {
    for (const auto &statement : body) {
      if (statement.value >= module.expressions.size() ||
          (statement.binding && *statement.binding >= module.symbols.size()))
        return false;
      if (statement.binding) {
        const auto &symbol = module.symbols[*statement.binding].type;
        const auto &value = module.expressions[statement.value].type;
        if ((symbol.builtin == BuiltinValue::Function || value.builtin == BuiltinValue::Function) &&
            !sameStorageType(symbol, value))
          return false;
      }
    }
    return true;
  };
  for (const auto &fn : module.functions) {
    if (fn.captureCount > fn.parameters.size() || !bindings(fn.body) ||
        std::ranges::any_of(fn.expressions,
                            [&](auto id) { return id >= module.expressions.size(); }))
      return "function has invalid expression/binding metadata";
    if (fn.result >= module.expressions.size())
      return "function has an invalid result";
    if (fn.resultType.builtin == BuiltinValue::Function &&
        (!sameStorageType(completed(fn.resultType),
                          completed(module.expressions[fn.result].type)) ||
         (fn.declaredResult && !sameStorageType(fn.resultType, *fn.declaredResult))))
      return "function changes its returned callable signature";
  }
  for (ValueId id = 0; id < module.expressions.size(); ++id) {
    const auto &expression = module.expressions[id];
    if (const auto *choice = std::get_if<ConditionalOperation>(&expression.operation);
        choice && (!bindings(choice->whenTrue) || !bindings(choice->whenFalse)))
      return "conditional changes a function binding signature";
    if (const auto *caught = std::get_if<CatchOperation>(&expression.operation);
        caught && !bindings(caught->body))
      return "catch changes a function binding signature";
    if (const auto *match = std::get_if<MatchOperation>(&expression.operation))
      for (const auto &arm : match->cases)
        if (!bindings(arm.body))
          return "match changes a function binding signature";
    if (const auto *guard = std::get_if<GuardOperation>(&expression.operation);
        guard && !bindings(guard->body))
      return "guard changes a function binding signature";
    if (const auto *group = std::get_if<ParallelOperation>(&expression.operation);
        group && !bindings(group->body))
      return "parallel group changes a function binding signature";
    if (expression.type.builtin == BuiltinValue::Function) {
      if (const auto *read = std::get_if<SymbolRead>(&expression.operation)) {
        if (read->symbol >= module.symbols.size() ||
            !sameStorageType(expression.type, module.symbols[read->symbol].type))
          return "function read changes its binding signature";
      } else if (const auto *read = std::get_if<RecordFieldRead>(&expression.operation)) {
        if (read->input >= id)
          return "function field read requires a preceding aggregate";
        const auto &input = module.expressions[read->input].type;
        if (input.builtin != BuiltinValue::Record || !input.record ||
            *input.record >= module.records.size() || input.tensor || input.array || input.task ||
            input.fallible || input.device ||
            read->field >= module.records[*input.record].fields.size() ||
            !sameStorageType(expression.type,
                             module.records[*input.record].fields[read->field].type))
          return "function field read changes its declared signature";
      } else if (const auto *choice = std::get_if<ConditionalOperation>(&expression.operation)) {
        if (choice->trueResult >= id || choice->falseResult >= id ||
            !sameStorageType(completed(expression.type),
                             completed(module.expressions[choice->trueResult].type)) ||
            !sameStorageType(completed(expression.type),
                             completed(module.expressions[choice->falseResult].type)))
          return "conditional changes a function-value signature";
      } else if (const auto *group = std::get_if<ParallelOperation>(&expression.operation)) {
        if (group->result >= id ||
            !sameStorageType(completed(expression.type),
                             completed(module.expressions[group->result].type)))
          return "parallel group changes a returned function signature";
      } else if (const auto *caught = std::get_if<CatchOperation>(&expression.operation)) {
        if (caught->operand >= id || caught->result >= id ||
            !sameStorageType(completed(expression.type),
                             completed(module.expressions[caught->operand].type)) ||
            !sameStorageType(completed(expression.type),
                             completed(module.expressions[caught->result].type)))
          return "catch changes a returned function signature";
      } else if (const auto *match = std::get_if<MatchOperation>(&expression.operation)) {
        for (const auto &arm : match->cases)
          if (arm.result >= id || !sameStorageType(completed(expression.type),
                                                   completed(module.expressions[arm.result].type)))
            return "match changes a returned function signature";
      } else if (const auto *task = std::get_if<TaskOperation>(&expression.operation)) {
        if (task->operand >= id)
          return "task changes a returned function signature";
        const auto &input = module.expressions[task->operand].type;
        auto outputType = completed(expression.type), inputType = completed(input);
        outputType.task = inputType.task = false;
        const bool flags = task->prefix == TaskPrefix::Spawn ? expression.type.task && !input.task
                           : task->prefix == TaskPrefix::Await
                               ? !expression.type.task && input.task && expression.type.fallible
                               : !expression.type.task && !input.task && input.fallible;
        if (!flags || !sameStorageType(outputType, inputType))
          return "task changes a returned function signature";
      } else if (const auto *read = std::get_if<ArrayIndex>(&expression.operation)) {
        if (read->input >= id || expression.type.tensor ||
            !isFunctionArray(module.expressions[read->input].type) ||
            !sameStorageType(expression.type,
                             recordArrayElement(module.expressions[read->input].type)))
          return "array index changes its stored function signature";
      } else if (isFunctionArray(expression.type) &&
                 (std::holds_alternative<TensorLiteral>(expression.operation) ||
                  std::holds_alternative<ArrayMap>(expression.operation) ||
                  std::holds_alternative<ArrayConcat>(expression.operation) ||
                  std::holds_alternative<ArraySlice>(expression.operation) ||
                  std::holds_alternative<ShapeCheck>(expression.operation))) {
        // Element and descriptor invariants are checked by numericCapabilityError.
      } else if (!std::holds_alternative<FunctionReference>(expression.operation) &&
                 !std::holds_alternative<FunctionInvoke>(expression.operation) &&
                 !std::holds_alternative<FunctionCall>(expression.operation) &&
                 !std::holds_alternative<CatchOperation>(expression.operation) &&
                 !std::holds_alternative<MatchOperation>(expression.operation) &&
                 !(std::holds_alternative<FailOperation>(expression.operation) &&
                   expression.type.fallible) &&
                 !(std::get_if<TaskOperation>(&expression.operation) &&
                   std::get<TaskOperation>(expression.operation).prefix == TaskPrefix::Try))
        return "unsupported function-value producer";
    }
    if (const auto *ref = std::get_if<FunctionReference>(&expression.operation)) {
      if (ref->function >= module.functions.size() || !expression.type.callable ||
          expression.type.fallible || expression.type.task || expression.type.tensor ||
          expression.type.array)
        return "function reference has an invalid target or signature";
      const auto &fn = module.functions[ref->function];
      auto result = fn.declaredResult.value_or(fn.resultType);
      // An inferred array length is not a promise in its callable signature.
      if (result.array && result.shape.size() == 1 && expression.type.callable->result.array &&
          expression.type.callable->result.shape.size() == 1)
        result.shape[0] = expression.type.callable->result.shape[0];
      if (fn.captureCount > fn.parameters.size() || ref->captures.size() != fn.captureCount ||
          fn.parameters.size() - fn.captureCount != expression.type.callable->parameters.size() ||
          !sameStorageType(result, expression.type.callable->result))
        return "function reference changes the target signature";
      const auto explicitCount = fn.parameters.size() - fn.captureCount;
      for (std::size_t i = 0; i < fn.parameters.size(); ++i) {
        if (fn.parameters[i] >= module.symbols.size())
          return "function reference has invalid parameter metadata";
        if (i < explicitCount) {
          if (!sameStorageType(module.symbols[fn.parameters[i]].type,
                               expression.type.callable->parameters[i]))
            return "function reference changes a target parameter";
        } else {
          const auto capture = ref->captures[i - explicitCount];
          const auto &parameter = module.symbols[fn.parameters[i]].type;
          if (capture >= id || parameter.task || parameter.fallible || parameter.device ||
              parameter.builtin == BuiltinValue::Device ||
              !sameStorageType(parameter, module.expressions[capture].type))
            return "function reference changes a capture type or escapes a scoped value";
        }
      }
    }
    if (const auto *call = std::get_if<FunctionInvoke>(&expression.operation)) {
      if (call->callee >= id)
        return "function-value call has an invalid callee";
      const auto &callee = module.expressions[call->callee].type;
      if (callee.builtin != BuiltinValue::Function || !callee.callable || callee.tensor ||
          callee.array || callee.fallible || callee.task ||
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
              return sameStorageType(actual, formal);
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
          !sameStorageType(expression.type, fn.declaredResult.value_or(fn.resultType)))
        return "call changes a returned function signature";
      for (std::size_t i = 0; i < call->arguments.size(); ++i) {
        if (fn.parameters[i] >= module.symbols.size() || call->arguments[i] >= id)
          return "call has an invalid argument";
        const auto &actual = module.expressions[call->arguments[i]].type;
        const auto &formal = module.symbols[fn.parameters[i]].type;
        if ((actual.builtin == BuiltinValue::Function ||
             formal.builtin == BuiltinValue::Function) &&
            !sameStorageType(actual, formal))
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
      if (auto error = functionValueTransportError(module, invocation))
        return error;
    }
  }
  const auto resumable = continuation::coordinatingFunctions(module);
  for (const auto &expression : module.expressions)
    if (const auto *ref = std::get_if<FunctionReference>(&expression.operation))
      if (resumable[ref->function])
        return "function values require transitively synchronous targets; task coordination "
               "is not supported through function values";
  return {};
}
} // namespace kalandra
