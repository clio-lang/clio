#include "kalandra/Semantics.h"
#include <iomanip>
#include <sstream>

namespace kalandra {
std::string describeType(const ValueType &type) {
  if (type.builtin != BuiltinValue::Numeric)
    return type.builtin == BuiltinValue::TaskError   ? "TaskError"
           : type.builtin == BuiltinValue::FaultKind ? "FaultKind"
                                                     : "String";
  if (!type.tensor)
    return std::string(type.task ? "task<float32>" : "float32") +
           (type.fallible ? " ! TaskError" : "");
  std::ostringstream out;
  out << "Tensor[float32";
  for (const auto &dimension : type.shape) {
    out << ", ";
    if (dimension.constant)
      out << *dimension.constant;
    else
      out << "?d" << dimension.identity;
  }
  out << ']';
  if (type.task)
    out << " task";
  if (type.fallible)
    out << " ! TaskError";
  return out.str();
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
            } else if constexpr (std::is_same_v<T, ScalarBinary>) {
              const char *name = operation.operation == TokenKind::Plus    ? "add.f32"
                                 : operation.operation == TokenKind::Minus ? "sub.f32"
                                 : operation.operation == TokenKind::Star  ? "mul.f32"
                                                                           : "div.f32";
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
            } else if constexpr (std::is_same_v<T, TaskOperation>) {
              out << (operation.prefix == TaskPrefix::Spawn   ? "task.spawn "
                      : operation.prefix == TaskPrefix::Await ? "task.await "
                                                              : "result.try ");
              value(operation.operand);
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
