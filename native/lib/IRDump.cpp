#include "RecordLayout.h"
#include "kalandra/Continuation.h"
#include "kalandra/Semantics.h"
#include "kalandra/Utf8.h"
#include <algorithm>
#include <iomanip>
#include <sstream>

namespace kalandra {
bool hasOrdinaryStrings(const TypedModule &module) {
  for (const auto &record : module.records)
    for (const auto &field : record.fields)
      if (field.type.builtin == BuiltinValue::String)
        return true;
  return std::ranges::any_of(module.expressions,
                             [&](const auto &e) {
                               const auto *comparison = std::get_if<ScalarCompare>(&e.operation);
                               const bool stringComparison =
                                   comparison && comparison->left < module.expressions.size() &&
                                   module.expressions[comparison->left].type.builtin ==
                                       BuiltinValue::String;
                               return stringComparison || isStringArray(e.type) ||
                                      std::holds_alternative<StringLiteral>(e.operation) ||
                                      std::holds_alternative<StringConcat>(e.operation) ||
                                      std::holds_alternative<StringQuery>(e.operation) ||
                                      std::holds_alternative<StringIndex>(e.operation) ||
                                      std::holds_alternative<StringSlice>(e.operation);
                             }) ||
         std::ranges::any_of(module.functions,
                             [](const auto &f) {
                               return f.resultType.builtin == BuiltinValue::String ||
                                      (f.declaredResult &&
                                       f.declaredResult->builtin == BuiltinValue::String);
                             }) ||
         std::ranges::any_of(module.symbols, [](const auto &s) {
           return s.parameter && s.type.builtin == BuiltinValue::String;
         });
}
bool hasPlacement(const TypedModule &module) {
  const auto placed = [](const ValueType &type) {
    return type.device.has_value() || type.builtin == BuiltinValue::Device;
  };
  return std::ranges::any_of(module.expressions,
                             [&](const auto &e) {
                               const auto *task = std::get_if<TaskOperation>(&e.operation);
                               return placed(e.type) ||
                                      std::holds_alternative<DeviceSelection>(e.operation) ||
                                      std::holds_alternative<Transfer>(e.operation) ||
                                      (task && task->placement);
                             }) ||
         std::ranges::any_of(module.symbols, [&](const auto &s) { return placed(s.type); }) ||
         std::ranges::any_of(module.functions, [&](const auto &f) {
           return placed(f.resultType) || (f.declaredResult && placed(*f.declaredResult));
         });
}
std::string describeType(const ValueType &type) {
  if (type.builtin == BuiltinValue::Record) {
    const auto name = type.array ? "[" + type.recordName + "]" : type.recordName;
    return (type.task ? "task<" + name + ">" : name) + (type.fallible ? " ! TaskError" : "");
  }
  if (type.builtin == BuiltinValue::Bool)
    return std::string(type.task ? "task<" : "") + (type.array ? "[Bool]" : "Bool") +
           (type.task ? ">" : "") + (type.fallible ? " ! TaskError" : "");
  if (type.builtin == BuiltinValue::Device)
    return type.device ? "Device[gpu:" + std::to_string(*type.device) + "]" : "Device[cpu]";
  if (type.builtin == BuiltinValue::String)
    return std::string(type.task ? "task<" : "") + (type.array ? "[String]" : "String") +
           (type.task ? ">" : "") + (type.fallible ? " ! TaskError" : "");
  if (type.builtin != BuiltinValue::Numeric)
    return type.builtin == BuiltinValue::TaskError   ? "TaskError"
           : type.builtin == BuiltinValue::FaultKind ? "FaultKind"
                                                     : "String";
  const auto description = describeNumeric(type.element);
  const auto name = description ? std::string(description->name) : "<invalid numeric type>";
  if (type.array)
    return std::string(type.task ? "task<[" : "[") + name + (type.task ? "]>" : "]") +
           (type.fallible ? " ! TaskError" : "");
  if (!type.tensor)
    return (type.task ? "task<" + name + ">" : name) + (type.fallible ? " ! TaskError" : "");
  std::ostringstream out;
  out << "Tensor[" << name;
  for (const auto &dimension : type.shape) {
    out << ", ";
    if (dimension.constant)
      out << *dimension.constant;
    else
      out << "?d" << dimension.identity;
  }
  out << ']';
  if (type.device)
    out << " on gpu:" << *type.device;
  if (type.task)
    out << " task";
  if (type.fallible)
    out << " ! TaskError";
  return out.str();
}
std::optional<std::string> numericCapabilityError(const TypedModule &module, NumericTarget target) {
  if (hasOrdinaryStrings(module)) {
    if (target != NumericTarget::Cpu || hasPlacement(module))
      return "ordinary Strings currently require CPU execution without placement";
  }
  if (!module.records.empty() && (target != NumericTarget::Cpu || hasPlacement(module)))
    return "record values currently require CPU execution";
  const auto error = [&](const ValueType &type) -> std::optional<std::string> {
    if (type.builtin == BuiltinValue::String &&
        (type.device || (type.array ? (!type.tensor || type.shape.size() != 1)
                                    : (type.tensor || !type.shape.empty()))))
      return "String requires CPU scalar storage";
    if (type.builtin == BuiltinValue::Record) {
      if (!type.record || *type.record >= module.records.size() || type.device ||
          (type.array ? (!type.tensor || type.shape.size() != 1)
                      : (type.tensor || !type.shape.empty())))
        return "invalid CPU record type";
    } else if (type.record)
      return "non-record value carries a record identity";

    if (type.array &&
        (target != NumericTarget::Cpu || !type.tensor || type.shape.size() != 1 ||
         (type.builtin != BuiltinValue::Numeric && !isOwnedArray(type)) || type.device))
      return "arrays require rank-one CPU numeric, Bool or record storage";
    if (type.builtin == BuiltinValue::Bool &&
        (target != NumericTarget::Cpu || (type.tensor && !isBoolArray(type)) || type.device))
      return "Bool values require CPU scalar or array storage";
    if (type.builtin != BuiltinValue::Numeric || numericArithmeticAvailable(type.element, target))
      return {};
    const auto description = describeNumeric(type.element);
    return "numeric type '" + (description ? std::string(description->name) : "<invalid>") + "'" +
           (type.tensor ? " tensor arithmetic" : "") + " is not implemented by the " +
           (target == NumericTarget::Cpu ? "CPU" : "Apple GPU") + " backend";
  };
  const auto sameArray = [](const ValueType &a, const ValueType &b) {
    return a.builtin == b.builtin && a.record == b.record && a.array == b.array &&
           (!a.array || a.builtin != BuiltinValue::Numeric || a.element == b.element);
  };
  if (auto invalid = recordLayoutError(module))
    return invalid->message;
  const auto scalarSame = [](const ValueType &a, const ValueType &b) {
    if (a.builtin != b.builtin || a.record != b.record || a.tensor != b.tensor ||
        a.array != b.array || a.task || a.fallible || a.device || b.task || b.fallible ||
        b.device || a.shape.size() != b.shape.size() ||
        (a.builtin == BuiltinValue::Numeric && a.element != b.element))
      return false;
    for (std::size_t i = 0; i < a.shape.size(); ++i)
      if (b.shape[i].constant && a.shape[i].constant != b.shape[i].constant)
        return false;
    return true;
  };
  bool hasMap = false;
  for (const auto &expression : module.expressions)
    if (const auto *map = std::get_if<ArrayMap>(&expression.operation)) {
      if (map->function >= module.functions.size() || map->input >= module.expressions.size())
        return "map references invalid input or callback";
      for (auto capture : map->captures)
        if (capture >= module.expressions.size())
          return "map references invalid capture";
      hasMap = true;
    }
  const auto resumable = hasMap ? continuation::resumableFunctions(module)
                                : std::vector<bool>(module.functions.size());
  for (const auto &fn : module.functions) {
    if (auto failure = error(fn.resultType))
      return failure;
    if (!sameArray(fn.resultType, module.expressions[fn.result].type) ||
        (fn.declaredResult && !sameArray(fn.resultType, *fn.declaredResult)))
      return "function result changes array category or element identity";
    if (fn.declaredResult)
      if (auto failure = error(*fn.declaredResult))
        return failure;
  }
  for (const auto &symbol : module.symbols)
    if (auto failure = error(symbol.type))
      return failure;
  for (const auto &expression : module.expressions) {
    if (auto failure = error(expression.type))
      return failure;
    if (const auto *value = std::get_if<RecordValue>(&expression.operation)) {
      const auto &t = expression.type;
      if (t.builtin != BuiltinValue::Record || !t.record || t.tensor || t.array || t.task ||
          t.fallible)
        return "record construction requires a completed record result";
      const auto &fields = module.records[*t.record].fields;
      if (value->base && (*value->base >= module.expressions.size() ||
                          !scalarSame(module.expressions[*value->base].type, t)))
        return "record update base has a different nominal type";
      std::vector<bool> seen(fields.size());
      for (const auto &field : value->fields) {
        if (field.field >= fields.size() || seen[field.field] ||
            field.value >= module.expressions.size() ||
            !scalarSame(module.expressions[field.value].type, fields[field.field].type))
          return "invalid record field initializer";
        seen[field.field] = true;
      }
      if (!value->base && std::ranges::find(seen, false) != seen.end())
        return "record construction leaves a field uninitialized";
    }
    if (const auto *read = std::get_if<RecordFieldRead>(&expression.operation)) {
      if (read->input >= module.expressions.size())
        return "record field read references an invalid value";
      const auto &t = module.expressions[read->input].type;
      if (t.builtin != BuiltinValue::Record || !t.record || *t.record >= module.records.size() ||
          t.task || t.fallible || t.tensor || t.device ||
          read->field >= module.records[*t.record].fields.size() ||
          !scalarSame(expression.type, module.records[*t.record].fields[read->field].type))
        return "invalid record field read";
    }
    const auto sameResult = [&](ValueId id) {
      return sameArray(expression.type, module.expressions[id].type);
    };
    const bool collectionMismatch = std::visit(
        [&](const auto &op) {
          using T = std::decay_t<decltype(op)>;
          if constexpr (std::is_same_v<T, SymbolRead>)
            return !sameArray(expression.type, module.symbols[op.symbol].type);
          else if constexpr (std::is_same_v<T, ShapeCheck>)
            return !sameResult(op.input);
          else if constexpr (std::is_same_v<T, TaskOperation>)
            return !sameResult(op.operand);
          else if constexpr (std::is_same_v<T, ParallelOperation>)
            return !sameResult(op.result);
          else if constexpr (std::is_same_v<T, CatchOperation>)
            return !sameResult(op.operand) || !sameResult(op.result);
          else if constexpr (std::is_same_v<T, MatchOperation>)
            return std::ranges::any_of(op.cases,
                                       [&](const auto &arm) { return !sameResult(arm.result); });
          else if constexpr (std::is_same_v<T, FunctionCall>) {
            const auto &fn = module.functions[op.function];
            if (!sameArray(expression.type, fn.resultType))
              return true;
            for (std::size_t i = 0; i < op.arguments.size(); ++i)
              if (!sameArray(module.expressions[op.arguments[i]].type,
                             module.symbols[fn.parameters[i]].type))
                return true;
            return false;
          } else
            return false;
        },
        expression.operation);
    if (collectionMismatch)
      return "value flow changes array category or element identity";
    const auto array = [&](ValueId id) { return module.expressions[id].type.array; };
    const auto arithmeticArray = std::visit(
        [&](const auto &op) {
          using T = std::decay_t<decltype(op)>;
          if constexpr (std::is_same_v<T, ScalarUnary> || std::is_same_v<T, TensorUnary>)
            return expression.type.array || array(op.operand);
          else if constexpr (std::is_same_v<T, ScalarBinary> || std::is_same_v<T, TensorBinary> ||
                             std::is_same_v<T, Matmul> || std::is_same_v<T, ScalarCompare>)
            return expression.type.array || array(op.left) || array(op.right);
          else if constexpr (std::is_same_v<T, ReduceSum> || std::is_same_v<T, Transfer>)
            return expression.type.array || array(op.input);
          else
            return false;
        },
        expression.operation);
    if (arithmeticArray)
      return "arrays require explicit collection operations, not tensor/scalar arithmetic";
    if (const auto *literal = std::get_if<StringLiteral>(&expression.operation);
        literal && (expression.type.builtin != BuiltinValue::String || expression.type.tensor ||
                    expression.type.array || expression.type.task || expression.type.fallible ||
                    !validUtf8(literal->value)))
      return "String literal requires valid UTF-8 and String identity";
    if (std::holds_alternative<BoolLiteral>(expression.operation) &&
        (expression.type.builtin != BuiltinValue::Bool || expression.type.tensor ||
         expression.type.array || expression.type.task || expression.type.fallible ||
         expression.type.device || !expression.type.shape.empty()))
      return "Boolean literal requires a completed CPU scalar Bool";
    if (const auto *literal = std::get_if<TensorLiteral>(&expression.operation)) {
      if (expression.type.array) {
        if (isStringArray(expression.type) &&
            literal->elements.size() > SemanticLimits{}.maxValues / 3)
          return "String array literal exceeds expanded storage budget";
        if (isRecordArray(expression.type) &&
            literal->elements.size() >
                SemanticLimits{}.maxValues / recordInlineUnits(module, *expression.type.record))
          return "record array literal exceeds configured expanded storage budget";
        if (!expression.type.shape[0].constant ||
            *expression.type.shape[0].constant != literal->elements.size())
          return "array literal length mismatch";
        for (auto id : literal->elements) {
          if (id >= module.expressions.size())
            return "array literal references invalid element";
          const auto &element = module.expressions[id].type;
          if (element.tensor || element.array || element.task || element.fallible ||
              element.device || element.builtin != expression.type.builtin ||
              element.record != expression.type.record ||
              (element.builtin == BuiltinValue::Numeric &&
               element.element != expression.type.element))
            return "array literal requires homogeneous completed numeric scalar elements";
        }
      }
    }
    if (const auto *choice = std::get_if<ConditionalOperation>(&expression.operation)) {
      const auto &condition = module.expressions[choice->condition].type;
      if (condition.builtin != BuiltinValue::Bool || condition.task || condition.fallible ||
          condition.tensor || condition.device || expression.type.task ||
          expression.type.builtin == BuiltinValue::Device || choice->whenTrue.empty() ||
          choice->whenFalse.empty())
        return "conditional requires a completed CPU Bool and two result branches";
      for (auto result : {choice->trueResult, choice->falseResult}) {
        const auto &type = module.expressions[result].type;
        if (type.task || type.builtin == BuiltinValue::Device ||
            type.builtin != expression.type.builtin || type.tensor != expression.type.tensor ||
            type.array != expression.type.array || type.record != expression.type.record ||
            type.shape.size() != expression.type.shape.size() ||
            type.device != expression.type.device ||
            (type.builtin == BuiltinValue::Numeric && type.element != expression.type.element))
          return "conditional branch result type mismatch";
      }
    }
    if (const auto *concat = std::get_if<ArrayConcat>(&expression.operation)) {
      if (concat->left >= module.expressions.size() || concat->right >= module.expressions.size())
        return "array concat references invalid operands";
      const auto &a = module.expressions[concat->left].type;
      const auto &b = module.expressions[concat->right].type;
      const auto &r = expression.type;
      for (const auto *type : {&a, &b, &r})
        if (target != NumericTarget::Cpu || !type->array || !type->tensor ||
            type->shape.size() != 1 || type->task || type->fallible || type->device ||
            (type->builtin != BuiltinValue::Numeric && !isOwnedArray(*type)))
          return "array concat requires completed CPU arrays";
      for (const auto *type : {&a, &b, &r})
        if (type->shape[0].constant && *type->shape[0].constant > std::uint64_t(INT64_MAX))
          return "array concat extent exceeds the indexing range";
      if (!sameArray(a, b) || !sameArray(a, r))
        return "array concat element types differ";
    }
    if (const auto *slice = std::get_if<ArraySlice>(&expression.operation)) {
      if (slice->input >= module.expressions.size() || slice->start >= module.expressions.size() ||
          slice->end >= module.expressions.size())
        return "array slice references invalid operands";
      const auto &a = module.expressions[slice->input].type;
      const auto &r = expression.type;
      if (target != NumericTarget::Cpu || !a.array || !a.tensor || a.shape.size() != 1 ||
          !r.array || !r.tensor || r.shape.size() != 1 || !sameArray(a, r) ||
          (a.builtin != BuiltinValue::Numeric && !isOwnedArray(a)) || a.task || a.fallible ||
          a.device || r.task || r.fallible || r.device)
        return "array slice requires completed CPU arrays with unchanged element type";
      for (auto id : {slice->start, slice->end}) {
        const auto &i = module.expressions[id].type;
        if (i.builtin != BuiltinValue::Numeric || !isInteger(i.element) || i.tensor || i.array ||
            i.task || i.fallible || i.device || !i.shape.empty())
          return "array slice requires completed CPU integer bounds";
      }
    }
    if (const auto *slice = std::get_if<StringSlice>(&expression.operation)) {
      if (slice->input >= module.expressions.size() || slice->start >= module.expressions.size() ||
          slice->end >= module.expressions.size())
        return "String slice references invalid operands";
      const auto &a = module.expressions[slice->input].type;
      if (target != NumericTarget::Cpu || a.builtin != BuiltinValue::String || a.tensor ||
          a.array || expression.type.builtin != BuiltinValue::String ||
          !scalarSame(a, expression.type))
        return "String slice requires completed CPU String input and result";
      for (auto id : {slice->start, slice->end}) {
        const auto &i = module.expressions[id].type;
        if (i.builtin != BuiltinValue::Numeric || !isInteger(i.element) || i.tensor || i.array ||
            i.task || i.fallible || i.device || !i.shape.empty())
          return "String slice requires completed CPU integer bounds";
      }
    }
    if (const auto *read = std::get_if<StringIndex>(&expression.operation)) {
      if (read->input >= module.expressions.size() || read->index >= module.expressions.size())
        return "String index references invalid operands";
      const auto &a = module.expressions[read->input].type;
      const auto &i = module.expressions[read->index].type;
      if (target != NumericTarget::Cpu || a.builtin != BuiltinValue::String || a.tensor ||
          a.array || expression.type.builtin != BuiltinValue::String ||
          !scalarSame(a, expression.type) || i.builtin != BuiltinValue::Numeric ||
          !isInteger(i.element) || i.tensor || i.array || i.task || i.fallible || i.device ||
          !i.shape.empty())
        return "String index requires a completed CPU String, integer index and String result";
    }
    if (const auto *query = std::get_if<StringQuery>(&expression.operation)) {
      if (query->input >= module.expressions.size())
        return "String query references invalid input";
      const auto &a = module.expressions[query->input].type;
      const auto &r = expression.type;
      if (target != NumericTarget::Cpu || a.builtin != BuiltinValue::String || a.task ||
          a.fallible || a.tensor || a.array || a.device || !a.shape.empty() ||
          r.builtin != BuiltinValue::Numeric || r.element != NumericType::Int64 || r.task ||
          r.fallible || r.tensor || r.array || r.device || !r.shape.empty() ||
          (query->kind != StringQueryKind::Length && query->kind != StringQueryKind::ByteLength))
        return "String query requires a completed CPU String and scalar int64 result";
    }
    if (const auto *concat = std::get_if<StringConcat>(&expression.operation)) {
      const auto string = [&](ValueId id) {
        return id < module.expressions.size() &&
               module.expressions[id].type.builtin == BuiltinValue::String &&
               scalarSame(module.expressions[id].type, expression.type);
      };
      if (target != NumericTarget::Cpu || expression.type.builtin != BuiltinValue::String ||
          expression.type.tensor || expression.type.array || !string(concat->left) ||
          !string(concat->right))
        return "String concatenation requires two completed CPU Strings and a String result";
    }
    if (const auto *comparison = std::get_if<ScalarCompare>(&expression.operation)) {
      if (comparison->left >= module.expressions.size() ||
          comparison->right >= module.expressions.size())
        return "scalar comparison references an invalid operand";
      const auto &a = module.expressions[comparison->left].type;
      const auto &b = module.expressions[comparison->right].type;
      const auto ordinary = [](const ValueType &t) {
        return !t.tensor && !t.task && !t.fallible && !t.device;
      };
      const bool numeric = a.builtin == BuiltinValue::Numeric &&
                           b.builtin == BuiltinValue::Numeric && a.element == b.element;
      const bool boolean = a.builtin == BuiltinValue::Bool && b.builtin == BuiltinValue::Bool &&
                           (comparison->operation == ComparisonKind::Equal ||
                            comparison->operation == ComparisonKind::NotEqual);
      const bool string = a.builtin == BuiltinValue::String && b.builtin == BuiltinValue::String &&
                          (comparison->operation == ComparisonKind::Equal ||
                           comparison->operation == ComparisonKind::NotEqual);
      if (target != NumericTarget::Cpu || !ordinary(a) || !ordinary(b) ||
          !ordinary(expression.type) || expression.type.builtin != BuiltinValue::Bool ||
          (!numeric && !boolean && !string) ||
          static_cast<unsigned>(comparison->operation) >
              static_cast<unsigned>(ComparisonKind::GreaterEqual))
        return "unsupported scalar comparison IR";
    }
    if (const auto *convert = std::get_if<NumericConvert>(&expression.operation)) {
      const auto &source = module.expressions[convert->input].type;
      if (target != NumericTarget::Cpu || source.builtin != BuiltinValue::Numeric || source.array ||
          expression.type.array || source.task || source.fallible || source.device ||
          expression.type.builtin != BuiltinValue::Numeric || expression.type.task ||
          expression.type.fallible || expression.type.device ||
          source.tensor != expression.type.tensor ||
          source.shape.size() != expression.type.shape.size() ||
          !std::equal(source.shape.begin(), source.shape.end(), expression.type.shape.begin(),
                      [](const Extent &a, const Extent &b) {
                        return a.constant == b.constant && a.identity == b.identity;
                      }) ||
          !numericArithmeticAvailable(source.element, target))
        return "numeric conversions require implemented CPU values with unchanged shape";
    }
    if (const auto *read = std::get_if<ArrayIndex>(&expression.operation)) {
      if (read->input >= module.expressions.size() || read->index >= module.expressions.size())
        return "array index references invalid operands";
      const auto &a = module.expressions[read->input].type;
      const auto &i = module.expressions[read->index].type;
      const auto &r = expression.type;
      const auto scalar = [](const ValueType &t) {
        return t.builtin == BuiltinValue::Numeric && !t.tensor && !t.array && t.shape.empty() &&
               !t.task && !t.fallible && !t.device;
      };
      if (target != NumericTarget::Cpu || !a.array || !a.tensor || a.shape.size() != 1 ||
          (a.builtin != BuiltinValue::Numeric && !isOwnedArray(a)) || a.task || a.fallible ||
          a.device || !scalar(i) || !isInteger(i.element) ||
          (isOwnedArray(a) ? (r.builtin != a.builtin || r.record != a.record || r.tensor ||
                              r.array || r.task || r.fallible || r.device || !r.shape.empty())
                           : (!scalar(r) || r.element != a.element)))
        return "array indexing requires completed CPU numeric array and integer scalar operands";
    }
    if (const auto *read = std::get_if<TensorIndex>(&expression.operation)) {
      if (read->input >= module.expressions.size())
        return "tensor index references invalid input";
      const auto &a = module.expressions[read->input].type;
      const auto &r = expression.type;
      const auto scalar = [](const ValueType &t) {
        return t.builtin == BuiltinValue::Numeric && !t.tensor && !t.array && t.shape.empty() &&
               !t.task && !t.fallible && !t.device;
      };
      if (target != NumericTarget::Cpu || !a.tensor || a.array ||
          a.builtin != BuiltinValue::Numeric || a.task || a.fallible || a.device ||
          a.shape.size() != read->indices.size() || !scalar(r) || r.element != a.element)
        return "tensor indexing requires a completed CPU tensor and one index per dimension";
      for (auto id : read->indices) {
        if (id >= module.expressions.size())
          return "tensor index references invalid axis";
        const auto &i = module.expressions[id].type;
        if (!scalar(i) || !isInteger(i.element))
          return "tensor indexing requires completed CPU integer scalar indices";
      }
    }
    if (const auto *query = std::get_if<CollectionQuery>(&expression.operation)) {
      if (query->input >= module.expressions.size())
        return "collection query references invalid input";
      const auto &a = module.expressions[query->input].type;
      const auto &r = expression.type;
      const bool length = query->kind == CollectionQueryKind::Length;
      if ((!length && query->kind != CollectionQueryKind::Shape) || target != NumericTarget::Cpu ||
          !a.tensor || (a.builtin != BuiltinValue::Numeric && !(length && isOwnedArray(a))) ||
          a.task || a.fallible || a.device || a.array != length ||
          (length && a.shape.size() != 1) || r.builtin != BuiltinValue::Numeric ||
          r.element != NumericType::Int64 || r.task || r.fallible || r.device ||
          r.tensor != !length || r.array != !length)
        return "collection query requires completed CPU values and exact int64 metadata result";
      if (length ? !r.shape.empty()
                 : (r.shape.size() != 1 || r.shape[0].constant != a.shape.size() ||
                    r.shape[0].identity))
        return "collection query result shape mismatch";
    }
    if (const auto *construction = std::get_if<TensorToArray>(&expression.operation)) {
      if (construction->input >= module.expressions.size())
        return "tensor-to-array construction references invalid input";
      const auto &a = module.expressions[construction->input].type;
      const auto &r = expression.type;
      if (target != NumericTarget::Cpu || !a.tensor || a.array || a.task || a.fallible ||
          a.device || a.builtin != BuiltinValue::Numeric || !r.tensor || !r.array || r.task ||
          r.fallible || r.device || r.builtin != BuiltinValue::Numeric || a.element != r.element ||
          r.shape.size() != 1)
        return "tensor-to-array construction requires completed CPU numeric values";
    }
    if (const auto *reshape = std::get_if<TensorReshape>(&expression.operation)) {
      if (reshape->input >= module.expressions.size())
        return "reshape references invalid input";
      const auto &a = module.expressions[reshape->input].type;
      const auto &r = expression.type;
      if (target != NumericTarget::Cpu || !a.tensor || a.array || a.task || a.fallible ||
          a.device || a.builtin != BuiltinValue::Numeric || !r.tensor || r.array || r.task ||
          r.fallible || r.device || r.builtin != BuiltinValue::Numeric || a.element != r.element ||
          r.shape.size() != reshape->dimensions.size())
        return "reshape requires completed CPU tensors with unchanged element type and fixed rank";
      for (auto id : reshape->dimensions) {
        if (id >= module.expressions.size())
          return "reshape references invalid dimension";
        const auto &d = module.expressions[id].type;
        if (d.builtin != BuiltinValue::Numeric || !isInteger(d.element) || d.tensor || d.array ||
            d.task || d.fallible || d.device || !d.shape.empty())
          return "reshape dimensions require completed CPU integer scalars";
      }
    }
    if (const auto *construction = std::get_if<ArrayToTensor>(&expression.operation)) {
      if (construction->input >= module.expressions.size())
        return "array-to-tensor construction references invalid input";
      const auto &input = module.expressions[construction->input].type;
      const auto &output = expression.type;
      if (target != NumericTarget::Cpu || !input.array || !input.tensor || output.array ||
          !output.tensor || input.builtin != BuiltinValue::Numeric ||
          output.builtin != BuiltinValue::Numeric || input.task || input.fallible || input.device ||
          output.task || output.fallible || output.device || input.element != output.element ||
          input.shape.size() != 1)
        return "array-to-tensor construction requires completed CPU numeric values";
      if (construction->dimensions) {
        if (output.shape.size() != construction->dimensions->size())
          return "reshape rank differs from dimension operands";
        for (auto dimension : *construction->dimensions) {
          if (dimension >= module.expressions.size())
            return "reshape references invalid dimension";
          const auto &type = module.expressions[dimension].type;
          if (type.builtin != BuiltinValue::Numeric || !isInteger(type.element) || type.tensor ||
              type.task || type.fallible || type.device)
            return "reshape dimensions require completed CPU integer scalars";
        }
      } else if (output.shape.size() != 1 || input.shape[0].constant != output.shape[0].constant ||
                 input.shape[0].identity != output.shape[0].identity)
        return "unshaped array construction must preserve rank-one length facts";
    }
    if (const auto *map = std::get_if<ArrayMap>(&expression.operation)) {
      if (map->function >= module.functions.size() || map->input >= module.expressions.size())
        return "map references invalid input or callback";
      const auto &fn = module.functions[map->function];
      const auto &input = module.expressions[map->input].type;
      const auto scalar = [](const ValueType &type) {
        return (type.builtin == BuiltinValue::Numeric || type.builtin == BuiltinValue::Record ||
                type.builtin == BuiltinValue::Bool || type.builtin == BuiltinValue::String) &&
               !type.tensor && !type.task && !type.fallible && !type.device && !type.array &&
               type.shape.empty();
      };
      for (auto parameter : fn.parameters)
        if (parameter >= module.symbols.size())
          return "map references invalid parameter";
      for (std::size_t i = 0; i < map->captures.size(); ++i) {
        if (i + 1 >= fn.parameters.size())
          return "map capture count does not match callback";
        const auto &actual = module.expressions[map->captures[i]].type;
        const auto &formal = module.symbols[fn.parameters[i + 1]].type;
        if (actual.task || actual.fallible || actual.device ||
            (actual.builtin != BuiltinValue::Numeric && actual.builtin != BuiltinValue::Bool &&
             actual.builtin != BuiltinValue::Record && actual.builtin != BuiltinValue::String) ||
            actual.builtin != formal.builtin || actual.record != formal.record ||
            (actual.builtin == BuiltinValue::Numeric && actual.element != formal.element) ||
            actual.tensor != formal.tensor || actual.array != formal.array || formal.task ||
            formal.fallible || formal.device || actual.shape.size() != formal.shape.size() ||
            !std::equal(actual.shape.begin(), actual.shape.end(), formal.shape.begin(),
                        [](const Extent &a, const Extent &b) {
                          return a.constant == b.constant && a.identity == b.identity;
                        }))
          return "map requires matching completed CPU captures";
      }
      if (target != NumericTarget::Cpu || resumable[map->function] ||
          fn.parameters.size() != 1 + map->captures.size() || !scalar(fn.resultType) ||
          !scalar(module.symbols[fn.parameters[0]].type) || !input.array || input.device ||
          input.task || input.fallible || !expression.type.array || expression.type.device ||
          input.shape.size() != 1 || expression.type.shape.size() != 1 || expression.type.task ||
          expression.type.fallible ||
          input.builtin != module.symbols[fn.parameters[0]].type.builtin ||
          input.record != module.symbols[fn.parameters[0]].type.record ||
          (input.builtin == BuiltinValue::Numeric &&
           input.element != module.symbols[fn.parameters[0]].type.element) ||
          expression.type.builtin != fn.resultType.builtin ||
          expression.type.record != fn.resultType.record ||
          (expression.type.builtin == BuiltinValue::Numeric &&
           expression.type.element != fn.resultType.element) ||
          input.shape[0].constant != expression.type.shape[0].constant ||
          input.shape[0].identity != expression.type.shape[0].identity)
        return "map requires an unchanged-length CPU array and a synchronous one-argument numeric "
               "Bool or record "
               "callback";
    }
    if (const auto *reduce = std::get_if<ReduceSum>(&expression.operation)) {
      if (expression.type.element != module.expressions[reduce->input].type.element ||
          !numericArithmeticAvailable(expression.type.element, target))
        return "unsupported reduction element type";
    }
    if (const auto *multiply = std::get_if<Matmul>(&expression.operation)) {
      if (expression.type.element != module.expressions[multiply->left].type.element ||
          expression.type.element != module.expressions[multiply->right].type.element ||
          !numericArithmeticAvailable(expression.type.element, target))
        return "unsupported matmul element type";
    }
  }
  return {};
}
std::string dumpTypedIR(const TypedModule &module) {
  std::ostringstream out;
  const auto value = [&](ValueId id) { out << '%' << id; };
  const auto arguments = [&](const std::vector<ValueId> &ids) {
    out << '(';
    for (std::size_t i = 0; i < ids.size(); ++i) {
      if (i)
        out << ", ";
      value(ids[i]);
    }
    out << ')';
  };
  const auto body = [&](const std::vector<TypedStatement> &statements) {
    out << " body=[";
    for (const auto &statement : statements) {
      if (statement.binding)
        out << '$' << *statement.binding << '=';
      value(statement.value);
      out << ';';
    }
    out << ']';
  };
  for (FunctionId id = 0; id < module.functions.size(); ++id) {
    const auto &function = module.functions[id];
    out << "fn @" << id << ' ' << function.name << '(';
    for (std::size_t i = 0; i < function.parameters.size(); ++i) {
      if (i)
        out << ", ";
      const auto symbol = function.parameters[i];
      out << '$' << symbol << ' ' << module.symbols[symbol].name << ": "
          << describeType(module.symbols[symbol].type);
    }
    out << ") -> " << describeType(function.resultType) << " {\n";
    for (const auto &requirement : function.preconditions) {
      const auto extent = [&](const Extent &dimension) {
        if (dimension.constant)
          out << *dimension.constant;
        else
          out << "?d" << dimension.identity;
      };
      out << "  requires ";
      extent(requirement.left);
      out << " == ";
      extent(requirement.right);
      out << '\n';
    }
    for (auto expression : function.expressions) {
      const auto &node = module.expressions[expression];
      out << "  %" << expression << " : " << describeType(node.type) << " = ";
      std::visit(
          [&](const auto &operation) {
            using T = std::decay_t<decltype(operation)>;
            if constexpr (std::is_same_v<T, ArrayConcat>)
              out << "array.concat checked %" << operation.left << " %" << operation.right;
            else if constexpr (std::is_same_v<T, ArraySlice>)
              out << "array.slice checked %" << operation.input << " %" << operation.start << " %"
                  << operation.end;
            else if constexpr (std::is_same_v<T, StringSlice>)
              out << "string.slice checked %" << operation.input << " %" << operation.start << " %"
                  << operation.end;
            else if constexpr (std::is_same_v<T, StringIndex>)
              out << "string.index checked %" << operation.input << " %" << operation.index;
            else if constexpr (std::is_same_v<T, StringQuery>)
              out << (operation.kind == StringQueryKind::Length ? "string.length checked %"
                                                                : "string.byte_length checked %")
                  << operation.input;
            else if constexpr (std::is_same_v<T, StringConcat>)
              out << "string.concat %" << operation.left << " %" << operation.right;
            else if constexpr (std::is_same_v<T, StringLiteral>) {
              out << "string.utf8 0x";
              for (unsigned char byte : operation.value)
                out << std::hex << std::setw(2) << std::setfill('0') << unsigned(byte);
              out << std::dec;
            } else if constexpr (std::is_same_v<T, BoolLiteral>)
              out << (operation.value ? "true" : "false");
            else if constexpr (std::is_same_v<T, RecordValue>) {
              out << "record " << node.type.recordName;
              if (operation.base)
                out << " with %" << *operation.base;
              for (const auto &field : operation.fields)
                out << " field[" << field.field << "]=%" << field.value;
            } else if constexpr (std::is_same_v<T, RecordFieldRead>)
              out << "field %" << operation.input << '[' << operation.field << ']';
            else if constexpr (std::is_same_v<T, ConditionalOperation>)
              out << "if %" << operation.condition << " then %" << operation.trueResult << " else %"
                  << operation.falseResult;
            else if constexpr (std::is_same_v<T, ScalarCompare>)
              out << "compare " << static_cast<unsigned>(operation.operation) << " %"
                  << operation.left << " %" << operation.right;
            else if constexpr (std::is_same_v<T, Float64Literal>)
              out << "f64.bits 0x" << std::hex << std::setw(16) << std::setfill('0')
                  << operation.bits << std::dec;
            else if constexpr (std::is_same_v<T, Float32Literal>)
              out << "f32.bits 0x" << std::hex << std::setw(8) << std::setfill('0')
                  << operation.bits << std::dec;
            else if constexpr (std::is_same_v<T, Int32Literal>)
              out << "i32 " << operation.value;
            else if constexpr (std::is_same_v<T, Int64Literal>)
              out << "i64 " << operation.value;
            else if constexpr (std::is_same_v<T, UInt64Literal>)
              out << "u64 " << operation.value;
            else if constexpr (std::is_same_v<T, UInt32Literal>)
              out << "u32 " << operation.value;
            else if constexpr (std::is_same_v<T, SymbolRead>)
              out << "read $" << operation.symbol;
            else if constexpr (std::is_same_v<T, NumericConvert>) {
              out << "convert " << describeNumeric(node.type.element)->name << " checked ";
              value(operation.input);
            } else if constexpr (std::is_same_v<T, ScalarUnary>) {
              out << (operation.operation == TokenKind::Minus ? "neg." : "pos.")
                  << (node.type.element == NumericType::UInt64    ? "u64 checked "
                      : node.type.element == NumericType::Int64   ? "i64 checked "
                      : node.type.element == NumericType::UInt32  ? "u32 checked "
                      : node.type.element == NumericType::Int32   ? "i32 checked "
                      : node.type.element == NumericType::Float64 ? "f64 "
                                                                  : "f32 ");
              value(operation.operand);
            } else if constexpr (std::is_same_v<T, TensorUnary>) {
              out << (node.type.element == NumericType::UInt64   ? "elementwise neg.u64 checked "
                      : node.type.element == NumericType::Int64  ? "elementwise neg.i64 checked "
                      : node.type.element == NumericType::UInt32 ? "elementwise neg.u32 checked "
                      : node.type.element == NumericType::Int32  ? "elementwise neg.i32 checked "
                      : node.type.element == NumericType::Float64
                          ? "elementwise neg.f64 exact_sign_bit "
                          : "elementwise neg.f32 exact_sign_bit ");
              value(operation.operand);
            } else if constexpr (std::is_same_v<T, ScalarBinary> ||
                                 std::is_same_v<T, TensorBinary>) {
              const char *name = operation.operation == TokenKind::Plus    ? "add.f32"
                                 : operation.operation == TokenKind::Minus ? "sub.f32"
                                 : operation.operation == TokenKind::Star  ? "mul.f32"
                                                                           : "div.f32";
              if constexpr (std::is_same_v<T, TensorBinary>)
                out << "elementwise ";
              if (isInteger(node.type.element)) {
                const char *integer = operation.operation == TokenKind::Plus ? "add"
                                    : operation.operation == TokenKind::Minus ? "sub"
                                    : operation.operation == TokenKind::Star ? "mul"
                                    : operation.operation == TokenKind::Percent ? "rem" : "div";
                out << integer << (node.type.element == NumericType::UInt64 ? ".u64 checked " : node.type.element == NumericType::Int64 ? ".i64 checked " : node.type.element == NumericType::UInt32 ? ".u32 checked " : ".i32 checked ");
              } else
                out << (node.type.element == NumericType::Float64
                            ? std::string(name).replace(5, 2, "64")
                            : name)
                    << " strict ";
              value(operation.left);
              out << ", ";
              value(operation.right);
            } else if constexpr (std::is_same_v<T, TensorLiteral>) {
              out << (node.type.array ? "array.literal ordered " : "tensor.literal row_major ");
              arguments(operation.elements);
            } else if constexpr (std::is_same_v<T, ArrayIndex>) {
              out << "array.index checked ";
              value(operation.input);
              out << ", ";
              value(operation.index);
            } else if constexpr (std::is_same_v<T, TensorIndex>) {
              out << "tensor.index checked ";
              value(operation.input);
              out << " indices=";
              arguments(operation.indices);
            } else if constexpr (std::is_same_v<T, CollectionQuery>) {
              out << (operation.kind == CollectionQueryKind::Length ? "array.length checked "
                                                                    : "tensor.shape checked ");
              value(operation.input);
            } else if constexpr (std::is_same_v<T, TensorToArray>) {
              out << "array.from_tensor ordered_copy ";
              value(operation.input);
            } else if constexpr (std::is_same_v<T, TensorReshape>) {
              out << "tensor.reshape ordered_copy ";
              value(operation.input);
              out << " dimensions=";
              arguments(operation.dimensions);
            } else if constexpr (std::is_same_v<T, ArrayToTensor>) {
              out << "tensor.from_array ordered_copy ";
              value(operation.input);
              if (operation.dimensions) {
                out << " reshape=";
                arguments(*operation.dimensions);
              }
            } else if constexpr (std::is_same_v<T, ArrayMap>) {
              out << "array.map sequential @" << operation.function << " ";
              value(operation.input);
              if (!operation.captures.empty()) {
                out << " captures=";
                arguments(operation.captures);
              }
            } else if constexpr (std::is_same_v<T, FunctionCall>) {
              out << "call @" << operation.function;
              arguments(operation.arguments);
            } else if constexpr (std::is_same_v<T, Matmul>) {
              out << "matmul "
                  << (node.type.element == NumericType::UInt64 ? "checked_u64 balanced_adjacent checked_products "
                      : node.type.element == NumericType::Int64 ? "checked_i64 balanced_adjacent checked_products "
                      : node.type.element == NumericType::UInt32 ? "checked_u32 balanced_adjacent checked_products "
                      : node.type.element == NumericType::Int32 ? "checked_i32 balanced_adjacent checked_products "
                                                              : "strict_f32 balanced_adjacent separately_rounded_products ");
              value(operation.left);
              out << ", ";
              value(operation.right);
              out << " check_inner=" << operation.checkInnerExtent
                  << " check_allocation=" << operation.checkAllocationSize;
            } else if constexpr (std::is_same_v<T, ReduceSum>) {
              out << "reduceSum "
                  << (node.type.element == NumericType::UInt64 ? "checked_u64"
                      : node.type.element == NumericType::Int64 ? "checked_i64"
                      : node.type.element == NumericType::UInt32 ? "checked_u32"
                      : node.type.element == NumericType::Int32 ? "checked_i32" : "strict_f32")
                  << " balanced_adjacent row_major ";
              value(operation.input);
            } else if constexpr (std::is_same_v<T, DeviceSelection>) {
              out << (operation.device ? "device.gpu " + std::to_string(*operation.device)
                                       : "device.cpu");
            } else if constexpr (std::is_same_v<T, Transfer>) {
              out << "task.transfer ";
              value(operation.input);
              out << " to ";
              value(operation.target);
            } else if constexpr (std::is_same_v<T, TaskOperation>) {
              out << (operation.prefix == TaskPrefix::Spawn   ? "task.spawn "
                      : operation.prefix == TaskPrefix::Await ? "task.await "
                                                              : "result.try ");
              value(operation.operand);
              if (operation.placement) {
                out << " on ";
                value(*operation.placement);
              }
            } else if constexpr (std::is_same_v<T, ParallelOperation>) {
              out << "parallel group=" << operation.group << " result=";
              value(operation.result);
              body(operation.body);
            } else if constexpr (std::is_same_v<T, CatchOperation>) {
              out << "result.catch ";
              value(operation.operand);
              out << " error=$" << operation.parameter << " result=";
              value(operation.result);
              body(operation.body);
            } else if constexpr (std::is_same_v<T, MatchOperation>) {
              out << "match ";
              value(operation.subject);
              for (const auto &arm : operation.cases) {
                out << " case=" << (arm.tag ? std::to_string(*arm.tag) : "_") << " result=";
                value(arm.result);
                body(arm.body);
              }
            } else if constexpr (std::is_same_v<T, ErrorFieldRead>) {
              out << "error.field " << static_cast<unsigned>(operation.field) << ' ';
              value(operation.subject);
            } else if constexpr (std::is_same_v<T, FailOperation>) {
              out << "result.fail ";
              value(operation.error);
            } else if constexpr (std::is_same_v<T, ShapeCheck>) {
              out << "shape.check ";
              value(operation.input);
              for (const auto &check : operation.requirements)
                out << " axis[" << check.axis << "]=" << check.extent;
            }
          },
          node.operation);
      out << '\n';
    }
    // Arena IDs are storage, not an execution schedule. Statement roots and
    // operand/argument order retain source evaluation order for lowering.
    for (const auto &statement : function.body) {
      out << "  statement ";
      if (statement.binding)
        out << '$' << *statement.binding << " = ";
      value(statement.value);
      out << '\n';
    }
    out << "  return ";
    value(function.result);
    out << "\n}\n";
  }
  return out.str();
}
} // namespace kalandra
