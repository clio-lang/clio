#include "kalandra/Semantics.h"
#include "llvm/ADT/APFloat.h"
#include "llvm/ADT/APSInt.h"
#include "llvm/Support/Error.h"
#include <algorithm>
#include <charconv>
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
  struct Frame;
  struct ClosureScope {
    Frame *parent;
    std::unordered_map<std::string, SymbolId> captures;
    std::vector<SymbolId> origins;
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
    std::shared_ptr<ClosureScope> closure = {};
  };
  struct TensorData {
    std::vector<std::uint64_t> shape;
    std::vector<ExprId> leaves;
  };

public:
  Checker(Module syntax, SemanticLimits limits, CheckOptions options)
      : syntax_(std::move(syntax)), limits_(limits), options_(options) {
    output_.source = syntax_.source;
    output_.functions.resize(syntax_.functions.size());
    states_.resize(syntax_.functions.size(), State::Unseen);
    signatures_.resize(syntax_.functions.size(), true);
    requirements_.resize(syntax_.functions.size());
    literal_.resize(syntax_.expressions.size());
    floatingLiteral_.resize(syntax_.expressions.size());
    // AST children precede their parent. Compute literal-only context eligibility
    // once, without recursive probing or quadratic walks over long chains.
    for (ExprId id = 0; id < syntax_.expressions.size(); ++id) {
      const auto &value = syntax_.expressions[id].value;
      if (const auto *number = std::get_if<NumberExpr>(&value)) {
        literal_[id] = true;
        floatingLiteral_[id] =
            syntax_.source->slice(number->literal).find_first_of(".eE") != std::string_view::npos;
      } else if (const auto *unary = std::get_if<UnaryExpr>(&value)) {
        literal_[id] = unary->operation != TokenKind::Bang && literal_[unary->operand];
        floatingLiteral_[id] = floatingLiteral_[unary->operand];
      } else if (const auto *binary = std::get_if<BinaryExpr>(&value)) {
        literal_[id] = binary->operation != TokenKind::Arrow && literal_[binary->left] &&
                       literal_[binary->right];
        floatingLiteral_[id] = floatingLiteral_[binary->left] || floatingLiteral_[binary->right];
      }
    }
  }
  CheckResult run() {
    registerSignatures();
    for (FunctionId i = 0;
         i < syntax_.functions.size() && diagnostics_.size() < limits_.maxDiagnostics; ++i)
      analyzeFunction(i);
    if (diagnostics_.empty())
      if (auto unsupported = numericCapabilityError(output_, NumericTarget::Cpu))
        error("S054", *unsupported,
              syntax_.functions.empty() ? SourceSpan{} : syntax_.functions[0].name);
    if (!diagnostics_.empty())
      return {syntax_.source, {}, std::move(diagnostics_)};
    return {syntax_.source, std::move(output_), {}};
  }

