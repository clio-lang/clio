#include "kalandra/Semantics.h"
#include <algorithm>
#include <iomanip>
#include <sstream>

namespace kalandra {
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
  if (type.builtin == BuiltinValue::Bool)
    return std::string(type.task ? "task<Bool>" : "Bool") + (type.fallible ? " ! TaskError" : "");
  if (type.builtin == BuiltinValue::Device)
    return type.device ? "Device[gpu:" + std::to_string(*type.device) + "]" : "Device[cpu]";
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
  const auto error = [&](const ValueType &type) -> std::optional<std::string> {
    if (type.array && (target != NumericTarget::Cpu || !type.tensor || type.shape.size() != 1 ||
                       type.builtin != BuiltinValue::Numeric || type.device))
      return "arrays require rank-one CPU numeric storage";
    if (type.builtin == BuiltinValue::Bool &&
        (target != NumericTarget::Cpu || type.tensor || type.device))
      return "Bool values require the CPU scalar backend";
    if (type.builtin != BuiltinValue::Numeric || numericArithmeticAvailable(type.element, target))
      return {};
    const auto description = describeNumeric(type.element);
    return "numeric type '" + (description ? std::string(description->name) : "<invalid>") + "'" +
           (type.tensor ? " tensor arithmetic" : "") + " is not implemented by the " +
           (target == NumericTarget::Cpu ? "CPU" : "Apple GPU") + " backend";
  };
  const auto sameArray = [](const ValueType &a, const ValueType &b) {
    return a.array == b.array && (!a.array || a.element == b.element);
  };
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
    if (const auto *literal = std::get_if<TensorLiteral>(&expression.operation)) {
      if (expression.type.array) {
        if (!expression.type.shape[0].constant ||
            *expression.type.shape[0].constant != literal->elements.size())
          return "array literal length mismatch";
        for (auto id : literal->elements) {
          const auto &element = module.expressions[id].type;
          if (element.tensor || element.task || element.fallible || element.device ||
              element.builtin != BuiltinValue::Numeric ||
              element.element != expression.type.element)
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
            type.array != expression.type.array ||
            type.shape.size() != expression.type.shape.size() ||
            type.device != expression.type.device ||
            (type.builtin == BuiltinValue::Numeric && type.element != expression.type.element))
          return "conditional branch result type mismatch";
      }
    }
    if (const auto *comparison = std::get_if<ScalarCompare>(&expression.operation)) {
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
      if (target != NumericTarget::Cpu || !ordinary(a) || !ordinary(b) ||
          !ordinary(expression.type) || expression.type.builtin != BuiltinValue::Bool ||
          (!numeric && !boolean) ||
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
            if constexpr (std::is_same_v<T, BoolLiteral>)
              out << (operation.value ? "true" : "false");
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
