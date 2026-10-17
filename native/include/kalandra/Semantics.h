#pragma once
#include "kalandra/NumericType.h"
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
enum class BuiltinValue { Numeric, TaskError, FaultKind, String, Device, Bool };
struct ValueType {
  // Ranked immutable storage; arrays use rank one with a separate source category.
  bool tensor = false;
  std::vector<Extent> shape;
  bool task = false, fallible = false;
  std::size_t identity = 0;
  BuiltinValue builtin = BuiltinValue::Numeric;
  // Tensor residence, or the selection carried by a Device value. Null is CPU.
  // Scalar numeric results remain host values, including GPU reductions.
  std::optional<std::uint32_t> device = {};
  // Scalar numeric identity, or the tensor element type; irrelevant to other builtins.
  NumericType element = NumericType::Float32;
  bool array = false; // Source [T], distinct from Tensor[T,...]; never an implicit conversion.
};
struct Symbol {
  std::string name;
  ValueType type;
  SourceSpan declaration;
  FunctionId owner;
  bool parameter;
};
struct Int32Literal {
  std::int32_t value;
};
struct Int64Literal {
  std::int64_t value;
};
struct UInt64Literal {
  std::uint64_t value;
};
struct UInt32Literal {
  std::uint32_t value;
};
struct Float64Literal {
  std::uint64_t bits;
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
struct BoolLiteral {
  bool value;
};
struct ScalarCompare {
  ComparisonKind operation;
  ValueId left, right;
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
struct NumericConvert {
  ValueId input;
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
struct DeviceSelection {
  std::optional<std::uint32_t> device; // Null selects CPU; otherwise an exact GPU index.
};
struct Transfer {
  ValueId input, target;
};
struct TaskOperation {
  TaskPrefix prefix;
  ValueId operand;
  std::optional<ValueId> placement = {};
};
struct ParallelOperation {
  std::vector<TypedStatement> body;
  ValueId result;
  std::size_t group;
};
struct ConditionalOperation {
  ValueId condition;
  std::vector<TypedStatement> whenTrue, whenFalse;
  ValueId trueResult, falseResult;
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
  ValueType type; // Concrete scalar/tensor numeric identity; builtins retain explicit tags.
  std::variant<Float64Literal, Float32Literal, Int32Literal, Int64Literal, UInt32Literal,
               UInt64Literal, BoolLiteral, ScalarCompare, SymbolRead, ScalarUnary, TensorUnary,
               ScalarBinary, TensorBinary, TensorLiteral, NumericConvert, FunctionCall, Matmul,
               ReduceSum, ShapeCheck, DeviceSelection, Transfer, TaskOperation, ParallelOperation,
               ConditionalOperation, CatchOperation, MatchOperation, ErrorFieldRead, FailOperation>
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
// True for device/transfer/placed-call IR or resident/selector types.
[[nodiscard]] bool hasPlacement(const TypedModule &module);
struct CheckOptions {
  // Build placement-aware IR without probing hardware or selecting a backend.
  // The ordinary CPU entry keeps rejecting placement syntax by default.
  bool placement = false;
};
[[nodiscard]] CheckResult check(ParseResult syntax, SemanticLimits limits = {},
                                CheckOptions options = {});
[[nodiscard]] std::string describeType(const ValueType &type);
[[nodiscard]] std::string dumpTypedIR(const TypedModule &module);
// Reject unsupported numeric IR before a backend can apply float32-specific lowering.
[[nodiscard]] std::optional<std::string> numericCapabilityError(const TypedModule &module,
                                                                NumericTarget target);
} // namespace kalandra