private:
  std::string name(SourceSpan span) const { return std::string(syntax_.source->slice(span)); }
  static std::string functionKey(std::size_t module, const std::string &name) {
    return std::to_string(module) + ":" + name;
  }
  std::string functionKey(const Frame &frame, const std::string &name) const {
    const Frame *owner = &frame;
    while (owner->closure)
      owner = owner->closure->parent;
    return functionKey(syntax_.functions[owner->function].moduleIndex, name);
  }
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
            output_.functions[frame.function].declaration);
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
    if (!checkedNumericBytes(type.element, count, maximum)) {
      error("S002", "tensor allocation byte count overflows the supported range", span);
      return false;
    }
    return true;
  }
  bool dynamicSize(const ValueType &type) const {
    return type.tensor &&
           std::ranges::any_of(type.shape, [](const auto &d) { return !d.constant; });
  }
  static bool reservedControl(const std::string &name) {
    return name == "true" || name == "false" || name == "if" || name == "else" || name == "and" ||
           name == "or" || name == "not";
  }
  std::optional<ValueType> type(const TypeSyntax &syntax) {
    if (!syntax.tensor && !syntax.array && name(syntax.name) == "Bool") {
      ValueType result;
      result.builtin = BuiltinValue::Bool;
      return result;
    }
    const auto numeric =
        syntax.tensor ? (syntax.element ? resolveNumeric(name(*syntax.element)) : std::nullopt)
                      : resolveNumeric(name(syntax.name));
    if (!numeric || !numericArithmeticAvailable(*numeric, NumericTarget::Cpu)) {
      error("S003",
            "implemented numeric types are int32, uint32, int64, uint64, float32 and float64 "
            "scalars/tensors and numeric arrays",
            syntax.span);
      return {};
    }
    ValueType result{syntax.tensor || syntax.array, {}};
    result.array = syntax.array;
    if (syntax.array)
      result.shape.push_back(dynamic());
    result.element = *numeric;
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
      if (target.name == "Bool" || reservedControl(target.name))
        error("S056", "reserved Boolean/control-flow name", function.name);
      if (resolveNumeric(target.name)) {
        error("S055", "numeric type names are reserved conversion functions", function.name);
        signatures_[id] = false;
      }
      if (options_.placement && (target.name == "devices" || target.name == "transfer" ||
                                 target.name == "devices.cpu" || target.name == "devices.gpu")) {
        error("S049", "reserved placement builtin name", function.name);
        signatures_[id] = false;
      }
      if (!functions_.emplace(functionKey(function.moduleIndex, target.name), id).second) {
        error("S004", "duplicate function '" + target.name + "'", function.name);
        signatures_[id] = false;
      }
      std::unordered_map<std::string, bool> parameters;
      for (const auto &parameter : function.parameters) {
        const auto parameterName = name(parameter.name);
        if (reservedControl(parameterName))
          error("S056", "Control-flow keywords cannot be parameter names", parameter.name);
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
      if (function.moduleIndex)
        target.name = "__module_" + std::to_string(function.moduleIndex) + "::" + target.name;
    }
    const auto definitions = functions_;
    for (const auto &import : syntax_.imports) {
      if (!import.target || options_.placement) {
        error("S067", "local imports require the CPU file-module loader", import.path);
        continue;
      }
      for (const auto &imported : import.names) {
        const auto binding = imported.alias.value_or(imported.name);
        const auto local = name(binding);
        if (local == "Bool" || reservedControl(local) || resolveNumeric(local)) {
          error("S067", "reserved import alias '" + local + "'", binding);
          continue;
        }
        auto found = definitions.find(functionKey(*import.target, name(imported.name)));
        if (found == definitions.end() || !syntax_.functions[found->second].exported) {
          error("S067", "module does not export function '" + name(imported.name) + "'",
                imported.name);
          continue;
        }
        if (!functions_.emplace(functionKey(import.moduleIndex, local), found->second).second)
          error("S004", "duplicate module binding '" + local + "'", binding);
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
        if (reservedControl(bindingName))
          error("S056", "Control-flow keywords cannot be binding names", *statement.binding);
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
          if (auto it = intConstants_.find(*value); it != intConstants_.end())
            intBindings_[*symbol] = it->second;
          if (auto it = floatConstants_.find(*value); it != floatConstants_.end())
            floatBindings_.insert_or_assign(*symbol, it->second);
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
        if (options_.placement && node(*value).type.tensor && node(*value).type.device)
          error("S047", "function results require an explicit transfer to devices.cpu()",
                statement.span);
        if (node(*value).type.builtin == BuiltinValue::Device)
          error("S048", "device selectors cannot escape as function results", statement.span);
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
                                 SourceSpan span, bool deferShape = false) {
    auto actual = node(value).type;
    if (actual.task || expected.task) {
      error("S035", "a task handle cannot be used as a value or escape its group", span);
      return {};
    }
    if (actual.fallible && !expected.fallible) {
      error("S036", "expected task error requires try before using the success value", span);
      return {};
    }
    if (actual.builtin != expected.builtin ||
        (actual.builtin == BuiltinValue::Numeric && actual.element != expected.element) ||
        actual.tensor != expected.tensor || actual.array != expected.array ||
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
        if (deferShape)
          continue;
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
  std::optional<ValueId> expression(Frame &frame, ExprId id, std::optional<ValueType> expected = {},
                                    bool deferShape = false) {
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
    if (value && isInteger(node(*value).type.element)) {
      const bool unsignedValue = isUnsigned(node(*value).type.element);
      const bool uint64Value = node(*value).type.element == NumericType::UInt64;
      const bool int64Value = node(*value).type.element == NumericType::Int64;
      const auto typeName = uint64Value ? "uint64" : unsignedValue ? "uint32" : int64Value ? "int64" : "int32";
      const __int128_t maximum = unsignedValue ? __int128_t(uint64Value ? UINT64_MAX : UINT32_MAX)
                                               : int64Value ? INT64_MAX : INT32_MAX;
      const __int128_t minimum = unsignedValue ? 0 : int64Value ? INT64_MIN : INT32_MIN;
      std::optional<__int128_t> constant;
      const auto &op = node(*value).operation;
      if (const auto *n = std::get_if<Int32Literal>(&op))
        constant = n->value;
      else if (const auto *n = std::get_if<Int64Literal>(&op))
        constant = n->value;
      else if (const auto *n = std::get_if<UInt32Literal>(&op))
        constant = n->value;
      else if (const auto *n = std::get_if<UInt64Literal>(&op))
        constant = n->value;
      else if (const auto *read = std::get_if<SymbolRead>(&op)) {
        if (auto it = intBindings_.find(read->symbol); it != intBindings_.end())
          constant = it->second;
      } else if (const auto *unary = std::get_if<ScalarUnary>(&op)) {
        if (auto it = intConstants_.find(unary->operand); it != intConstants_.end())
          constant = unary->operation == TokenKind::Minus ? -__int128_t(it->second) : __int128_t(it->second);
      } else if (const auto *binary = std::get_if<ScalarBinary>(&op)) {
        auto a = intConstants_.find(binary->left), b = intConstants_.find(binary->right);
        if ((binary->operation == TokenKind::Slash || binary->operation == TokenKind::Percent) &&
            b != intConstants_.end() && b->second == 0) {
          error("S052", std::string(typeName) + " division or remainder by zero", syntax.span);
          return {};
        }
        if (a != intConstants_.end() && b != intConstants_.end()) {
          switch (binary->operation) {
          case TokenKind::Plus: constant = __int128_t(a->second) + b->second; break;
          case TokenKind::Minus: constant = __int128_t(a->second) - b->second; break;
          case TokenKind::Star:
            if (unsignedValue && b->second && a->second > maximum / b->second) {
              error("S052", std::string("constant ") + typeName + " arithmetic overflows", syntax.span);
              return {};
            }
            constant = __int128_t(a->second) * b->second;
            break;
          case TokenKind::Slash: constant = __int128_t(a->second) / b->second; break;
          case TokenKind::Percent: constant = __int128_t(a->second) % b->second; break;
          default: break;
          }
        }
      }
      if (constant) {
        if (*constant < minimum || *constant > maximum) {
          error("S052", std::string("constant ") + typeName + " arithmetic overflows", syntax.span);
          return {};
        }
        intConstants_[*value] = *constant;
      }
    }
    if (value)
      floatingConstant(*value);
    if (value && expected)
      return conform(frame, *value, *expected, syntax.span, deferShape);
    return value;
  }
  std::unordered_map<ValueId, __int128_t> intConstants_;
  std::unordered_map<SymbolId, __int128_t> intBindings_;
  std::optional<ValueId> intLiteral(Frame &frame, SourceSpan span, const NumberExpr &literal,
                                    bool negative = false, NumericType element = NumericType::Int32) {
    const bool unsignedValue = isUnsigned(element);
    const bool uint64Value = element == NumericType::UInt64;
    const bool int64Value = element == NumericType::Int64;
    const auto text = syntax_.source->slice(literal.literal);
    if (text.size() > limits_.maxLiteralBytes) {
      error("S032", "numeric literal exceeds the semantic size limit", span);
      return {};
    }
    std::uint64_t magnitude = 0;
    const auto parsed = std::from_chars(text.data(), text.data() + text.size(), magnitude);
    const std::uint64_t signedMaximum = int64Value ? INT64_MAX : INT32_MAX;
    const std::uint64_t limit = unsignedValue ? (negative ? 0 : uint64Value ? UINT64_MAX : UINT32_MAX)
                                            : negative ? signedMaximum + 1 : signedMaximum;
    if (parsed.ec != std::errc{} || parsed.ptr != text.data() + text.size() || magnitude > limit) {
      error("S051", std::string(uint64Value ? "uint64" : unsignedValue ? "uint32" : int64Value ? "int64" : "int32") + " requires an in-range integer literal", span);
      return {};
    }
    if (uint64Value) {
      ValueType type;
      type.element = element;
      return add(frame, type, span, UInt64Literal{magnitude});
    }
    const auto value = negative ? (magnitude == (std::uint64_t(1) << 63) ? INT64_MIN : -static_cast<std::int64_t>(magnitude))
                                : static_cast<std::int64_t>(magnitude);
    ValueType type;
    type.element = element;
    if (int64Value)
      return add(frame, type, span, Int64Literal{value});
    if (unsignedValue)
      return add(frame, type, span, UInt32Literal{static_cast<std::uint32_t>(value)});
    return add(frame, type, span, Int32Literal{static_cast<std::int32_t>(value)});
  }
  std::optional<ValueId> infer(Frame &frame, SourceSpan span, const NumberExpr &literal,
                               const std::optional<ValueType> &context) {
    auto expected = context;
    if (!expected && syntax_.source->slice(literal.literal).find_first_of(".eE") == std::string_view::npos)
      return intLiteral(frame, span, literal, false, NumericType::Int64);
    if (!expected) {
      expected = ValueType{};
      expected->element = NumericType::Float64;
    }
    if (expected->tensor || expected->builtin != BuiltinValue::Numeric) {
      error("S013", "numeric literals require a numeric scalar context", span);
      return {};
    }
    if (isInteger(expected->element))
      return intLiteral(frame, span, literal, false, expected->element);
    const bool doubleWidth = expected->element == NumericType::Float64;
    const auto formatName = doubleWidth ? "float64" : "float32";
    llvm::APFloat value(doubleWidth ? llvm::APFloat::IEEEdouble() : llvm::APFloat::IEEEsingle());
    const auto text = syntax_.source->slice(literal.literal);
    if (text.size() > limits_.maxLiteralBytes) {
      error("S032", "numeric literal exceeds the semantic size limit", span);
      return {};
    }
    auto status = value.convertFromString(llvm::StringRef(text.data(), text.size()),
                                          llvm::APFloat::rmNearestTiesToEven);
    if (!status) {
      llvm::consumeError(status.takeError());
      error("S014", std::string("invalid ") + formatName + " literal", span);
      return {};
    }
    if ((*status & llvm::APFloat::opOverflow) || !value.isFinite()) {
      error("S015", std::string("finite literal overflows ") + formatName, span);
      return {};
    }
    ValueType output;
    output.element = expected->element;
    if (doubleWidth)
      return add(frame, output, span, Float64Literal{value.bitcastToAPInt().getZExtValue()});
    return add(frame, output, span,
               Float32Literal{static_cast<std::uint32_t>(value.bitcastToAPInt().getZExtValue())});
  }
  bool sourceTaskError(FunctionId id) const {
    return id < syntax_.functions.size() && syntax_.functions[id].taskError;
  }
  std::optional<SymbolId> lookupSymbol(Frame &frame, SourceSpan span) {
    const auto identifier = name(span);
    if (auto found = frame.locals.find(identifier); found != frame.locals.end())
      return found->second;
    if (!frame.closure)
      return {};
    if (auto found = frame.closure->captures.find(identifier);
        found != frame.closure->captures.end())
      return found->second;
    auto origin = lookupSymbol(*frame.closure->parent, span);
    if (!origin)
      return {};
    const auto capture = output_.symbols[*origin];
    const auto type = capture.type;
    if (type.task || type.fallible || type.device ||
        (type.builtin != BuiltinValue::Numeric && type.builtin != BuiltinValue::Bool)) {
      error("S060",
            "anonymous callbacks capture only completed CPU numeric collections/scalars or Bool",
            span);
      return {};
    }
    const auto symbol = output_.symbols.size();
    output_.symbols.push_back({identifier, type, span, frame.function, true});
    output_.functions[frame.function].parameters.push_back(symbol);
    frame.closure->captures.emplace(identifier, symbol);
    frame.closure->origins.push_back(*origin);
    return symbol;
  }
  std::optional<ValueId> infer(Frame &, SourceSpan span, const LambdaExpr &,
                               const std::optional<ValueType> &) {
    error("S060", "anonymous functions currently require a map callback context", span);
    return {};
  }
  std::optional<ValueId> infer(Frame &frame, SourceSpan span, const NameExpr &read,
                               const std::optional<ValueType> &) {
    const auto identifier = name(read.name);
    if (identifier == "true" || identifier == "false") {
      ValueType boolean;
      boolean.builtin = BuiltinValue::Bool;
      return add(frame, boolean, span, BoolLiteral{identifier == "true"});
    }
    if (auto found = lookupSymbol(frame, read.name))
      return add(frame, output_.symbols[*found].type, span, SymbolRead{*found});
    error("S016",
          functions_.contains(functionKey(frame, identifier))
              ? "function values are not implemented; call '" + identifier + "'"
              : "unknown value '" + identifier + "'",
          read.name);
    return {};
  }
  std::optional<ValueId> infer(Frame &frame, SourceSpan span, const UnaryExpr &unary,
                               const std::optional<ValueType> &expected) {
    if (unary.operation == TokenKind::Bang) {
      auto input = expression(frame, unary.operand);
      if (!input)
        return {};
      auto type = node(*input).type;
      if (type.builtin != BuiltinValue::Bool || type.task || type.fallible || type.tensor ||
          type.device) {
        error("S057", "not requires a completed CPU Bool", span);
        return {};
      }
      auto no = add(frame, type, span, BoolLiteral{false});
      if (!no)
        return {};
      return add(frame, type, span, ScalarCompare{ComparisonKind::Equal, *input, *no});
    }
    if ((!expected || (isInteger(expected->element) && !expected->tensor)) &&
        unary.operation == TokenKind::Minus)
      if (const auto *literal = std::get_if<NumberExpr>(&syntax_.expressions[unary.operand].value))
        if (expected ||
            syntax_.source->slice(literal->literal).find_first_of(".eE") == std::string_view::npos)
          return intLiteral(frame, span, *literal, true,
                            expected ? expected->element : NumericType::Int64);
    auto operand = expression(frame, unary.operand, expected);
    if (!operand)
      return {};
    const auto type = node(*operand).type;
    if (type.task || type.fallible || type.array || type.builtin != BuiltinValue::Numeric) {
      error("S017", "arithmetic requires completed numeric values", span);
      return {};
    }
    if (type.tensor && type.device) {
      error("S047", "host arithmetic requires an explicit transfer to devices.cpu()", span);
      return {};
    }
    if (type.tensor) {
      if (unary.operation == TokenKind::Plus)
        return operand;
      return add(frame, type, span, TensorUnary{unary.operation, *operand});
    }
    return add(frame, type, span, ScalarUnary{unary.operation, *operand});
  }
  std::optional<ValueId> infer(Frame &frame, SourceSpan span, const ComparisonExpr &comparison,
                               const std::optional<ValueType> &) {
    std::optional<ValueId> left, right;
    if (literal_[comparison.left] && !literal_[comparison.right]) {
      right = expression(frame, comparison.right);
      if (right)
        left = expression(frame, comparison.left, node(*right).type);
    } else {
      std::optional<ValueType> context;
      if (literal_[comparison.left] && literal_[comparison.right] &&
          (floatingLiteral_[comparison.left] || floatingLiteral_[comparison.right])) {
        context = ValueType{};
        context->element = NumericType::Float64;
      }
      left = expression(frame, comparison.left, context);
      if (left)
        right = expression(frame, comparison.right,
                           literal_[comparison.right] ? std::optional<ValueType>(node(*left).type)
                                                      : std::nullopt);
    }
    if (!left || !right)
      return {};
    const auto a = node(*left).type, b = node(*right).type;
    const bool numeric = a.builtin == BuiltinValue::Numeric && b.builtin == BuiltinValue::Numeric &&
                         a.element == b.element;
    const bool boolean = a.builtin == BuiltinValue::Bool && b.builtin == BuiltinValue::Bool &&
                         (comparison.operation == ComparisonKind::Equal ||
                          comparison.operation == ComparisonKind::NotEqual);
    if ((!numeric && !boolean) || a.tensor || b.tensor || a.task || b.task || a.fallible ||
        b.fallible || a.device || b.device) {
      error("S056",
            "comparison requires completed CPU scalars of the same numeric type, or Bool equality",
            span);
      return {};
    }
    ValueType result;
    result.builtin = BuiltinValue::Bool;
    return add(frame, result, span, ScalarCompare{comparison.operation, *left, *right});
  }
  std::optional<ValueId> infer(Frame &frame, SourceSpan span, const BinaryExpr &binary,
                               const std::optional<ValueType> &context) {
    auto expected = context;
    if (!expected && literal_[binary.left] && literal_[binary.right] &&
        (floatingLiteral_[binary.left] || floatingLiteral_[binary.right])) {
      expected = ValueType{};
      expected->element = NumericType::Float64;
    }
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
    const auto operand = [&](ExprId id, std::optional<ValueType> context) {
      if (literal_[id]) {
        if (context && context->tensor && context->builtin == BuiltinValue::Numeric) {
          const auto element = context->element;
          context = ValueType{};
          context->element = element;
        }
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
    if (binary.operation == TokenKind::Percent &&
        (!isInteger(a.element) || !isInteger(b.element))) {
      error("S019", "'%' requires integer operands", span);
      return {};
    }
    if (a.task || b.task || a.fallible || b.fallible || a.array || b.array ||
        a.builtin != BuiltinValue::Numeric || b.builtin != BuiltinValue::Numeric ||
        a.element != b.element) {
      error("S017", "arithmetic requires completed values of the same numeric type", span);
      return {};
    }
    if ((a.tensor && a.device) || (b.tensor && b.device)) {
      error("S047", "host arithmetic requires an explicit transfer to devices.cpu()", span);
      return {};
    }
    if (a.tensor || b.tensor) {
      if (binary.operation != TokenKind::Plus && binary.operation != TokenKind::Minus &&
          binary.operation != TokenKind::Star && binary.operation != TokenKind::Slash &&
          !(isInteger(a.element) && binary.operation == TokenKind::Percent)) {
        error("S017", "elementwise float32 arithmetic currently supports only +, -, * and /", span);
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
    return add(frame, a, span, ScalarBinary{binary.operation, *left, *right});
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
  std::optional<ValueId> collectionQuery(Frame &frame, SourceSpan span, const std::string &callee,
                                         const std::vector<ExprId> &arguments) {
    if (arguments.size() != 1) {
      error("S027", callee + " expects exactly one argument", span);
      return {};
    }
    auto input = expression(frame, arguments[0]);
    if (!input)
      return {};
    const auto type = node(*input).type;
    const bool length = callee == "length";
    if (!type.tensor || type.builtin != BuiltinValue::Numeric || type.task || type.fallible ||
        type.device || type.array != length) {
      error("S064",
            callee + (length ? " requires a completed CPU numeric array"
                             : " requires a completed CPU numeric tensor"),
            span);
      return {};
    }
    ValueType result;
    result.element = NumericType::Int64;
    if (!length) {
      result.tensor = result.array = true;
      result.shape = {{type.shape.size(), 0}};
    }
    return add(
        frame, result, span,
        CollectionQuery{length ? CollectionQueryKind::Length : CollectionQueryKind::Shape, *input});
  }
  std::optional<ValueId> infer(Frame &frame, SourceSpan span, const IndexExpr &read,
                               const std::optional<ValueType> &expected) {
    std::optional<ValueType> context;
    if (expected && expected->builtin == BuiltinValue::Numeric && !expected->tensor &&
        !expected->task && !expected->fallible && !expected->device &&
        std::holds_alternative<ArrayExpr>(syntax_.expressions[read.input].value)) {
      context = *expected;
      context->array = context->tensor = true;
      context->shape = {{std::nullopt, 0}};
    }
    auto input = expression(frame, read.input, context);
    if (!input)
      return {};
    const auto a = node(*input).type;
    if (!a.tensor || a.task || a.fallible || a.device || a.builtin != BuiltinValue::Numeric) {
      error("S061", "indexing requires a completed CPU numeric array or tensor", span);
      return {};
    }
    if (read.indices.size() != a.shape.size()) {
      error("S063", "indexing requires exactly one integer index per dimension", span);
      return {};
    }
    std::vector<ValueId> indices;
    for (auto id : read.indices) {
      auto value = expression(frame, id);
      if (!value)
        return {};
      const auto i = node(*value).type;
      if (i.tensor || i.task || i.fallible || i.device || i.builtin != BuiltinValue::Numeric ||
          !isInteger(i.element)) {
        error("S061", "indexing requires completed CPU integer scalar indices",
              syntax_.expressions[id].span);
        return {};
      }
      indices.push_back(*value);
    }
    for (std::size_t axis = 0; axis < indices.size(); ++axis) {
      const auto &extent = a.shape[axis];
      if (auto known = intConstants_.find(indices[axis]); known != intConstants_.end()) {
        if (known->second < 0 || known->second > INT64_MAX ||
            (extent.constant && known->second >= *extent.constant)) {
          error("S062", "index is outside its valid zero-based dimension range", span);
          return {};
        }
      } else if (extent.constant && *extent.constant == 0) {
        error("S062", "cannot index an empty dimension", span);
        return {};
      }
    }
    ValueType result;
    result.element = a.element;
    if (a.array)
      return add(frame, result, span, ArrayIndex{*input, indices[0]});
    return add(frame, result, span, TensorIndex{*input, std::move(indices)});
  }

  std::optional<ValueId> infer(Frame &frame, SourceSpan span, const ArrayExpr &array,
                               const std::optional<ValueType> &expected) {
    if (expected && !expected->array) {
      error("S021", "array literals require an array context; use tensor(...) for tensors", span);
      return {};
    }
    if (array.elements.size() > limits_.maxTensorElements) {
      error("S024", "array literal element limit exceeded", span);
      return {};
    }
    if (!expected && array.elements.empty()) {
      error("S058", "empty arrays need an explicit element type", span);
      return {};
    }
    ValueType output{true, {{array.elements.size(), 0}}};
    output.array = true;
    if (expected)
      output.element = expected->element;
    std::vector<ValueId> elements;
    for (auto leaf : array.elements) {
      std::optional<ValueType> context;
      if (expected) {
        context = ValueType{};
        context->element = output.element;
      }
      auto value = expression(frame, leaf, context);
      if (!value)
        return {};
      const auto actual = node(*value).type;
      if (actual.tensor || actual.task || actual.fallible || actual.device ||
          actual.builtin != BuiltinValue::Numeric) {
        error("S058", "array elements currently require completed CPU numeric scalars",
              syntax_.expressions[leaf].span);
        return {};
      }
      if (!expected && elements.empty())
        output.element = actual.element;
      ValueType scalar;
      scalar.element = output.element;
      if (!conform(frame, *value, scalar, syntax_.expressions[leaf].span))
        return {};
      elements.push_back(*value);
    }
    if (!validSize(output, span))
      return {};
    return add(frame, std::move(output), span, TensorLiteral{std::move(elements)});
  }
  std::optional<ValueId> infer(Frame &frame, SourceSpan span, const TaskExpr &operation,
                               const std::optional<ValueType> &expected) {
    if (operation.placement && !options_.placement) {
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
    std::optional<ValueId> placement;
    std::optional<ValueId> value;
    if (operation.prefix == TaskPrefix::Spawn && options_.placement) {
      const auto &call = std::get<CallExpr>(syntax_.expressions[operation.operand].value);
      const auto *callee = std::get_if<NameExpr>(&syntax_.expressions[call.callee].value);
      if (!callee) {
        error("S037", "spawn requires a statically named invocation", span);
        return {};
      }
      value = invoke(frame, syntax_.expressions[operation.operand].span, callee->name,
                     call.arguments, {}, operation.placement, &placement, true);
    } else
      value = expression(frame, operation.operand, context);
    if (!value)
      return {};
    auto result = node(*value).type;
    if (operation.prefix == TaskPrefix::Spawn) {
      if (!std::holds_alternative<FunctionCall>(node(*value).operation) &&
          !std::holds_alternative<Matmul>(node(*value).operation) &&
          !std::holds_alternative<NumericConvert>(node(*value).operation) &&
          !std::holds_alternative<ReduceSum>(node(*value).operation) &&
          !std::holds_alternative<ArrayMap>(node(*value).operation) &&
          !std::holds_alternative<ArrayToTensor>(node(*value).operation) &&
          !std::holds_alternative<TensorReshape>(node(*value).operation) &&
          !std::holds_alternative<TensorToArray>(node(*value).operation) &&
          !std::holds_alternative<CollectionQuery>(node(*value).operation)) {
        error("S037", "this invocation is not a supported task entry", span);
        return {};
      }
      if (options_.placement && !placement) {
        ValueType type;
        type.builtin = BuiltinValue::Device;
        placement = add(frame, type, span, DeviceSelection{{}});
        if (!placement)
          return {};
      }
      if (result.fallible)
        frame.tasks->handled.insert(result.identity);
      result.task = true;
      result.identity = 0;
      auto task = add(frame, result, span, TaskOperation{operation.prefix, *value, placement});
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
    if (frame.groups.empty() && !frame.handlerFallible && !sourceTaskError(frame.function)) {
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
        if (reservedControl(binding)) {
          error("S056", "Control-flow keywords cannot be binding names", *statement.binding);
          return {};
        }
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
    if (resultType.task || resultType.fallible || resultType.builtin == BuiltinValue::Device) {
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
        if (reservedControl(binding)) {
          error("S056", "Control-flow keywords cannot be binding names", *statement.binding);
          return {};
        }
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
    if (reservedControl(name(handler.parameter))) {
      error("S056", "Control-flow keywords cannot be handler parameter names", handler.parameter);
      return {};
    }
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
    if (resultType.device != handlerType.device) {
      error("S047", "catch branches require matching residency and GPU index; transfer explicitly",
            span);
      return {};
    }
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
    if (!expected ||
        (expected->builtin != BuiltinValue::Numeric && expected->builtin != BuiltinValue::Bool) ||
        expected->task) {
      error("S039", "fail needs a concrete success-type context in this subset", span);
      return {};
    }
    if (frame.groups.empty() && !frame.handlerFallible && !sourceTaskError(frame.function)) {
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
  template <class Evaluate>
  std::optional<ValueId> conditional(Frame &frame, SourceSpan span, ValueId condition,
                                     const std::optional<ValueType> &expected, Evaluate evaluate) {
    const auto conditionType = node(condition).type;
    if (conditionType.builtin != BuiltinValue::Bool || conditionType.task ||
        conditionType.fallible || conditionType.tensor || conditionType.device) {
      error("S057", "conditions require a completed CPU Bool", node(condition).span);
      return {};
    }
    const auto before = *frame.tasks;
    std::vector<std::shared_ptr<TaskChecks>> paths;
    std::vector<std::vector<TypedStatement>> bodies(2);
    std::vector<ValueId> results;
    std::optional<ValueType> resultType;
    auto context = expected;
    if (context)
      context->fallible = true;
    for (unsigned index = 0; index < 2; ++index) {
      auto branch = frame;
      branch.conditional = true;
      branch.tasks = std::make_shared<TaskChecks>(before);
      auto value = evaluate(branch, index, context, bodies[index]);
      if (!value)
        return {};
      auto actual = node(*value).type;
      if (actual.task || actual.builtin == BuiltinValue::Device) {
        error("S035", "conditional branches cannot return task handles or device selectors", span);
        return {};
      }
      if (resultType) {
        if (actual.builtin != resultType->builtin ||
            (actual.builtin == BuiltinValue::Numeric && actual.element != resultType->element) ||
            actual.tensor != resultType->tensor || actual.array != resultType->array ||
            actual.shape.size() != resultType->shape.size()) {
          error("S043", "conditional branches require a common success type", span);
          return {};
        }
        if (actual.device != resultType->device) {
          error("S047", "conditional branches require matching residency", span);
          return {};
        }
        resultType->fallible |= actual.fallible;
        for (std::size_t axis = 0; axis < actual.shape.size(); ++axis)
          if (!same(resultType->shape[axis], actual.shape[axis]))
            resultType->shape[axis] = dynamic();
      } else
        resultType = actual;
      finishBranch(before, branch, *value, span);
      paths.push_back(branch.tasks);
      results.push_back(*value);
    }
    for (auto pending : before.pending)
      if (std::ranges::all_of(paths,
                              [&](const auto &path) { return path->handled.contains(pending); }))
        frame.tasks->handled.insert(pending);
    for (const auto &[group, children] : before.children)
      for (auto child : children)
        if (std::ranges::all_of(paths, [&](const auto &path) {
              return path->observed.contains(node(child).type.identity);
            }))
          frame.tasks->observed.insert(node(child).type.identity);
    resultType->identity = 0;
    return add(frame, *resultType, span,
               ConditionalOperation{condition, std::move(bodies[0]), std::move(bodies[1]),
                                    results[0], results[1]});
  }
  std::optional<ValueId> infer(Frame &frame, SourceSpan span, const ConditionalExpr &choice,
                               const std::optional<ValueType> &expected) {
    auto condition = expression(frame, choice.condition);
    if (!condition)
      return {};
    return conditional(frame, span, *condition, expected,
                       [&](Frame &branch, unsigned index, const std::optional<ValueType> &context,
                           std::vector<TypedStatement> &body) {
                         return suite(branch, index == 0 ? choice.whenTrue : choice.whenFalse,
                                      context, body);
                       });
  }
  std::optional<ValueId> infer(Frame &frame, SourceSpan span, const LogicalExpr &logical,
                               const std::optional<ValueType> &) {
    auto left = expression(frame, logical.left);
    if (!left)
      return {};
    ValueType boolean;
    boolean.builtin = BuiltinValue::Bool;
    return conditional(frame, span, *left, boolean,
                       [&](Frame &branch, unsigned index, const std::optional<ValueType> &,
                           std::vector<TypedStatement> &body) {
                         auto value =
                             (index == 0) == logical.conjunction
                                 ? expression(branch, logical.right, boolean)
                                 : add(branch, boolean, span, BoolLiteral{!logical.conjunction});
                         if (value)
                           body.push_back({span, {}, *value});
                         return value;
                       });
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
        if (reservedControl(binding)) {
          error("S056", "Control-flow keywords cannot be pattern binding names", pattern.binding);
          return {};
        }
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
      if (actual.task || actual.builtin == BuiltinValue::Device) {
        error("S035", "match cannot return a task handle", arm.span);
        return {};
      }
      if (resultType) {
        if (actual.device != resultType->device) {
          error("S047",
                "match branches require matching residency and GPU index; transfer explicitly",
                arm.span);
          return {};
        }
        if (actual.builtin != resultType->builtin ||
            (actual.builtin == BuiltinValue::Numeric && actual.element != resultType->element) ||
            actual.tensor != resultType->tensor || actual.array != resultType->array ||
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
  std::optional<ValueId> arrayTensor(Frame &frame, SourceSpan span, ValueId input,
                                     std::optional<ExprId> shapeSyntax,
                                     const std::optional<ValueType> &expected,
                                     bool reshaping = false) {
    auto output = node(input).type;
    if (output.array == reshaping || output.task || output.fallible || output.device ||
        !output.tensor || output.builtin != BuiltinValue::Numeric ||
        (!reshaping && output.shape.size() != 1)) {
      error("S026",
            reshaping ? "reshape requires a completed CPU numeric tensor"
                      : "tensor construction requires a completed CPU numeric array",
            span);
      return {};
    }
    output.array = false;
    ArrayToTensor operation{input};
    if (shapeSyntax) {
      const auto *shape = std::get_if<ArrayExpr>(&syntax_.expressions[*shapeSyntax].value);
      if (!shape || shape->elements.size() > limits_.maxDepth) {
        error("S050",
              "tensor shape requires a bounded list of integer dimensions with a fixed rank", span);
        return {};
      }
      operation.dimensions.emplace();
      output.shape.clear();
      for (auto axis : shape->elements) {
        auto value = expression(frame, axis);
        if (!value)
          return {};
        const auto &actual = node(*value).type;
        if (actual.builtin != BuiltinValue::Numeric || !isInteger(actual.element) ||
            actual.tensor || actual.task || actual.fallible || actual.device) {
          error("S050", "tensor dimensions require completed CPU integer scalars",
                syntax_.expressions[axis].span);
          return {};
        }
        operation.dimensions->push_back(*value);
        if (auto constant = intConstants_.find(*value); constant != intConstants_.end()) {
          if (constant->second < 0 || constant->second > INT64_MAX) {
            error("S050", "tensor dimensions must fit the nonnegative 64-bit indexing range",
                  syntax_.expressions[axis].span);
            return {};
          }
          output.shape.push_back({std::uint64_t(constant->second), 0});
        } else
          output.shape.push_back(dynamic());
      }
      if (expected && expected->shape.size() == output.shape.size())
        for (std::size_t axis = 0; axis < output.shape.size(); ++axis)
          if (expected->shape[axis].constant) {
            if (output.shape[axis].constant &&
                output.shape[axis].constant != expected->shape[axis].constant) {
              error("S011", "reshape dimension differs from expected tensor extent", span);
              return {};
            }
            output.shape[axis] = expected->shape[axis];
          }
      if (!validSize(output, span))
        return {};
      bool known = true;
      std::uint64_t stride = 1;
      for (auto axis = output.shape.rbegin(); axis != output.shape.rend(); ++axis) {
        if (!axis->constant) {
          known = false;
          continue;
        }
        if (*axis->constant == 0) {
          stride = 0;
          known = true;
          continue;
        }
        if (known) {
          if (stride > std::uint64_t(INT64_MAX) / *axis->constant) {
            error("S002", "tensor shape overflows row-major strides", span);
            return {};
          }
          stride *= *axis->constant;
        }
      }
      if (std::ranges::any_of(output.shape,
                              [](const Extent &axis) { return axis.constant == 0; }) ||
          std::ranges::all_of(output.shape,
                              [](const Extent &axis) { return axis.constant.has_value(); })) {
        std::uint64_t count = 1;
        if (std::ranges::any_of(output.shape,
                                [](const Extent &axis) { return axis.constant == 0; }))
          count = 0;
        else
          for (const auto &axis : output.shape)
            count *= *axis.constant;
        if (!reshaping) {
          if (!requireEqual(frame, node(input).type.shape[0], Extent{count, 0}))
            return {};
          const auto length = node(input).type.shape[0].constant;
          if (length && *length != count) {
            error("S050", "tensor shape element count does not match array length", span);
            return {};
          }
        } else {
          const auto &source = node(input).type.shape;
          std::optional<std::uint64_t> length;
          if (std::ranges::any_of(source, [](const Extent &d) { return d.constant == 0; }))
            length = 0;
          else if (std::ranges::all_of(source,
                                       [](const Extent &d) { return d.constant.has_value(); })) {
            length = 1;
            for (const auto &d : source)
              *length *= *d.constant;
          }
          if (length && *length != count) {
            error("S050", "reshape must preserve the tensor element count", span);
            return {};
          }
        }
      }
    }
    if (!validSize(output, span))
      return {};
    if (reshaping)
      return add(frame, output, span, TensorReshape{input, std::move(*operation.dimensions)});
    return add(frame, output, span, std::move(operation));
  }
  std::optional<ValueId> tensor(Frame &frame, SourceSpan span, const std::vector<ExprId> &arguments,
                                const std::optional<ValueType> &expected) {
    if (arguments.size() != 1 && arguments.size() != 2) {
      error("S025", "tensor expects numeric data and an optional fixed-rank shape list", span);
      return {};
    }
    if (expected && (!expected->tensor || expected->array)) {
      error("S026", "tensor construction requires a tensor result context", span);
      return {};
    }
    bool runtimeLiteralShape = false;
    if (arguments.size() == 2)
      if (const auto *shape = std::get_if<ArrayExpr>(&syntax_.expressions[arguments[1]].value))
        runtimeLiteralShape = std::ranges::any_of(shape->elements, [&](ExprId axis) {
          return !std::holds_alternative<NumberExpr>(syntax_.expressions[axis].value);
        });
    std::optional<ValueId> checkedInput;
    // Literal arrays keep the ranked literal constructor. Runtime arrays have an
    // explicit rank-one construction operation; scalar expressions retain their
    // existing rank-zero behavior and are evaluated only once.
    if (runtimeLiteralShape ||
        (!std::holds_alternative<ArrayExpr>(syntax_.expressions[arguments[0]].value) &&
         !literal_[arguments[0]])) {
      std::optional<ValueType> inputContext;
      if (expected && arguments.size() == 2) {
        inputContext = ValueType{true, {dynamic()}};
        inputContext->array = true;
        inputContext->element = expected->element;
      } else if (expected && expected->shape.empty()) {
        inputContext = ValueType{};
        inputContext->element = expected->element;
      } else if (expected && expected->shape.size() == 1) {
        inputContext = *expected;
        inputContext->array = true;
      }
      checkedInput = expression(frame, arguments[0], inputContext);
      if (!checkedInput)
        return {};
      auto output = node(*checkedInput).type;
      if (output.array)
        return arrayTensor(
            frame, span, *checkedInput,
            arguments.size() == 2 ? std::optional<ExprId>(arguments[1]) : std::nullopt, expected);
    }
    auto data = tensorData(arguments[0], expected);
    if (!data)
      return {};
    if (data->leaves.size() > limits_.maxTensorElements) {
      error("S024", "tensor literal element limit exceeded", span);
      return {};
    }
    const bool contextual = expected && expected->tensor;
    if (!contextual && data->leaves.empty()) {
      error("S026", "empty tensor data needs an explicit Tensor element type", span);
      return {};
    }
    if (arguments.size() == 2) {
      const auto *shape = std::get_if<ArrayExpr>(&syntax_.expressions[arguments[1]].value);
      if (!shape || shape->elements.size() > limits_.maxDepth || data->shape.size() != 1) {
        error("S050",
              "explicit tensor shape requires flat literal data and a bounded constant shape",
              span);
        return {};
      }
      std::vector<std::uint64_t> dimensions;
      for (auto axis : shape->elements) {
        const auto *literal = std::get_if<NumberExpr>(&syntax_.expressions[axis].value);
        if (!literal) {
          error("S050", "tensor shape dimensions must be nonnegative uint64 constants",
                syntax_.expressions[axis].span);
          return {};
        }
        auto text = syntax_.source->slice(literal->literal);
        std::uint64_t value = 0;
        auto parsed = std::from_chars(text.data(), text.data() + text.size(), value);
        if (parsed.ec != std::errc{} || parsed.ptr != text.data() + text.size()) {
          error("S050", "invalid constant tensor shape dimension", literal->literal);
          return {};
        }
        dimensions.push_back(value);
      }
      ValueType shapeType{true, {}};
      // Validate extents/products before multiplying the explicit dimensions. The
      // inferred element width is checked again on the final output type.
      shapeType.element = contextual ? expected->element : NumericType::Int32;
      for (auto dimension : dimensions)
        shapeType.shape.push_back({dimension, 0});
      if (!validSize(shapeType, span))
        return {};
      std::uint64_t stride = 1;
      constexpr auto maximum = std::uint64_t(INT64_MAX);
      for (auto axis = dimensions.rbegin(); axis != dimensions.rend(); ++axis) {
        if (*axis && stride > maximum / (*axis)) {
          error("S002", "explicit tensor shape overflows row-major strides", span);
          return {};
        }
        stride *= *axis;
      }
      std::uint64_t count = 1;
      if (std::ranges::find(dimensions, 0) != dimensions.end())
        count = 0;
      else
        for (auto dimension : dimensions)
          count *= dimension;
      if (count != data->leaves.size()) {
        error("S050", "explicit tensor shape element count does not match flat data", span);
        return {};
      }
      data->shape = std::move(dimensions);
    }
    ValueType output{true, {}};
    if (contextual)
      output.element = expected->element;
    for (auto dimension : data->shape)
      output.shape.push_back({dimension, 0});
    if (contextual && !validSize(output, span))
      return {};
    std::vector<ValueId> elements;
    for (auto leaf : data->leaves) {
      std::optional<ValueType> context;
      if (contextual) {
        context = ValueType{};
        context->element = output.element;
      }
      // Infer unannotated leaves independently, in source order. A previously
      // inferred leaf must not silently supply narrowing/promotion context.
      auto value =
          checkedInput && leaf == arguments[0] ? checkedInput : expression(frame, leaf, context);
      if (!value)
        return {};
      const auto actual = node(*value).type;
      if (actual.tensor || actual.task || actual.fallible || actual.device ||
          actual.builtin != BuiltinValue::Numeric) {
        error("S026", "tensor elements must be completed CPU numeric scalars",
              syntax_.expressions[leaf].span);
        return {};
      }
      if (!contextual && elements.empty())
        output.element = actual.element;
      ValueType scalar;
      scalar.element = output.element;
      if (!conform(frame, *value, scalar, syntax_.expressions[leaf].span))
        return {};
      elements.push_back(*value);
    }
    if (!validSize(output, span))
      return {};
    return add(frame, std::move(output), span, TensorLiteral{std::move(elements)});
  }
  static const llvm::fltSemantics &floatSemantics(NumericType type) {
    return type == NumericType::Float32 ? llvm::APFloat::IEEEsingle() : llvm::APFloat::IEEEdouble();
  }
  std::unordered_map<ValueId, llvm::APFloat> floatConstants_;
  std::unordered_map<SymbolId, llvm::APFloat> floatBindings_;
  void floatingConstant(ValueId id) {
    const auto &value = node(id);
    if (value.type.tensor || value.type.task || value.type.fallible ||
        value.type.builtin != BuiltinValue::Numeric || isInteger(value.type.element))
      return;
    const auto &op = value.operation;
    std::optional<llvm::APFloat> constant;
    if (auto *n = std::get_if<Float32Literal>(&op))
      constant.emplace(llvm::APFloat::IEEEsingle(), llvm::APInt(32, n->bits));
    else if (auto *n = std::get_if<Float64Literal>(&op))
      constant.emplace(llvm::APFloat::IEEEdouble(), llvm::APInt(64, n->bits));
    else if (auto *read = std::get_if<SymbolRead>(&op)) {
      if (auto found = floatBindings_.find(read->symbol); found != floatBindings_.end())
        constant = found->second;
    } else if (auto *unary = std::get_if<ScalarUnary>(&op)) {
      if (auto found = floatConstants_.find(unary->operand); found != floatConstants_.end()) {
        constant = found->second;
        if (unary->operation == TokenKind::Minus)
          constant->changeSign();
      }
    } else if (auto *binary = std::get_if<ScalarBinary>(&op)) {
      auto a = floatConstants_.find(binary->left), d = floatConstants_.find(binary->right);
      if (a != floatConstants_.end() && d != floatConstants_.end()) {
        constant = a->second;
        constexpr auto rounding = llvm::APFloat::rmNearestTiesToEven;
        if (binary->operation == TokenKind::Plus)
          constant->add(d->second, rounding);
        if (binary->operation == TokenKind::Minus)
          constant->subtract(d->second, rounding);
        if (binary->operation == TokenKind::Star)
          constant->multiply(d->second, rounding);
        if (binary->operation == TokenKind::Slash)
          constant->divide(d->second, rounding);
      }
    }
    if (constant)
      floatConstants_.insert_or_assign(id, *constant);
  }
  std::optional<ValueId> conversion(Frame &frame, SourceSpan span, NumericType destination,
                                    const std::vector<ExprId> &arguments) {
    if (!numericArithmeticAvailable(destination, NumericTarget::Cpu)) {
      error("S003", "conversion destination is not implemented", span);
      return {};
    }
    if (arguments.size() != 1) {
      error("S027", "numeric conversion expects one argument", span);
      return {};
    }
    auto input = expression(frame, arguments[0]);
    if (!input)
      return {};
    const auto source = node(*input).type;
    if (source.builtin != BuiltinValue::Numeric || source.array || source.task || source.fallible ||
        source.device) {
      error("S055", "numeric conversion requires an ordinary CPU numeric value", span);
      return {};
    }
    if (source.tensor) {
      auto result = source;
      result.element = destination;
      if (!validSize(result, span))
        return {};
      return add(frame, result, span, NumericConvert{*input});
    }
    std::optional<__int128_t> integer;
    std::optional<llvm::APFloat> floating;
    bool invalid = false;
    if (isInteger(destination)) {
      const auto bits = describeNumeric(destination)->bits;
      const __int128_t maximum = isUnsigned(destination)
                                     ? (bits == 64 ? __int128_t(UINT64_MAX) : UINT32_MAX)
                                     : (bits == 64 ? INT64_MAX : INT32_MAX);
      const __int128_t minimum = isUnsigned(destination) ? 0 : (bits == 64 ? INT64_MIN : INT32_MIN);
      if (auto found = intConstants_.find(*input); found != intConstants_.end()) {
        integer = found->second;
        invalid = *integer < minimum || *integer > maximum;
      } else if (auto found = floatConstants_.find(*input); found != floatConstants_.end()) {
        llvm::APSInt result(bits, isUnsigned(destination));
        bool exact = false;
        auto status = found->second.convertToInteger(result, llvm::APFloat::rmTowardZero, &exact);
        invalid = (status & llvm::APFloat::opInvalidOp) != 0;
        if (!invalid)
          integer = isUnsigned(destination) ? __int128_t(result.getZExtValue())
                                            : __int128_t(result.getSExtValue());
      }
    } else {
      if (auto found = intConstants_.find(*input); found != intConstants_.end()) {
        floating.emplace(floatSemantics(destination));
        floating->convertFromAPInt(llvm::APInt(64, static_cast<std::uint64_t>(found->second)),
                                   !isUnsigned(source.element), llvm::APFloat::rmNearestTiesToEven);
      } else if (auto found = floatConstants_.find(*input); found != floatConstants_.end()) {
        floating = found->second;
        bool loses = false;
        const bool finite = floating->isFinite();
        auto status = floating->convert(floatSemantics(destination),
                                        llvm::APFloat::rmNearestTiesToEven, &loses);
        invalid = finite && (status & llvm::APFloat::opOverflow);
      }
    }
    if (invalid) {
      error("S055", "constant numeric conversion is outside the destination range", span);
      return {};
    }
    ValueType result;
    result.element = destination;
    auto id = add(frame, result, span, NumericConvert{*input});
    if (!id)
      return {};
    if (integer)
      intConstants_[*id] = *integer;
    if (floating)
      floatConstants_.insert_or_assign(*id, *floating);
    return id;
  }
  std::optional<ValueId> anonymousMap(Frame &frame, SourceSpan span, ExprId inputSyntax,
                                      SourceSpan lambdaSpan, const LambdaExpr &lambda) {
    if (lambda.parameters.size() != 1 || reservedControl(name(lambda.parameters[0].name))) {
      error("S060", "map anonymous functions require one element parameter", lambdaSpan);
      return {};
    }
    const auto numericScalar = [](const ValueType &type) {
      return type.builtin == BuiltinValue::Numeric && !type.tensor && !type.task &&
             !type.fallible && !type.device;
    };
    std::optional<ValueType> inputContext;
    if (lambda.parameters[0].annotation) {
      auto annotation = type(*lambda.parameters[0].annotation);
      if (!annotation)
        return {};
      if (!numericScalar(*annotation)) {
        error("S060", "anonymous map parameter requires a numeric scalar type", lambdaSpan);
        return {};
      }
      inputContext = ValueType{true, {dynamic()}};
      inputContext->array = true;
      inputContext->element = annotation->element;
    }
    auto input = expression(frame, inputSyntax, inputContext);
    if (!input)
      return {};
    const auto inputType = node(*input).type;
    if (!inputType.array || inputType.task || inputType.fallible || inputType.device) {
      error("S060", "anonymous map requires a completed CPU numeric array", span);
      return {};
    }
    std::optional<ValueType> resultContext;
    if (lambda.result) {
      resultContext = type(*lambda.result);
      if (!resultContext)
        return {};
      if (!numericScalar(*resultContext)) {
        error("S060", "anonymous map result requires a numeric scalar type", lambdaSpan);
        return {};
      }
    }
    if (functionDepth_ >= limits_.maxDepth || frame.depth >= limits_.maxDepth) {
      error("S007", "anonymous function analysis depth limit exceeded", lambdaSpan);
      return {};
    }
    const Depth functionDepth(functionDepth_);
    const auto id = output_.functions.size();
    output_.functions.emplace_back();
    requirements_.resize(output_.functions.size());
    output_.functions[id].name = "__lambda_" + std::to_string(id);
    output_.functions[id].declaration = lambdaSpan;
    output_.functions[id].declaredResult = resultContext;
    ValueType element;
    element.element = inputType.element;
    const auto parameter = output_.symbols.size();
    output_.symbols.push_back(
        {name(lambda.parameters[0].name), element, lambda.parameters[0].name, id, true});
    output_.functions[id].parameters.push_back(parameter);
    Frame nested{id, {}, frame.depth, std::make_shared<TaskChecks>(), {}, {}, 0, false};
    nested.locals.emplace(name(lambda.parameters[0].name), parameter);
    nested.closure = std::make_shared<ClosureScope>(ClosureScope{&frame, {}, {}});
    auto result = expression(nested, lambda.body, resultContext);
    if (!result)
      return {};
    const auto resultType = node(*result).type;
    if (!numericScalar(resultType)) {
      error("S060", "anonymous map body must produce a completed numeric scalar", lambdaSpan);
      return {};
    }
    output_.functions[id].body = {{syntax_.expressions[lambda.body].span, {}, *result}};
    output_.functions[id].result = *result;
    output_.functions[id].resultType = resultType;
    std::vector<ValueId> captures;
    for (auto origin : nested.closure->origins) {
      auto value = add(frame, output_.symbols[origin].type, lambdaSpan, SymbolRead{origin});
      if (!value)
        return {};
      captures.push_back(*value);
    }
    auto output = inputType;
    output.element = resultType.element;
    if (!validSize(output, span))
      return {};
    return add(frame, output, span, ArrayMap{*input, id, std::move(captures)});
  }
  std::optional<ValueId> arrayMap(Frame &frame, SourceSpan span,
                                  const std::vector<ExprId> &arguments) {
    if (arguments.size() != 2) {
      error("S027", "map expects an array and a one-argument function", span);
      return {};
    }
    if (const auto *lambda = std::get_if<LambdaExpr>(&syntax_.expressions[arguments[1]].value))
      return anonymousMap(frame, span, arguments[0], syntax_.expressions[arguments[1]].span,
                          *lambda);
    const auto *callback = std::get_if<NameExpr>(&syntax_.expressions[arguments[1]].value);
    if (!callback || lookupSymbol(frame, callback->name)) {
      error("S059", "map requires a statically named function in this subset",
            syntax_.expressions[arguments[1]].span);
      return {};
    }
    auto found = functions_.find(functionKey(frame, name(callback->name)));
    if (found == functions_.end() || !analyzeFunction(found->second)) {
      error("S059", "map callback must name a declared function", callback->name);
      return {};
    }
    const auto id = found->second;
    const auto &fn = output_.functions[id];
    const auto scalar = [](const ValueType &type) {
      return type.builtin == BuiltinValue::Numeric && !type.tensor && !type.task &&
             !type.fallible && !type.device;
    };
    const auto result = fn.declaredResult.value_or(fn.resultType);
    if (fn.parameters.size() != 1 || !scalar(result) ||
        !scalar(output_.symbols[fn.parameters[0]].type)) {
      error("S059",
            "map callback requires one numeric scalar parameter and a numeric scalar result",
            callback->name);
      return {};
    }
    ValueType context{true, {dynamic()}};
    context.array = true;
    context.element = output_.symbols[fn.parameters[0]].type.element;
    auto input = expression(frame, arguments[0], context);
    if (!input)
      return {};
    auto output = node(*input).type;
    output.element = result.element;
    if (!validSize(output, span))
      return {};
    return add(frame, output, span, ArrayMap{*input, id});
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
    if (leftType.tensor && leftType.device) {
      error("S047", "host tensor operations require an explicit transfer to devices.cpu()", span);
      return {};
    }
    if (leftType.task || leftType.fallible || leftType.array || !leftType.tensor ||
        (callee == "matmul" && leftType.shape.size() != 2)) {
      error("S028", callee + " requires " + (callee == "matmul" ? "rank-two tensors" : "a tensor"),
            syntax_.expressions[arguments[0]].span);
      return {};
    }
    if (leftType.element != NumericType::Float32 && !isInteger(leftType.element) &&
        leftType.element != NumericType::Float64) {
      error("S053", callee + " currently requires implemented numeric tensor elements", span);
      return {};
    }
    if (callee == "reduceSum") {
      ValueType result;
      result.element = leftType.element;
      return add(frame, result, span, ReduceSum{*left});
    }
    auto right = expression(frame, arguments[1]);
    if (!right)
      return {};
    const auto rightType = node(*right).type;
    if (rightType.tensor && rightType.device) {
      error("S047", "host tensor operations require an explicit transfer to devices.cpu()", span);
      return {};
    }
    if (rightType.task || rightType.fallible || rightType.array || !rightType.tensor ||
        rightType.shape.size() != 2) {
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
    if (leftType.element != rightType.element) {
      error("S017", "matmul requires matching numeric element types", span);
      return {};
    }
    ValueType output{true, {leftType.shape[0], rightType.shape[1]}};
    output.element = leftType.element;
    if (!validSize(output, span))
      return {};
    if (!requireEqual(frame, a, b))
      return {};
    const auto sizeCheck = dynamicSize(output);
    return add(frame, std::move(output), span, Matmul{*left, *right, !same(a, b), sizeCheck});
  }
  std::optional<ValueId> placementBuiltin(Frame &frame, SourceSpan span, const std::string &callee,
                                          const std::vector<ExprId> &arguments) {
    if (callee == "devices.cpu" || callee == "devices.gpu") {
      if (frame.locals.contains("devices")) {
        error("S030", "devices is shadowed by a local binding", span);
        return {};
      }
      const bool gpu = callee == "devices.gpu";
      if (arguments.size() > (gpu ? 1u : 0u)) {
        error("S027", "invalid device selector argument count", span);
        return {};
      }
      std::optional<std::uint32_t> device;
      if (gpu) {
        device = 0;
        if (!arguments.empty()) {
          const auto *literal = std::get_if<NumberExpr>(&syntax_.expressions[arguments[0]].value);
          if (!literal) {
            error("S046", "device selector requires a constant uint32 GPU index", span);
            return {};
          }
          const auto text = syntax_.source->slice(literal->literal);
          const auto parsed = std::from_chars(text.data(), text.data() + text.size(), *device);
          if (parsed.ec != std::errc{} || parsed.ptr != text.data() + text.size()) {
            error("S046", "invalid uint32 GPU index", literal->literal);
            return {};
          }
        }
      }
      ValueType type;
      type.builtin = BuiltinValue::Device;
      type.device = device;
      return add(frame, type, span, DeviceSelection{device});
    }
    if (frame.groups.empty()) {
      error("S037", "transfer requires an owning parallel group", span);
      return {};
    }
    if (arguments.size() != 2) {
      error("S027", "transfer expects a tensor and device target", span);
      return {};
    }
    if (literal_[arguments[0]] || literal_[arguments[1]]) {
      error("S047", "transfer requires a completed tensor and device selector", span);
      return {};
    }
    auto input = expression(frame, arguments[0]);
    auto target = expression(frame, arguments[1]);
    if (!input || !target)
      return {};
    auto type = node(*input).type;
    const auto selection = node(*target).type;
    if (!type.tensor || type.array || type.task || type.fallible ||
        selection.builtin != BuiltinValue::Device) {
      error("S047", "transfer requires a completed tensor and device selector", span);
      return {};
    }
    type.device = selection.device;
    type.task = true;
    type.identity = 0;
    auto transfer = add(frame, type, span, Transfer{*input, *target});
    if (transfer)
      frame.tasks->children[frame.groups.back()].push_back(*transfer);
    return transfer;
  }
  ValueType callResult(FunctionId id, const std::vector<ValueId> &arguments,
                       bool cpuContract = false) {
    const auto &function = output_.functions[id];
    auto result = cpuContract && function.declaredResult ? *function.declaredResult
                  : states_[id] == State::Complete       ? function.resultType
                                                         : *function.declaredResult;
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
  std::optional<ValueId>
  invoke(Frame &frame, SourceSpan span, SourceSpan calleeSpan, const std::vector<ExprId> &arguments,
         const std::optional<ValueType> &expected, std::optional<ExprId> selection = {},
         std::optional<ValueId> *checkedSelection = nullptr, bool spawned = false) {
    const auto callee = name(calleeSpan);
    if (lookupSymbol(frame, calleeSpan)) {
      error("S030", "local value '" + callee + "' is not callable", calleeSpan);
      return {};
    }
    if (options_.placement &&
        (callee == "devices.cpu" || callee == "devices.gpu" || callee == "transfer")) {
      if (selection) {
        error("S037", "device selectors and transfers are not spawn function entries", span);
        return {};
      }
      return placementBuiltin(frame, span, callee, arguments);
    }
    auto found = functions_.find(functionKey(frame, callee));
    if (found == functions_.end()) {
      if (selection) {
        error("S037", "placed spawn requires a statically named function", span);
        return {};
      }
      if (auto numeric = resolveNumeric(callee))
        return conversion(frame, span, *numeric, arguments);
      if (callee == "array") {
        if (arguments.size() != 1) {
          error("S027", "array expects exactly one tensor argument", span);
          return {};
        }
        if (expected && !expected->array) {
          error("S026", "array construction requires an array result context", span);
          return {};
        }
        auto input = expression(frame, arguments[0]);
        if (!input)
          return {};
        auto output = node(*input).type;
        if (!output.tensor || output.array || output.task || output.fallible || output.device ||
            output.builtin != BuiltinValue::Numeric) {
          error("S026", "array construction requires a completed CPU numeric tensor", span);
          return {};
        }
        Extent count = dynamic();
        if (output.shape.size() == 1)
          count = output.shape[0];
        else if (std::ranges::any_of(output.shape, [](const Extent &d) { return d.constant == 0; }))
          count = {0, 0};
        else if (std::ranges::all_of(output.shape,
                                     [](const Extent &d) { return d.constant.has_value(); })) {
          count = {1, 0};
          for (const auto &d : output.shape) {
            if (*count.constant > std::uint64_t(INT64_MAX) / *d.constant) {
              error("S002", "tensor element count exceeds the indexing range", span);
              return {};
            }
            *count.constant *= *d.constant;
          }
        }
        output.array = true;
        output.shape = {count};
        if (!validSize(output, span))
          return {};
        return add(frame, output, span, TensorToArray{*input});
      }
      if (callee == "reshape") {
        if (arguments.size() != 2) {
          error("S027", "reshape expects a tensor and a fixed-rank shape list", span);
          return {};
        }
        if (expected && (!expected->tensor || expected->array)) {
          error("S026", "reshape requires a tensor result context", span);
          return {};
        }
        auto input = expression(frame, arguments[0]);
        if (!input)
          return {};
        return arrayTensor(frame, span, *input, arguments[1], expected, true);
      }
      if (callee == "length" || callee == "shape")
        return collectionQuery(frame, span, callee, arguments);
      if (callee == "map")
        return arrayMap(frame, span, arguments);
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
      auto argument = expression(frame, arguments[i], expectedType, options_.placement && spawned);
      if (!argument)
        return {};
      operands.push_back(*argument);
    }
    std::optional<std::uint32_t> device;
    if (selection) {
      if (literal_[*selection]) {
        error("S046", "task placement requires a device selector", span);
        return {};
      }
      auto target = expression(frame, *selection);
      if (!target)
        return {};
      const auto type = node(*target).type;
      if (type.builtin != BuiltinValue::Device || type.task || type.fallible) {
        error("S046", "task placement requires a device selector", span);
        return {};
      }
      device = type.device;
      if (checkedSelection)
        *checkedSelection = *target;
    }
    if (!selection && spawned && options_.placement && checkedSelection) {
      ValueType type;
      type.builtin = BuiltinValue::Device;
      auto target = add(frame, type, span, DeviceSelection{{}});
      if (!target)
        return {};
      *checkedSelection = *target;
    }
    for (auto operand : operands) {
      const auto type = node(operand).type;
      if (type.tensor && type.device != device) {
        error("S047",
              "tensor arguments require an explicit transfer to the selected execution device",
              span);
        return {};
      }
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
    auto resultType = callResult(id, operands, options_.placement && !device);
    if (resultType.tensor)
      resultType.device = device;
    resultType.fallible = syntax_.functions[id].taskError;
    resultType.identity = 0;
    if (!validSize(resultType, span))
      return {};
    return add(frame, std::move(resultType), span, FunctionCall{id, std::move(operands)});
  }
  Module syntax_;
  SemanticLimits limits_;
  CheckOptions options_;
  TypedModule output_;
  std::unordered_map<std::string, FunctionId> functions_;
  std::vector<State> states_;
  std::vector<bool> signatures_;
  std::vector<bool> literal_, floatingLiteral_;
  std::vector<std::unordered_set<std::string>> requirements_;
  std::vector<Diagnostic> diagnostics_;
  ExtentId nextExtent_ = 1;
  std::size_t functionDepth_ = 0;
  std::size_t errorCount_ = 0;
  std::size_t shapeWork_ = 0;
  std::size_t nextGroup_ = 1;
};
} // namespace
CheckResult check(ParseResult syntax, SemanticLimits limits, CheckOptions options) {
  if (!syntax.ok())
    return {syntax.module.source, {}, std::move(syntax.diagnostics)};
  limits.maxDiagnostics = std::max<std::size_t>(1, limits.maxDiagnostics);
  return Checker(std::move(syntax.module), limits, options).run();
}
} // namespace kalandra
