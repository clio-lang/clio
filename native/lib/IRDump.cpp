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
  if (type.builtin == BuiltinValue::Device)
    return type.device ? "Device[gpu:" + std::to_string(*type.device) + "]" : "Device[cpu]";
  if (type.builtin != BuiltinValue::Numeric)
    return type.builtin == BuiltinValue::TaskError   ? "TaskError"
           : type.builtin == BuiltinValue::FaultKind ? "FaultKind"
                                                     : "String";
  const auto description = describeNumeric(type.element);
  const auto name = description ? std::string(description->name) : "<invalid numeric type>";
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
    if (type.builtin != BuiltinValue::Numeric || numericArithmeticAvailable(type.element, target))
      return {};
    const auto description = describeNumeric(type.element);
    return "numeric type '" + (description ? std::string(description->name) : "<invalid>") +
           "' is not implemented by the " + (target == NumericTarget::Cpu ? "CPU" : "Apple GPU") +
           " backend";
  };
  for (const auto &fn : module.functions) {
    if (auto failure = error(fn.resultType))
      return failure;
    if (fn.declaredResult)
      if (auto failure = error(*fn.declaredResult))
        return failure;
  }
  for (const auto &symbol : module.symbols)
    if (auto failure = error(symbol.type))
      return failure;
  for (const auto &expression : module.expressions)
    if (auto failure = error(expression.type))
      return failure;
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
            if constexpr (std::is_same_v<T, Float32Literal>)
              out << "f32.bits 0x" << std::hex << std::setw(8) << std::setfill('0')
                  << operation.bits << std::dec;
            else if constexpr (std::is_same_v<T, SymbolRead>)
              out << "read $" << operation.symbol;
            else if constexpr (std::is_same_v<T, ScalarUnary>) {
              out << (operation.operation == TokenKind::Minus ? "neg.f32 " : "pos.f32 ");
              value(operation.operand);
            } else if constexpr (std::is_same_v<T, TensorUnary>) {
              out << "elementwise neg.f32 exact_sign_bit ";
              value(operation.operand);
            } else if constexpr (std::is_same_v<T, ScalarBinary> ||
                                 std::is_same_v<T, TensorBinary>) {
              const char *name = operation.operation == TokenKind::Plus    ? "add.f32"
                                 : operation.operation == TokenKind::Minus ? "sub.f32"
                                 : operation.operation == TokenKind::Star  ? "mul.f32"
                                                                           : "div.f32";
              if constexpr (std::is_same_v<T, TensorBinary>)
                out << "elementwise ";
              out << name << " strict ";
              value(operation.left);
              out << ", ";
              value(operation.right);
            } else if constexpr (std::is_same_v<T, TensorLiteral>) {
              out << "tensor.literal row_major ";
              arguments(operation.elements);
            } else if constexpr (std::is_same_v<T, FunctionCall>) {
              out << "call @" << operation.function;
              arguments(operation.arguments);
            } else if constexpr (std::is_same_v<T, Matmul>) {
              out << "matmul strict_f32 balanced_adjacent separately_rounded_products ";
              value(operation.left);
              out << ", ";
              value(operation.right);
              out << " check_inner=" << operation.checkInnerExtent
                  << " check_allocation=" << operation.checkAllocationSize;
            } else if constexpr (std::is_same_v<T, ReduceSum>) {
              out << "reduceSum strict_f32 balanced_adjacent row_major ";
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
