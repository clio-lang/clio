#pragma once
#include "kalandra/Syntax.h"

namespace kalandra {
using ValueId = std::size_t;
using SymbolId = std::size_t;
using FunctionId = std::size_t;
using ExtentId = std::uint64_t;
struct Extent {
  std::optional<std::uint64_t> constant;
  ExtentId identity =
      0; // Nonzero identity for a dynamic extent, never an implicit equality of '?'.
};
enum class BuiltinValue { Numeric, TaskError, FaultKind, String };
struct ValueType {
  bool tensor = false;
  std::vector<Extent> shape;
  bool task = false, fallible = false;
  std::size_t identity = 0;
  BuiltinValue builtin = BuiltinValue::Numeric;
};
struct Symbol {
  std::string name;
  ValueType type;
  SourceSpan declaration;
  FunctionId owner;
  bool parameter;
};
struct Float32Literal {
  std::uint32_t bits;
};
struct SymbolRead {
  SymbolId symbol;
};
struct ScalarUnary {
  TokenKind operation;
  ValueId operand;
};
// Shape-preserving elementwise unary arithmetic on immutable float32 tensors.
struct TensorUnary {
  TokenKind operation;
  ValueId operand;
};
struct ScalarBinary {
  TokenKind operation;
  ValueId left;
  ValueId right;
};
// Elementwise strict float32 arithmetic. Scalar operands lift across the tensor;
// tensor operands require identical ranks and extents (no array broadcasting).
struct TensorBinary {
  TokenKind operation;
  ValueId left, right;
};
struct TensorLiteral {
  std::vector<ValueId> elements;
}; // Flattened row-major scalar values.
struct FunctionCall {
  FunctionId function;
  std::vector<ValueId> arguments;
};
enum class ReductionOrder { BalancedAdjacent };
struct Matmul {
  ValueId left;
  ValueId right;
  bool checkInnerExtent;
  bool checkAllocationSize; // Validate before allocation; never rely on wrapped dimension products.
  ReductionOrder order = ReductionOrder::BalancedAdjacent;
  bool separatelyRoundedProducts = true;
};
struct ReduceSum {
  ValueId input;
  ReductionOrder order = ReductionOrder::BalancedAdjacent;
  bool rowMajor = true;
};
struct ExtentRequirement {
  std::size_t axis;
  std::uint64_t extent;
};
struct ShapeCheck {
  ValueId input;
  std::vector<ExtentRequirement> requirements;
};
struct TypedStatement {
  SourceSpan span;
  std::optional<SymbolId> binding;
  ValueId value;
};
struct TaskOperation {
  TaskPrefix prefix;
  ValueId operand;
};
struct ParallelOperation {
  std::vector<TypedStatement> body;
  ValueId result;
  std::size_t group;
};
struct CatchOperation {
  ValueId operand;
  SymbolId parameter;
  std::vector<TypedStatement> body;
  ValueId result;
};
struct MatchCase {
  std::optional<unsigned> tag;
  std::vector<TypedStatement> body;
  ValueId result;
};
struct MatchOperation {
  ValueId subject;
  std::vector<MatchCase> cases;
};
enum class ErrorField { Kind, Message, Reason };
struct ErrorFieldRead {
  ValueId subject;
  ErrorField field;
};
struct FailOperation {
  ValueId error;
};
struct TypedExpr {
  SourceSpan span;
  ValueType type; // Only float32 and ranked Tensor[float32,...] in this semantic subset.
  std::variant<Float32Literal, SymbolRead, ScalarUnary, TensorUnary, ScalarBinary, TensorBinary,
               TensorLiteral, FunctionCall, Matmul, ReduceSum, ShapeCheck, TaskOperation,
               ParallelOperation, CatchOperation, MatchOperation, ErrorFieldRead, FailOperation>
      operation;
};
struct ShapeEquality {
  Extent left;
  Extent right;
};
struct TypedFunction {
  std::string name;
  SourceSpan declaration;
  std::vector<SymbolId> parameters;
  std::optional<ValueType> declaredResult;
  ValueType resultType;
  ValueId result = 0;
  std::vector<TypedStatement> body;
  std::vector<ValueId> expressions;
  std::vector<ShapeEquality> preconditions;
};
struct TypedModule {
  std::shared_ptr<const SourceFile> source;
  std::vector<Symbol> symbols;
  std::vector<TypedExpr> expressions;
  std::vector<TypedFunction> functions;
};
struct SemanticLimits {
  std::size_t maxDepth = 128;
  std::size_t maxDiagnostics = 32;
  std::size_t maxValues = 300000;
  std::size_t maxTensorElements = 200000;
  std::size_t maxLiteralBytes = 4096;
  std::size_t maxShapeRequirements = 100000;
};
struct CheckResult {
  std::shared_ptr<const SourceFile> source;
  std::optional<TypedModule> module; // Never publish partial IR on an error.
  std::vector<Diagnostic> diagnostics;
  [[nodiscard]] bool ok() const { return module.has_value(); }
};
[[nodiscard]] CheckResult check(ParseResult syntax, SemanticLimits limits = {});
[[nodiscard]] std::string describeType(const ValueType &type);
[[nodiscard]] std::string dumpTypedIR(const TypedModule &module);
} // namespace kalandra
