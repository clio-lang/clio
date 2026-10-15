#include "kalandra/Semantics.h"
#include "llvm/ADT/APFloat.h"
#include "llvm/Support/Error.h"
#include <algorithm>
#include <limits>
#include <unordered_map>
#include <unordered_set>

namespace kalandra {
namespace {
class Checker {
  enum class State { Unseen, Checking, Complete, Failed };
  struct TaskChecks {
    std::unordered_map<std::size_t, std::vector<ValueId>> children;
    std::unordered_set<std::size_t> observed, pending, handled;
  };
  struct Frame {
    FunctionId function;
    std::unordered_map<std::string, SymbolId> locals;
    std::size_t depth = 0;
    std::shared_ptr<TaskChecks> tasks = std::make_shared<TaskChecks>();
    std::vector<std::size_t> groups;
    std::shared_ptr<bool> handlerFallible;
    std::size_t handlerDepth = 0;
    bool conditional = false;
  };
  struct TensorData {
    std::vector<std::uint64_t> shape;
    std::vector<ExprId> leaves;
  };

public:
  Checker(Module syntax, SemanticLimits limits) : syntax_(std::move(syntax)), limits_(limits) {
    output_.source = syntax_.source;
    output_.functions.resize(syntax_.functions.size());
    states_.resize(syntax_.functions.size(), State::Unseen);
    signatures_.resize(syntax_.functions.size(), true);
    requirements_.resize(syntax_.functions.size());
    literal_.resize(syntax_.expressions.size());
    // AST children precede their parent. Compute literal-only context eligibility
    // once, without recursive probing or quadratic walks over long chains.
    for (ExprId id = 0; id < syntax_.expressions.size(); ++id) {
      const auto &value = syntax_.expressions[id].value;
      if (std::holds_alternative<NumberExpr>(value))
        literal_[id] = true;
      else if (const auto *unary = std::get_if<UnaryExpr>(&value))
        literal_[id] = literal_[unary->operand];
      else if (const auto *binary = std::get_if<BinaryExpr>(&value))
        literal_[id] = binary->operation != TokenKind::Arrow && literal_[binary->left] &&
                       literal_[binary->right];
    }
  }
  CheckResult run() {
    registerSignatures();
    for (FunctionId i = 0;
         i < syntax_.functions.size() && diagnostics_.size() < limits_.maxDiagnostics; ++i)
      analyzeFunction(i);
    if (!diagnostics_.empty())
      return {syntax_.source, {}, std::move(diagnostics_)};
    return {syntax_.source, std::move(output_), {}};
  }

private:
  std::string name(SourceSpan span) const { return std::string(syntax_.source->slice(span)); }
  void error(std::string code, std::string message, SourceSpan span) {
    ++errorCount_;
    if (diagnostics_.size() < limits_.maxDiagnostics)
      diagnostics_.push_back({std::move(code), std::move(message), span});
  }
  Extent dynamic() { return {{}, nextExtent_++}; }
  bool same(const Extent &a, const Extent &b) const {
    if (a.constant && b.constant)
      return a.constant == b.constant;
    return !a.constant && !b.constant && a.identity && a.identity == b.identity;
  }
  bool parameterExtent(FunctionId function, const Extent &extent) const {
    if (extent.constant)
      return true;
    for (auto parameter : output_.functions[function].parameters)
      for (const auto &dimension : output_.symbols[parameter].type.shape)
        if (!dimension.constant && dimension.identity == extent.identity)
          return true;
    return false;
  }
  bool requireEqual(Frame &frame, const Extent &left, const Extent &right) {
    if (++shapeWork_ > limits_.maxShapeRequirements) {
      error("S034", "shape requirement analysis limit exceeded",
            syntax_.functions[frame.function].name);
      return false;
    }
    if (frame.conditional || same(left, right) || !parameterExtent(frame.function, left) ||
        !parameterExtent(frame.function, right))
      return true;
    const auto key = [](const Extent &dimension) {
      return dimension.constant ? "c" + std::to_string(*dimension.constant)
                                : "d" + std::to_string(dimension.identity);
    };
    const auto a = key(left), b = key(right);
    const auto pair = a < b ? a + ":" + b : b + ":" + a;
    if (requirements_[frame.function].insert(pair).second)
      output_.functions[frame.function].preconditions.push_back({left, right});
    return true;
  }
  bool validSize(const ValueType &type, SourceSpan span) {
    if (!type.tensor)
      return true;
    constexpr auto maximum = static_cast<std::uint64_t>(std::numeric_limits<std::int64_t>::max());
    bool allKnown = true;
    bool zero = false;
    for (const auto &dimension : type.shape) {
      if (dimension.constant && *dimension.constant > maximum) {
        error("S001", "tensor extent exceeds the supported 64-bit indexing range", span);
        return false;
      }
      allKnown &= dimension.constant.has_value();
      zero |= dimension.constant == 0;
    }
    if (!allKnown || zero)
      return true;
    std::uint64_t count = 1;
    for (const auto &dimension : type.shape) {
      if (*dimension.constant > maximum / count) {
        error("S002", "tensor element-count product overflows the indexing range", span);
        return false;
      }
      count *= *dimension.constant;
    }
    if (count > maximum / sizeof(float)) {
      error("S002", "tensor allocation byte count overflows the supported range", span);
      return false;
    }
    return true;
  }
  bool dynamicSize(const ValueType &type) const {
    return type.tensor &&
           std::ranges::any_of(type.shape, [](const auto &d) { return !d.constant; });
  }
  std::optional<ValueType> type(const TypeSyntax &syntax) {
    if ((!syntax.tensor && name(syntax.name) != "float32") ||
        (syntax.tensor && (!syntax.element || name(*syntax.element) != "float32"))) {
      error("S003", "only float32 and Tensor[float32,...] are implemented in this semantic subset",
            syntax.span);
      return {};
    }
    ValueType result{syntax.tensor, {}};
    for (const auto &dimension : syntax.dimensions)
      result.shape.push_back(dimension.extent ? Extent{dimension.extent, 0} : dynamic());
    if (!validSize(result, syntax.span))
      return {};
    return result;
  }
  void registerSignatures() {
    for (FunctionId id = 0; id < syntax_.functions.size(); ++id) {
      const auto &function = syntax_.functions[id];
      auto &target = output_.functions[id];
      target.name = name(function.name);
      target.declaration = function.name;
      if (!functions_.emplace(target.name, id).second) {
        error("S004", "duplicate function '" + target.name + "'", function.name);
        signatures_[id] = false;
      }
      std::unordered_map<std::string, bool> parameters;
      for (const auto &parameter : function.parameters) {
        const auto parameterName = name(parameter.name);
        if (!parameters.emplace(parameterName, true).second) {
          error("S005", "duplicate parameter '" + parameterName + "'", parameter.name);
          signatures_[id] = false;
        }
        auto parameterType = type(parameter.type);
        if (!parameterType) {
          signatures_[id] = false;
          continue;
        }
        target.parameters.push_back(output_.symbols.size());
        output_.symbols.push_back(
            {parameterName, std::move(*parameterType), parameter.name, id, true});
      }
      if (function.result) {
        target.declaredResult = type(*function.result);
        if (!target.declaredResult)
          signatures_[id] = false;
        else
          target.declaredResult->fallible = function.taskError;
      }
    }
  }
  bool analyzeFunction(FunctionId id) {
    if (states_[id] == State::Complete)
      return true;
    if (states_[id] == State::Failed)
      return false;
    if (states_[id] == State::Checking) {
      if (!output_.functions[id].declaredResult) {
        error("S006", "recursive return inference requires an explicit return annotation",
              syntax_.functions[id].name);
        return false;
      }
      return true;
    }
    if (!signatures_[id]) {
      states_[id] = State::Failed;
      return false;
    }
    if (functionDepth_ >= limits_.maxDepth) {
      error("S007", "function analysis depth limit exceeded", syntax_.functions[id].name);
      states_[id] = State::Failed;
      return false;
    }
    ++functionDepth_;
    states_[id] = State::Checking;
    Frame frame{id, {}, 0, std::make_shared<TaskChecks>(), {}, {}, 0, false};
    for (auto parameter : output_.functions[id].parameters)
      frame.locals.emplace(output_.symbols[parameter].name, parameter);
    const auto initialErrors = errorCount_;
    bool success = true;
    const auto &body = syntax_.functions[id].body;
    for (std::size_t index = 0; index < body.size() && diagnostics_.size() < limits_.maxDiagnostics;
         ++index) {
      const auto &statement = body[index];
      std::optional<ValueType> expected;
      if (statement.annotation) {
        expected = type(*statement.annotation);
        if (!expected) {
          success = false;
          continue;
        }
      } else if (index + 1 == body.size() && !statement.binding)
        expected = output_.functions[id].declaredResult;
      auto value = expression(frame, statement.expression, expected);
      std::optional<SymbolId> symbol;
      if (statement.binding) {
        const auto bindingName = name(*statement.binding);
        // The initializer is checked before this name is introduced.
        if (frame.locals.contains(bindingName)) {
          error("S008", "duplicate binding '" + bindingName + "'; bindings are immutable",
                *statement.binding);
          success = false;
        } else if (value) {
          symbol = output_.symbols.size();
          output_.symbols.push_back(
              {bindingName, node(*value).type, *statement.binding, id, false});
          frame.locals.emplace(bindingName, *symbol);
        }
      }
      if (!value) {
        success = false;
        continue;
      }
      output_.functions[id].body.push_back({statement.span, symbol, *value});
      if (index + 1 == body.size()) {
        output_.functions[id].result = *value;
        output_.functions[id].resultType = node(*value).type;
        if (node(*value).type.task)
          error("S035", "task handles cannot escape their owning parallel group", statement.span);
        if (node(*value).type.fallible) {
          frame.tasks->handled.insert(node(*value).type.identity);
          if (!syntax_.functions[id].taskError)
            error("S036", "a fallible function must declare its TaskError return channel",
                  statement.span);
        }
      }
    }
    if (syntax_.functions[id].taskError)
      output_.functions[id].resultType.fallible = true;
    for (auto pending : frame.tasks->pending)
      if (!frame.tasks->handled.contains(pending))
        error("S036", "expected task error must be propagated with try or returned",
              syntax_.functions[id].name);
    --functionDepth_;
    // Any diagnostic means no module is published; success still tracks failed
    // dependencies even once the bounded diagnostic sink is full.
    success &= initialErrors == errorCount_;
    states_[id] = success ? State::Complete : State::Failed;
    return success;
  }
  const TypedExpr &node(ValueId id) const { return output_.expressions[id]; }
  template <class Operation>
  std::optional<ValueId> add(Frame &frame, ValueType type, SourceSpan span, Operation operation) {
    if (output_.expressions.size() >= limits_.maxValues) {
      error("S009", "typed value limit exceeded", span);
      return {};
    }
    const auto id = output_.expressions.size();
    if ((type.task || type.fallible) && !type.identity) {
      type.identity = id + 1;
      if (type.fallible && !type.task)
        frame.tasks->pending.insert(type.identity);
    }
    output_.expressions.push_back({span, std::move(type), std::move(operation)});
    output_.functions[frame.function].expressions.push_back(id);
    return id;
  }
  std::optional<ValueId> conform(Frame &frame, ValueId value, const ValueType &expected,
                                 SourceSpan span) {
    auto actual = node(value).type;
    if (actual.task || expected.task) {
      error("S035", "a task handle cannot be used as a value or escape its group", span);
      return {};
    }
    if (actual.fallible && !expected.fallible) {
      error("S036", "expected task error requires try before using the success value", span);
      return {};
    }
    if (actual.builtin != expected.builtin || actual.tensor != expected.tensor ||
        actual.shape.size() != expected.shape.size()) {
      error("S010", "expected " + describeType(expected) + ", got " + describeType(actual), span);
      return {};
    }
    std::vector<ExtentRequirement> checks;
    for (std::size_t axis = 0; axis < actual.shape.size(); ++axis) {
      if (!expected.shape[axis].constant)
        continue;
      if (actual.shape[axis].constant &&
          actual.shape[axis].constant != expected.shape[axis].constant) {
        error("S011",
              "tensor extent mismatch at axis " + std::to_string(axis) + ": expected " +
                  std::to_string(*expected.shape[axis].constant) + ", got " +
                  std::to_string(*actual.shape[axis].constant),
              span);
        return {};
      }
      if (!actual.shape[axis].constant) {
        if (!requireEqual(frame, actual.shape[axis], expected.shape[axis]))
          return {};
        checks.push_back({axis, *expected.shape[axis].constant});
        actual.shape[axis] = expected.shape[axis];
      }
    }
    if (checks.empty())
      return value;
    return add(frame, std::move(actual), span, ShapeCheck{value, std::move(checks)});
  }
  struct Depth {
    std::size_t &value;
    explicit Depth(std::size_t &value) : value(value) { ++value; }
    ~Depth() { --value; }
  };
  std::optional<ValueId> expression(Frame &frame, ExprId id,
                                    std::optional<ValueType> expected = {}) {
    if (diagnostics_.size() >= limits_.maxDiagnostics)
      return {};
    if (frame.depth >= limits_.maxDepth) {
      error("S012", "semantic expression depth limit exceeded", syntax_.expressions[id].span);
      return {};
    }
    const Depth guard(frame.depth);
    const auto &syntax = syntax_.expressions[id];
    auto value = std::visit(
        [&](const auto &operation) { return infer(frame, syntax.span, operation, expected); },
        syntax.value);
    if (value && expected)
      return conform(frame, *value, *expected, syntax.span);
    return value;
  }
  std::optional<ValueId> infer(Frame &frame, SourceSpan span, const NumberExpr &literal,
                               const std::optional<ValueType> &expected) {
    if (!expected || expected->tensor || expected->builtin != BuiltinValue::Numeric) {
      error("S013",
            "unconstrained numeric literals use int64/float64; add float32 context for this first "
            "subset",
            span);
      return {};
    }
    llvm::APFloat value(llvm::APFloat::IEEEsingle());
    const auto text = syntax_.source->slice(literal.literal);
    if (text.size() > limits_.maxLiteralBytes) {
      error("S032", "numeric literal exceeds the semantic size limit", span);
      return {};
    }
    auto status = value.convertFromString(llvm::StringRef(text.data(), text.size()),
                                          llvm::APFloat::rmNearestTiesToEven);
    if (!status) {
      llvm::consumeError(status.takeError());
      error("S014", "invalid float32 literal", span);
      return {};
    }
    if ((*status & llvm::APFloat::opOverflow) || !value.isFinite()) {
      error("S015", "finite literal overflows float32", span);
      return {};
    }
    return add(frame, {}, span,
               Float32Literal{static_cast<std::uint32_t>(value.bitcastToAPInt().getZExtValue())});
  }
  std::optional<ValueId> infer(Frame &frame, SourceSpan span, const NameExpr &read,
                               const std::optional<ValueType> &) {
    const auto identifier = name(read.name);
    if (auto found = frame.locals.find(identifier); found != frame.locals.end())
      return add(frame, output_.symbols[found->second].type, span, SymbolRead{found->second});
    error("S016",
          functions_.contains(identifier)
              ? "function values are not implemented; call '" + identifier + "'"
              : "unknown value '" + identifier + "'",
          read.name);
    return {};
  }
  std::optional<ValueId> infer(Frame &frame, SourceSpan span, const UnaryExpr &unary,
                               const std::optional<ValueType> &expected) {
    auto operand = expression(frame, unary.operand, expected);
    if (!operand)
      return {};
    if (unary.operation == TokenKind::Plus && node(*operand).type.tensor &&
        !node(*operand).type.task && !node(*operand).type.fallible &&
        node(*operand).type.builtin == BuiltinValue::Numeric)
      return operand;
    if (node(*operand).type.tensor || node(*operand).type.task || node(*operand).type.fallible ||
        node(*operand).type.builtin != BuiltinValue::Numeric) {
      error("S017", "arithmetic requires completed float32 scalar values", span);
      return {};
    }
    return add(frame, {}, span, ScalarUnary{unary.operation, *operand});
  }
  std::optional<ValueId> infer(Frame &frame, SourceSpan span, const BinaryExpr &binary,
                               const std::optional<ValueType> &expected) {
    if (binary.operation == TokenKind::Arrow) {
      const auto &right = syntax_.expressions[binary.right];
      if (const auto *target = std::get_if<NameExpr>(&right.value))
        return invoke(frame, span, target->name, {binary.left}, expected);
      if (const auto *target = std::get_if<CallExpr>(&right.value)) {
        const auto *callee = std::get_if<NameExpr>(&syntax_.expressions[target->callee].value);
        if (callee) {
          std::vector<ExprId> arguments{binary.left};
          arguments.insert(arguments.end(), target->arguments.begin(), target->arguments.end());
          return invoke(frame, span, callee->name, arguments, expected);
        }
      }
      error("S018", "pipeline requires a named function or named call in this subset", right.span);
      return {};
    }
    if (binary.operation == TokenKind::Percent) {
      error("S019", "'%' requires integers, which are not implemented in this float32 subset",
            span);
      return {};
    }
    const auto operand = [&](ExprId id, std::optional<ValueType> context) {
      if (literal_[id]) {
        if (context && context->tensor && context->builtin == BuiltinValue::Numeric)
          context = ValueType{};
        return expression(frame, id, context);
      }
      const auto *call = std::get_if<CallExpr>(&syntax_.expressions[id].value);
      const auto *callee =
          call ? std::get_if<NameExpr>(&syntax_.expressions[call->callee].value) : nullptr;
      if (callee && name(callee->name) == "tensor")
        return expression(frame, id, context);
      return expression(frame, id);
    };
    std::optional<ValueId> left, right;
    if (expected && !expected->tensor) {
      left = expression(frame, binary.left, expected);
      right = expression(frame, binary.right, expected);
    } else if (literal_[binary.left] && !literal_[binary.right]) {
      right = operand(binary.right, expected);
      if (right)
        left = operand(binary.left, node(*right).type);
    } else {
      left = operand(binary.left, expected);
      if (left)
        right = operand(binary.right, node(*left).type);
    }
    if (!left || !right)
      return {};
    const auto a = node(*left).type, b = node(*right).type;
    if (a.task || b.task || a.fallible || b.fallible || a.builtin != BuiltinValue::Numeric ||
        b.builtin != BuiltinValue::Numeric) {
      error("S017", "arithmetic requires completed float32 values", span);
      return {};
    }
    if (a.tensor || b.tensor) {
      if (binary.operation != TokenKind::Plus && binary.operation != TokenKind::Star) {
        error("S017", "elementwise float32 arithmetic currently supports only + and *", span);
        return {};
      }
      auto result = a.tensor ? a : b;
      if (a.tensor && b.tensor) {
        if (a.shape.size() != b.shape.size()) {
          error("S017", "elementwise operands must have equal ranks", span);
          return {};
        }
        for (std::size_t axis = 0; axis < a.shape.size(); ++axis) {
          if (a.shape[axis].constant && b.shape[axis].constant &&
              a.shape[axis].constant != b.shape[axis].constant) {
            error("S011", "elementwise operand extents differ", span);
            return {};
          }
          if (!requireEqual(frame, a.shape[axis], b.shape[axis]))
            return {};
          if (b.shape[axis].constant)
            result.shape[axis] = b.shape[axis];
        }
      }
      if (!validSize(result, span))
        return {};
      return add(frame, result, span, TensorBinary{binary.operation, *left, *right});
    }
    return add(frame, {}, span, ScalarBinary{binary.operation, *left, *right});
  }
  std::optional<ValueId> infer(Frame &frame, SourceSpan span, const CallExpr &call,
                               const std::optional<ValueType> &expected) {
    const auto *callee = std::get_if<NameExpr>(&syntax_.expressions[call.callee].value);
    if (!callee) {
      error("S020", "only statically named calls are implemented in this subset", span);
      return {};
    }
    return invoke(frame, span, callee->name, call.arguments, expected);
  }
  std::optional<ValueId> infer(Frame &, SourceSpan span, const ArrayExpr &,
                               const std::optional<ValueType> &) {
    error("S021", "general array values are not implemented; use tensor(...) with float32 context",
          span);
    return {};
  }
  std::optional<ValueId> infer(Frame &frame, SourceSpan span, const TaskExpr &operation,
                               const std::optional<ValueType> &expected) {
    if (operation.placement) {
      error("S045",
            "placed calls require the optional Metal source compiler; CPU lowering does not ignore "
            "placement",
            span);
      return {};
    }
    if (operation.prefix == TaskPrefix::Spawn && frame.groups.empty()) {
      error("S037", "spawn requires an owning parallel group", span);
      return {};
    }
    if (operation.prefix == TaskPrefix::Spawn &&
        !std::holds_alternative<CallExpr>(syntax_.expressions[operation.operand].value)) {
      error("S037", "spawn requires a statically named invocation", span);
      return {};
    }
    std::optional<ValueType> context;
    if (operation.prefix == TaskPrefix::Try && expected) {
      context = *expected;
      context->fallible = true;
    }
    auto value = expression(frame, operation.operand, context);
    if (!value)
      return {};
    auto result = node(*value).type;
    if (operation.prefix == TaskPrefix::Spawn) {
      if (!std::holds_alternative<FunctionCall>(node(*value).operation) &&
          !std::holds_alternative<Matmul>(node(*value).operation) &&
          !std::holds_alternative<ReduceSum>(node(*value).operation)) {
        error("S037", "this invocation is not a supported task entry", span);
        return {};
      }
      if (result.fallible)
        frame.tasks->handled.insert(result.identity);
      result.task = true;
      result.identity = 0;
      auto task = add(frame, result, span, TaskOperation{operation.prefix, *value});
      if (task)
        frame.tasks->children[frame.groups.back()].push_back(*task);
      return task;
    }
    if (operation.prefix == TaskPrefix::Await) {
      if (!result.task) {
        error("S037", "await requires a task handle", span);
        return {};
      }
      frame.tasks->observed.insert(result.identity);
      result.task = false;
      result.fallible = true;
      result.identity = 0;
      return add(frame, result, span, TaskOperation{operation.prefix, *value});
    }
    if (result.task || !result.fallible) {
      error("S036", "try requires an expected-error result", span);
      return {};
    }
    if (frame.groups.empty() && !frame.handlerFallible &&
        !syntax_.functions[frame.function].taskError) {
      error("S036", "try propagation requires a TaskError return channel or parallel boundary",
            span);
      return {};
    }
    if (frame.handlerFallible && frame.groups.size() == frame.handlerDepth)
      *frame.handlerFallible = true;
    frame.tasks->handled.insert(result.identity);
    result.fallible = false;
    result.identity = 0;
    return add(frame, result, span, TaskOperation{operation.prefix, *value});
  }
  std::optional<ValueId> infer(Frame &frame, SourceSpan span, const ParallelExpr &block,
                               const std::optional<ValueType> &expected) {
    Frame nested = frame;
    const auto group = nextGroup_++;
    nested.groups.push_back(group);
    std::vector<TypedStatement> statements;
    std::unordered_set<std::string> bindings;
    std::optional<ValueId> result;
    for (std::size_t index = 0; index < block.body.size(); ++index) {
      const auto &statement = block.body[index];
      std::optional<ValueType> context;
      if (statement.annotation)
        context = type(*statement.annotation);
      else if (index + 1 == block.body.size() && expected) {
        context = *expected;
        context->task = context->fallible = false;
        context->identity = 0;
      }
      auto value = expression(nested, statement.expression, context);
      if (!value)
        return {};
      std::optional<SymbolId> symbol;
      if (statement.binding) {
        auto binding = name(*statement.binding);
        if (!bindings.insert(binding).second) {
          error("S008", "duplicate immutable binding", *statement.binding);
          return {};
        }
        symbol = output_.symbols.size();
        output_.symbols.push_back(
            {binding, node(*value).type, *statement.binding, frame.function, false});
        nested.locals[binding] = *symbol;
      }
      statements.push_back({statement.span, symbol, *value});
      result = value;
    }
    if (!result)
      return {};
    for (auto child : frame.tasks->children[group])
      if (!frame.tasks->observed.contains(node(child).type.identity))
        error("S038", "every child result must be observed on a successful group path",
              node(child).span);
    auto resultType = node(*result).type;
    if (resultType.task || resultType.fallible) {
      error("S035", "parallel body must produce a completed value; use try await", span);
      return {};
    }
    resultType.fallible = true;
    resultType.identity = 0;
    return add(frame, resultType, span, ParallelOperation{std::move(statements), *result, group});
  }
  // Branch-local obligations must be discharged on the path which creates
  // them. Conditional observation cannot discharge an incoming obligation.
  void finishBranch(const TaskChecks &before, Frame &branch, ValueId result, SourceSpan span) {
    if (node(result).type.fallible)
      branch.tasks->handled.insert(node(result).type.identity);
    for (auto pending : branch.tasks->pending)
      if (!before.pending.contains(pending) && !branch.tasks->handled.contains(pending))
        error("S036", "branch discards an expected error", span);
    for (const auto &[group, children] : branch.tasks->children) {
      auto old = before.children.find(group);
      for (auto child : children) {
        const bool incoming = old != before.children.end() &&
                              std::ranges::find(old->second, child) != old->second.end();
        if (!incoming && !branch.tasks->observed.contains(node(child).type.identity))
          error("S038", "branch leaves an unobserved child", span);
      }
    }
  }
  std::optional<ValueId> suite(Frame &frame, const std::vector<Statement> &body,
                               std::optional<ValueType> context,
                               std::vector<TypedStatement> &statements,
                               const std::unordered_set<std::string> &introduced = {}) {
    auto bindings = introduced;
    std::optional<ValueId> result;
    for (std::size_t index = 0; index < body.size(); ++index) {
      const auto &statement = body[index];
      auto expected = index + 1 == body.size() ? context : std::optional<ValueType>{};
      if (statement.annotation) {
        expected = type(*statement.annotation);
        if (!expected)
          return {};
      }
      auto value = expression(frame, statement.expression, expected);
      if (!value)
        return {};
      std::optional<SymbolId> symbol;
      if (statement.binding) {
        auto binding = name(*statement.binding);
        if (!bindings.insert(binding).second) {
          error("S008", "duplicate immutable binding", *statement.binding);
          return {};
        }
        symbol = output_.symbols.size();
        output_.symbols.push_back(
            {binding, node(*value).type, *statement.binding, frame.function, false});
        frame.locals[binding] = *symbol;
      }
      statements.push_back({statement.span, symbol, *value});
      result = value;
    }
    return result;
  }
  std::optional<ValueId> infer(Frame &frame, SourceSpan span, const CatchExpr &handler,
                               const std::optional<ValueType> &expected) {
    auto context = expected;
    if (context)
      context->fallible = true;
    auto operand = expression(frame, handler.operand, context);
    if (!operand)
      return {};
    auto resultType = node(*operand).type;
    if (resultType.task || !resultType.fallible) {
      error("S039", "catch requires a completed expected-error result", span);
      return {};
    }
    frame.tasks->handled.insert(resultType.identity);
    const auto before = *frame.tasks;
    auto nested = frame;
    nested.tasks = std::make_shared<TaskChecks>(before);
    nested.handlerFallible = std::make_shared<bool>(false);
    nested.handlerDepth = nested.groups.size();
    nested.conditional = true;
    ValueType errorType;
    errorType.builtin = BuiltinValue::TaskError;
    const auto symbol = output_.symbols.size();
    output_.symbols.push_back(
        {name(handler.parameter), errorType, handler.parameter, frame.function, true});
    nested.locals[name(handler.parameter)] = symbol;
    std::vector<TypedStatement> body;
    auto handlerContext = resultType;
    // The success path's inferred extent is not a constraint on a fallback.
    // Preserve explicit outer constraints; otherwise join differing extents.
    if (expected)
      handlerContext.shape = expected->shape;
    else
      for (auto &dimension : handlerContext.shape)
        dimension = dynamic();
    auto result = suite(nested, handler.body, handlerContext, body, {name(handler.parameter)});
    if (!result)
      return {};
    finishBranch(before, nested, *result, span);
    const auto handlerType = node(*result).type;
    for (std::size_t axis = 0; axis < resultType.shape.size(); ++axis)
      if (!same(resultType.shape[axis], handlerType.shape[axis]))
        resultType.shape[axis] = dynamic();
    resultType.fallible = handlerType.fallible || *nested.handlerFallible;
    resultType.identity = 0;
    return add(frame, resultType, span, CatchOperation{*operand, symbol, std::move(body), *result});
  }
  std::optional<ValueId> infer(Frame &frame, SourceSpan span, const FailExpr &failure,
                               const std::optional<ValueType> &expected) {
    auto value = expression(frame, failure.operand);
    if (!value)
      return {};
    if (node(*value).type.builtin != BuiltinValue::TaskError || node(*value).type.fallible ||
        node(*value).type.task) {
      error("S039", "fail requires a typed TaskError value", span);
      return {};
    }
    if (!expected || expected->builtin != BuiltinValue::Numeric || expected->task) {
      error("S039", "fail needs a concrete success-type context in this subset", span);
      return {};
    }
    if (frame.groups.empty() && !frame.handlerFallible &&
        !syntax_.functions[frame.function].taskError) {
      error("S036", "fail requires a fallible function, handler, or parallel boundary", span);
      return {};
    }
    if (frame.handlerFallible && frame.groups.size() == frame.handlerDepth)
      *frame.handlerFallible = true;
    auto result = *expected;
    result.fallible = true;
    result.identity = 0;
    return add(frame, result, span, FailOperation{*value});
  }
  std::optional<ValueId> infer(Frame &frame, SourceSpan span, const MatchExpr &match,
                               const std::optional<ValueType> &expected) {
    auto subject = expression(frame, match.subject);
    if (!subject)
      return {};
    const auto subjectType = node(*subject).type;
    const bool taskError = subjectType.builtin == BuiltinValue::TaskError;
    if ((!taskError && subjectType.builtin != BuiltinValue::FaultKind) || subjectType.task ||
        subjectType.fallible) {
      error("S040", "match currently supports TaskError and FaultKind values", span);
      return {};
    }
    const std::vector<std::string> names =
        taskError
            ? std::vector<std::string>{"Fault", "Cancelled", "DeadlineExceeded",
                                       "AdmissionRejected"}
            : std::vector<std::string>{"Arithmetic", "Bounds", "Shape", "Allocation", "Native"};
    const auto family = taskError ? "TaskError" : "FaultKind";
    std::unordered_set<unsigned> seen;
    bool fallback = false;
    std::vector<MatchCase> cases;
    const auto before = *frame.tasks;
    std::vector<std::shared_ptr<TaskChecks>> paths;
    std::optional<ValueType> resultType;
    auto context = expected;
    if (context)
      context->fallible = true;
    for (const auto &arm : match.arms) {
      std::optional<unsigned> tag;
      if (arm.variant) {
        auto found = std::ranges::find(names, name(*arm.variant));
        if (name(*arm.family) != family || found == names.end()) {
          error("S040", "unknown variant for " + std::string(family), arm.span);
          return {};
        }
        tag = static_cast<unsigned>(found - names.begin()) + 1;
        if (fallback || !seen.insert(*tag).second) {
          error("S041", "duplicate or unreachable match case", arm.span);
          return {};
        }
      } else {
        if (fallback || seen.size() == names.size()) {
          error("S041", "unreachable fallback", arm.span);
          return {};
        }
        fallback = true;
      }
      auto branch = frame;
      branch.conditional = true;
      branch.tasks = std::make_shared<TaskChecks>(before);
      std::vector<TypedStatement> statements;
      std::unordered_set<std::string> fields, fieldBindings;
      for (const auto &pattern : arm.fields) {
        const auto fieldSpan = pattern.name;
        const auto field = name(fieldSpan);
        const auto binding = name(pattern.binding);
        ErrorField fieldId;
        ValueType fieldType;
        if (taskError && tag == 1 && field == "kind") {
          fieldId = ErrorField::Kind;
          fieldType.builtin = BuiltinValue::FaultKind;
        } else if (taskError && tag == 1 && field == "message") {
          fieldId = ErrorField::Message;
          fieldType.builtin = BuiltinValue::String;
        } else if (taskError && tag == 4 && field == "reason") {
          fieldId = ErrorField::Reason;
          fieldType.builtin = BuiltinValue::String;
        } else {
          error("S042", "unknown field for selected variant", fieldSpan);
          return {};
        }
        if (!fields.insert(field).second || !fieldBindings.insert(binding).second) {
          error("S042", "duplicate pattern field", fieldSpan);
          return {};
        }
        auto value = add(branch, fieldType, fieldSpan, ErrorFieldRead{*subject, fieldId});
        if (!value)
          return {};
        const auto symbol = output_.symbols.size();
        output_.symbols.push_back({binding, fieldType, pattern.binding, frame.function, false});
        branch.locals[binding] = symbol;
        statements.push_back({fieldSpan, symbol, *value});
      }
      auto value = suite(branch, arm.body, context, statements, fieldBindings);
      if (!value)
        return {};
      auto actual = node(*value).type;
      if (actual.task) {
        error("S035", "match cannot return a task handle", arm.span);
        return {};
      }
      if (resultType) {
        if (actual.builtin != resultType->builtin || actual.tensor != resultType->tensor ||
            actual.shape.size() != resultType->shape.size()) {
          error("S043", "match branches need a common success type", arm.span);
          return {};
        }
        resultType->fallible |= actual.fallible;
        for (std::size_t axis = 0; axis < actual.shape.size(); ++axis)
          if (!same(resultType->shape[axis], actual.shape[axis]))
            resultType->shape[axis] = dynamic();
      } else
        resultType = actual;
      finishBranch(before, branch, *value, arm.span);
      paths.push_back(branch.tasks);
      cases.push_back({tag, std::move(statements), *value});
    }
    if (!fallback && seen.size() != names.size()) {
      error("S044", "non-exhaustive match over " + std::string(family), span);
      return {};
    }
    for (auto pending : before.pending)
      if (std::ranges::all_of(paths, [&](const auto &p) { return p->handled.contains(pending); }))
        frame.tasks->handled.insert(pending);
    for (const auto &[group, children] : before.children)
      for (auto child : children)
        if (std::ranges::all_of(paths, [&](const auto &p) {
              return p->observed.contains(node(child).type.identity);
            }))
          frame.tasks->observed.insert(node(child).type.identity);
    resultType->identity = 0;
    return add(frame, *resultType, span, MatchOperation{*subject, std::move(cases)});
  }
  std::optional<TensorData> tensorData(ExprId id, const std::optional<ValueType> &context,
                                       std::size_t depth = 0) {
    const auto &syntax = syntax_.expressions[id];
    const auto *array = std::get_if<ArrayExpr>(&syntax.value);
    if (!array)
      return TensorData{{}, {id}};
    if (depth >= limits_.maxDepth) {
      error("S012", "tensor literal nesting limit exceeded", syntax.span);
      return {};
    }
    TensorData result{{array->elements.size()}, {}};
    if (array->elements.empty())
      return result;
    std::optional<std::vector<std::uint64_t>> inner;
    for (auto child : array->elements) {
      auto data = tensorData(child, context, depth + 1);
      if (!data)
        return {};
      if (inner && *inner != data->shape) {
        error("S023",
              "ragged tensor literal: inconsistent shape at depth " + std::to_string(depth + 1),
              syntax_.expressions[child].span);
        return {};
      }
      inner = data->shape;
      if (data->leaves.size() > limits_.maxTensorElements - result.leaves.size()) {
        error("S024", "tensor literal element limit exceeded", syntax.span);
        return {};
      }
      result.leaves.insert(result.leaves.end(), data->leaves.begin(), data->leaves.end());
    }
    result.shape.insert(result.shape.end(), inner->begin(), inner->end());
    return result;
  }
  std::optional<ValueId> tensor(Frame &frame, SourceSpan span, const std::vector<ExprId> &arguments,
                                const std::optional<ValueType> &expected) {
    if (arguments.size() != 1) {
      error("S025",
            "this tensor constructor requires one literal argument; runtime shape constructors are "
            "not implemented",
            span);
      return {};
    }
    auto data = tensorData(arguments[0], expected);
    if (!data)
      return {};
    if (data->leaves.size() > limits_.maxTensorElements) {
      error("S024", "tensor literal element limit exceeded", span);
      return {};
    }
    if (!expected || !expected->tensor) {
      error("S026", "tensor literals need Tensor[float32,...] context in this first subset", span);
      return {};
    }
    ValueType output{true, {}};
    for (auto dimension : data->shape)
      output.shape.push_back({dimension, 0});
    if (!validSize(output, span))
      return {};
    std::vector<ValueId> elements;
    for (auto leaf : data->leaves) {
      auto value = expression(frame, leaf, ValueType{});
      if (!value)
        return {};
      elements.push_back(*value);
    }
    return add(frame, std::move(output), span, TensorLiteral{std::move(elements)});
  }
  std::optional<ValueId> builtin(Frame &frame, SourceSpan span, const std::string &callee,
                                 const std::vector<ExprId> &arguments,
                                 const std::optional<ValueType> &expected) {
    if (callee == "tensor")
      return tensor(frame, span, arguments, expected);
    const auto arity = callee == "matmul" ? 2u : 1u;
    if (arguments.size() != arity) {
      error("S027", callee + " expects " + std::to_string(arity) + " arguments", span);
      return {};
    }
    auto left = expression(frame, arguments[0]);
    if (!left)
      return {};
    const auto leftType = node(*left).type;
    if (leftType.task || leftType.fallible || !leftType.tensor ||
        (callee == "matmul" && leftType.shape.size() != 2)) {
      error("S028", callee + " requires " + (callee == "matmul" ? "rank-two tensors" : "a tensor"),
            syntax_.expressions[arguments[0]].span);
      return {};
    }
    if (callee == "reduceSum")
      return add(frame, {}, span, ReduceSum{*left});
    auto right = expression(frame, arguments[1]);
    if (!right)
      return {};
    const auto rightType = node(*right).type;
    if (rightType.task || rightType.fallible || !rightType.tensor || rightType.shape.size() != 2) {
      error("S028", "matmul requires rank-two tensors", syntax_.expressions[arguments[1]].span);
      return {};
    }
    const auto &a = leftType.shape[1], &b = rightType.shape[0];
    if (a.constant && b.constant && a.constant != b.constant) {
      error("S029",
            "matmul inner extents differ: " + std::to_string(*a.constant) + " versus " +
                std::to_string(*b.constant),
            span);
      return {};
    }
    ValueType output{true, {leftType.shape[0], rightType.shape[1]}};
    if (!validSize(output, span))
      return {};
    if (!requireEqual(frame, a, b))
      return {};
    const auto sizeCheck = dynamicSize(output);
    return add(frame, std::move(output), span, Matmul{*left, *right, !same(a, b), sizeCheck});
  }
  ValueType callResult(FunctionId id, const std::vector<ValueId> &arguments) {
    const auto &function = output_.functions[id];
    auto result = states_[id] == State::Complete ? function.resultType : *function.declaredResult;
    std::unordered_map<ExtentId, Extent> substitution;
    for (std::size_t i = 0; i < arguments.size(); ++i) {
      const auto &formal = output_.symbols[function.parameters[i]].type;
      const auto &actual = node(arguments[i]).type;
      for (std::size_t axis = 0; axis < formal.shape.size(); ++axis)
        if (!formal.shape[axis].constant)
          substitution.emplace(formal.shape[axis].identity, actual.shape[axis]);
    }
    for (auto &dimension : result.shape) {
      if (dimension.constant)
        continue;
      auto found = substitution.find(dimension.identity);
      if (found == substitution.end())
        found = substitution.emplace(dimension.identity, dynamic()).first;
      dimension = found->second;
    }
    return result;
  }
  std::optional<ValueId> invoke(Frame &frame, SourceSpan span, SourceSpan calleeSpan,
                                const std::vector<ExprId> &arguments,
                                const std::optional<ValueType> &expected) {
    const auto callee = name(calleeSpan);
    if (frame.locals.contains(callee)) {
      error("S030", "local value '" + callee + "' is not callable", calleeSpan);
      return {};
    }
    auto found = functions_.find(callee);
    if (found == functions_.end()) {
      if (callee == "tensor" || callee == "matmul" || callee == "reduceSum")
        return builtin(frame, span, callee, arguments, expected);
      error("S031", "unknown function '" + callee + "'", calleeSpan);
      return {};
    }
    const auto id = found->second;
    if (!signatures_[id])
      return {};
    if (arguments.size() != output_.functions[id].parameters.size()) {
      error("S027", "wrong argument count for '" + callee + "'", span);
      return {};
    }
    if (!analyzeFunction(id))
      return {};
    std::vector<ValueId> operands;
    for (std::size_t i = 0; i < arguments.size(); ++i) {
      const auto expectedType = output_.symbols[output_.functions[id].parameters[i]].type;
      auto argument = expression(frame, arguments[i], expectedType);
      if (!argument)
        return {};
      operands.push_back(*argument);
    }
    if (states_[id] == State::Complete) {
      std::unordered_map<ExtentId, Extent> substitution;
      for (std::size_t i = 0; i < operands.size(); ++i) {
        const auto &formal = output_.symbols[output_.functions[id].parameters[i]].type;
        const auto &actual = node(operands[i]).type;
        for (std::size_t axis = 0; axis < formal.shape.size(); ++axis)
          if (!formal.shape[axis].constant)
            substitution.emplace(formal.shape[axis].identity, actual.shape[axis]);
      }
      const auto substitute = [&](Extent extent) {
        if (!extent.constant)
          extent = substitution.at(extent.identity);
        return extent;
      };
      for (const auto &requirement : output_.functions[id].preconditions) {
        const auto left = substitute(requirement.left), right = substitute(requirement.right);
        if (left.constant && right.constant && left.constant != right.constant) {
          error("S033",
                "call to '" + callee + "' violates a known tensor shape requirement: " +
                    std::to_string(*left.constant) + " versus " + std::to_string(*right.constant),
                span);
          return {};
        }
        if (!requireEqual(frame, left, right))
          return {};
      }
    }
    auto resultType = callResult(id, operands);
    resultType.fallible = syntax_.functions[id].taskError;
    resultType.identity = 0;
    if (!validSize(resultType, span))
      return {};
    return add(frame, std::move(resultType), span, FunctionCall{id, std::move(operands)});
  }
  Module syntax_;
  SemanticLimits limits_;
  TypedModule output_;
  std::unordered_map<std::string, FunctionId> functions_;
  std::vector<State> states_;
  std::vector<bool> signatures_;
  std::vector<bool> literal_;
  std::vector<std::unordered_set<std::string>> requirements_;
  std::vector<Diagnostic> diagnostics_;
  ExtentId nextExtent_ = 1;
  std::size_t functionDepth_ = 0;
  std::size_t errorCount_ = 0;
  std::size_t shapeWork_ = 0;
  std::size_t nextGroup_ = 1;
};
} // namespace
CheckResult check(ParseResult syntax, SemanticLimits limits) {
  if (!syntax.ok())
    return {syntax.module.source, {}, std::move(syntax.diagnostics)};
  limits.maxDiagnostics = std::max<std::size_t>(1, limits.maxDiagnostics);
  return Checker(std::move(syntax.module), limits).run();
}
} // namespace kalandra
