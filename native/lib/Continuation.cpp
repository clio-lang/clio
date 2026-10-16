#include "kalandra/Continuation.h"
#include <algorithm>
#include <set>
#include <sstream>
#include <stdexcept>
#include <unordered_map>
namespace kalandra::continuation {
namespace {
ValueType plain(ValueType type) {
  type.task = type.fallible = false;
  type.identity = 0;
  return type;
}
std::vector<ValueId> operands(const TypedExpr &expression) {
  return std::visit(
      [](const auto &op) -> std::vector<ValueId> {
        using T = std::decay_t<decltype(op)>;
        if constexpr (std::is_same_v<T, TensorLiteral>)
          return op.elements;
        else if constexpr (std::is_same_v<T, TensorUnary> || std::is_same_v<T, ScalarUnary>)
          return {op.operand};
        else if constexpr (std::is_same_v<T, Matmul> || std::is_same_v<T, TensorBinary> ||
                           std::is_same_v<T, ScalarBinary>)
          return {op.left, op.right};
        else if constexpr (std::is_same_v<T, ReduceSum> || std::is_same_v<T, ShapeCheck>)
          return {op.input};
        else
          return {};
      },
      expression.operation);
}
class Builder : public ModulePlan {
  struct Boundary {
    Slot output;
    std::optional<std::size_t> group;
    std::vector<std::size_t> jumps;
  };
  struct Environment {
    std::unordered_map<ValueId, Slot> values;
    std::unordered_map<SymbolId, Slot> symbols;
    std::unordered_map<Slot, std::size_t> targets;
    Boundary *boundary = nullptr;
    std::optional<std::size_t> group;
  };

public:
  std::size_t totalSlots = 0;
  Options options;
  std::vector<bool> resumable;
  std::vector<FunctionId> pending;
  std::vector<bool> scheduled;
  explicit Builder(const TypedModule &input, Options options)
      : ModulePlan(input), options(options), resumable(resumableFunctions(input)) {
    if (options.entry && *options.entry >= input.functions.size())
      throw std::runtime_error("continuation entry function is out of range");
    if (hasPlacement(input) && !options.preserveCalls)
      throw std::runtime_error("placement-aware plans require preserved target calls");
    kernels.source = input.source;
    plans.resize(input.functions.size());
    for (auto &plan : plans)
      plan = std::make_unique<Plan>();
    scheduled.resize(input.functions.size());
    for (FunctionId id = 0; id < input.functions.size(); ++id)
      if (!options.entry || *options.entry == id) {
        pending.push_back(id);
        scheduled[id] = true;
      }
    for (std::size_t index = 0; index < pending.size(); ++index) {
      const auto id = pending[index];
      auto &plan = *plans[id];
      std::vector<Slot> parameters;
      for (auto parameter : input.functions[id].parameters)
        parameters.push_back(slot(plan, input.symbols[parameter].type));
      plan.parameters = parameters;
      std::set<FunctionId> stack;
      plan.result = function(plan, id, parameters, stack);
      plan.code.push_back({Code::Return, 0, {plan.result}});
    }
    if (options.preserveCalls) {
      std::vector<unsigned> state(plans.size());
      auto visit = [&](auto &&self, FunctionId id, unsigned depth) -> void {
        if (state[id] == 1 || depth > 128)
          throw std::runtime_error("recursive resumable task entries are not implemented yet");
        if (state[id] == 2)
          return;
        state[id] = 1;
        for (const auto &op : plans[id]->code)
          if (op.code == Code::Spawn && resumable.at(op.target))
            self(self, op.target, depth + 1);
        state[id] = 2;
      };
      for (auto id : pending)
        visit(visit, id, 0);
    }
    TypedFunction main;
    main.name = "main";
    main.result = kernels.expressions.size();
    main.resultType = {};
    main.declaredResult = ValueType{};
    main.expressions = {main.result};
    main.body = {{{}, {}, main.result}};
    kernels.expressions.push_back({{}, {}, Float32Literal{0}});
    kernels.functions.push_back(std::move(main));
  }

private:
  Slot slot(Plan &plan, ValueType type) {
    if (++totalSlots > 300000 || plan.slots.size() >= 20000)
      throw std::runtime_error("continuation frame value limit exceeded");
    plan.slots.push_back(std::move(type));
    return plan.slots.size() - 1;
  }
  Slot function(Plan &plan, FunctionId id, const std::vector<Slot> &args,
                std::set<FunctionId> &stack, std::optional<std::size_t> ambient = {}) {
    if (!stack.insert(id).second || stack.size() > 128)
      throw std::runtime_error("recursive calls are not implemented in task-enabled modules yet");
    Environment env;
    env.group = ambient;
    const auto &fn = input.functions[id];
    for (std::size_t i = 0; i < args.size(); ++i)
      env.symbols[fn.parameters[i]] = args[i];
    Boundary boundary{slot(plan, fn.resultType), {}, {}};
    env.boundary = &boundary;
    Slot value = boundary.output;
    for (const auto &statement : fn.body) {
      value = expression(plan, statement.value, env, stack);
      if (statement.binding)
        env.symbols[*statement.binding] = value;
    }
    plan.code.push_back({Code::Copy, boundary.output, {value}});
    const auto exit = plan.code.size();
    plan.code.push_back({Code::Label, 0, {}});
    for (auto jump : boundary.jumps)
      plan.code[jump].jump = exit;
    stack.erase(id);
    return boundary.output;
  }
  FunctionId kernel(ValueId id) {
    if (auto found = kernelIds.find(id); found != kernelIds.end())
      return found->second;
    const auto &source = input.expressions[id];
    const auto args = operands(source);
    TypedFunction fn;
    const auto fnId = kernels.functions.size();
    fn.name = "__step_" + std::to_string(fnId);
    fn.declaration = source.span;
    std::vector<ValueId> reads;
    for (auto arg : args) {
      const auto symbol = kernels.symbols.size();
      const auto type = plain(input.expressions[arg].type);
      fn.parameters.push_back(symbol);
      kernels.symbols.push_back({"argument", type, source.span, fnId, true});
      reads.push_back(kernels.expressions.size());
      fn.expressions.push_back(reads.back());
      kernels.expressions.push_back({source.span, type, SymbolRead{symbol}});
    }
    auto op = source.operation;
    if (auto *literal = std::get_if<TensorLiteral>(&op))
      literal->elements = reads;
    else if (auto *multiply = std::get_if<Matmul>(&op)) {
      multiply->left = reads[0];
      multiply->right = reads[1];
    } else if (auto *unary = std::get_if<TensorUnary>(&op)) {
      unary->operand = reads[0];
    } else if (auto *elementwise = std::get_if<TensorBinary>(&op)) {
      elementwise->left = reads[0];
      elementwise->right = reads[1];
    } else if (auto *reduce = std::get_if<ReduceSum>(&op))
      reduce->input = reads[0];
    else if (auto *shape = std::get_if<ShapeCheck>(&op))
      shape->input = reads[0];
    if (auto *unary = std::get_if<ScalarUnary>(&op))
      unary->operand = reads[0];
    else if (auto *binary = std::get_if<ScalarBinary>(&op)) {
      binary->left = reads[0];
      binary->right = reads[1];
    }
    fn.result = kernels.expressions.size();
    fn.resultType = plain(source.type);
    fn.declaredResult = fn.resultType;
    fn.expressions.push_back(fn.result);
    fn.body = {{source.span, {}, fn.result}};
    kernels.expressions.push_back({source.span, fn.resultType, std::move(op)});
    kernels.functions.push_back(std::move(fn));
    kernelIds[id] = fnId;
    return fnId;
  }
  std::size_t builtinPlan(ValueId id) {
    auto plan = std::make_unique<Plan>();
    std::vector<Slot> args;
    for (auto arg : operands(input.expressions[id]))
      args.push_back(slot(*plan, input.expressions[arg].type));
    plan->parameters = args;
    plan->result = slot(*plan, plain(input.expressions[id].type));
    plan->code.push_back({Code::Kernel, plan->result, args, kernel(id), 0, 0, id});
    plan->code.push_back({Code::Return, 0, {plan->result}});
    plans.push_back(std::move(plan));
    return plans.size() - 1;
  }
  bool constant(ValueId id) const {
    const auto &op = input.expressions[id].operation;
    if (std::holds_alternative<Float32Literal>(op) || (std::holds_alternative<UInt64Literal>(op) || std::holds_alternative<Int64Literal>(op) || std::holds_alternative<Int32Literal>(op) || std::holds_alternative<UInt32Literal>(op)))
      return true;
    const auto *unary = std::get_if<ScalarUnary>(&op);
    return unary && constant(unary->operand);
  }
  Slot expression(Plan &plan, ValueId id, Environment &env, std::set<FunctionId> &stack) {
    if (auto found = env.values.find(id); found != env.values.end())
      return found->second;
    const auto &node = input.expressions[id];
    if (const auto *read = std::get_if<SymbolRead>(&node.operation))
      return env.symbols.at(read->symbol);
    if (const auto *call = std::get_if<FunctionCall>(&node.operation)) {
      std::vector<Slot> args;
      for (auto arg : call->arguments)
        args.push_back(expression(plan, arg, env, stack));
      const bool preserve = options.preserveCalls && !resumable.at(call->function);
      auto value =
          preserve ? slot(plan, node.type) : function(plan, call->function, args, stack, env.group);
      if (preserve)
        plan.code.push_back({Code::Call, value, args, call->function, 0, 0, id});
      env.values[id] = value;
      return value;
    }
    auto output = slot(plan, node.type);
    if (const auto *block = std::get_if<ParallelOperation>(&node.operation)) {
      const auto group = plan.groups++;
      Boundary boundary{output, group, {}};
      auto nested = env;
      nested.boundary = &boundary;
      nested.group = group;
      plan.code.push_back({Code::Open, 0, {}, env.group.value_or(SIZE_MAX), group, 0, id});
      Slot value = output;
      for (const auto &statement : block->body) {
        value = expression(plan, statement.value, nested, stack);
        if (statement.binding)
          nested.symbols[*statement.binding] = value;
      }
      const auto exit = plan.code.size();
      plan.code.push_back({Code::Join, output, {value}, 0, group, 0, id});
      for (auto jump : boundary.jumps)
        plan.code[jump].jump = exit;
    } else if (const auto *device = std::get_if<DeviceSelection>(&node.operation)) {
      plan.code.push_back(
          {Code::Device, output, {}, device->device ? *device->device : SIZE_MAX, 0, 0, id});
    } else if (const auto *transfer = std::get_if<Transfer>(&node.operation)) {
      if (!env.group)
        throw std::runtime_error("transfer plan requires an owning group");
      auto input = expression(plan, transfer->input, env, stack);
      auto target = expression(plan, transfer->target, env, stack);
      plan.code.push_back({Code::Transfer, output, {input, target}, 0, *env.group, 0, id});
      env.targets[output] = SIZE_MAX;
    } else if (const auto *task = std::get_if<TaskOperation>(&node.operation)) {
      if (task->prefix == TaskPrefix::Spawn) {
        const auto &invocation = input.expressions[task->operand];
        std::vector<ValueId> operands;
        std::size_t target;
        if (const auto *call = std::get_if<FunctionCall>(&invocation.operation)) {
          operands = call->arguments;
          target = call->function;
          if (options.preserveCalls && resumable.at(target)) {
            if (task->placement && input.expressions.at(*task->placement).type.device)
              throw std::runtime_error("resumable helpers require CPU placement; GPU placements "
                                       "require numeric kernels");
            if (!scheduled.at(target)) {
              scheduled[target] = true;
              pending.push_back(target);
            }
          }
        } else {
          if (options.preserveCalls)
            throw std::runtime_error("mixed spawn requires a resolved function entry");
          operands = kalandra::continuation::operands(invocation);
          target = builtinPlan(task->operand);
        }
        std::vector<Slot> args;
        for (auto arg : operands)
          args.push_back(expression(plan, arg, env, stack));
        if (!env.group)
          throw std::runtime_error("spawn plan requires an owning group");
        std::optional<Slot> placement;
        if (task->placement)
          placement = expression(plan, *task->placement, env, stack);
        plan.code.push_back({Code::Spawn, output, args, target, *env.group, 0, id, placement});
        env.targets[output] = target;
      } else {
        auto operand = expression(plan, task->operand, env, stack);
        if (task->prefix == TaskPrefix::Await)
          plan.code.push_back({Code::Await, output, {operand}, env.targets.at(operand)});
        else {
          const auto index = plan.code.size();
          plan.code.push_back({Code::Try,
                               output,
                               {operand},
                               env.boundary->output,
                               env.boundary->group.value_or(SIZE_MAX)});
          env.boundary->jumps.push_back(index);
        }
      }
    } else if (const auto *handler = std::get_if<CatchOperation>(&node.operation)) {
      auto operand = expression(plan, handler->operand, env, stack);
      ValueType errorType;
      errorType.builtin = BuiltinValue::TaskError;
      const auto error = slot(plan, errorType);
      auto nested = env;
      nested.symbols[handler->parameter] = error;
      Boundary boundary{output, {}, {}};
      nested.boundary = &boundary;
      const auto dispatch = plan.code.size();
      plan.code.push_back({Code::Catch, output, {operand, error}});
      plan.code[dispatch].jump = plan.code.size();
      Slot result = output;
      for (const auto &statement : handler->body) {
        result = expression(plan, statement.value, nested, stack);
        if (statement.binding)
          nested.symbols[*statement.binding] = result;
      }
      plan.code.push_back({Code::Copy, output, {result}});
      const auto exit = plan.code.size();
      plan.code.push_back({Code::Label, 0, {}});
      plan.code[dispatch].target = exit;
      for (auto jump : boundary.jumps)
        plan.code[jump].jump = exit;
    } else if (const auto *match = std::get_if<MatchOperation>(&node.operation)) {
      auto subject = expression(plan, match->subject, env, stack);
      std::vector<std::size_t> exits;
      std::optional<std::size_t> previous;
      for (const auto &arm : match->cases) {
        if (previous)
          plan.code[*previous].jump = plan.code.size();
        previous.reset();
        if (arm.tag) {
          previous = plan.code.size();
          plan.code.push_back({Code::Case, output, {subject}, *arm.tag});
        }
        auto branch = env;
        Slot result = output;
        for (const auto &statement : arm.body) {
          result = expression(plan, statement.value, branch, stack);
          if (statement.binding)
            branch.symbols[*statement.binding] = result;
        }
        plan.code.push_back({Code::Copy, output, {result}});
        exits.push_back(plan.code.size());
        plan.code.push_back({Code::Jump, 0, {}});
      }
      // A corrupt internal tag is a checked fault, never an implicit wildcard.
      if (previous)
        plan.code[*previous].jump = SIZE_MAX;
      const auto exit = plan.code.size();
      plan.code.push_back({Code::Label, 0, {}});
      for (auto jump : exits)
        plan.code[jump].jump = exit;
    } else if (const auto *field = std::get_if<ErrorFieldRead>(&node.operation)) {
      auto subject = expression(plan, field->subject, env, stack);
      plan.code.push_back({Code::Field, output, {subject}, static_cast<std::size_t>(field->field)});
    } else if (const auto *failure = std::get_if<FailOperation>(&node.operation)) {
      auto error = expression(plan, failure->error, env, stack);
      const auto index = plan.code.size();
      plan.code.push_back({Code::Fail,
                           output,
                           {error},
                           env.boundary->output,
                           env.boundary->group.value_or(SIZE_MAX)});
      env.boundary->jumps.push_back(index);
    } else if (std::holds_alternative<Float32Literal>(node.operation) ||
               (std::holds_alternative<UInt64Literal>(node.operation) || std::holds_alternative<Int64Literal>(node.operation) || std::holds_alternative<Int32Literal>(node.operation) || std::holds_alternative<UInt32Literal>(node.operation)))
      plan.code.push_back({Code::Literal, output, {}, 0, 0, 0, id});
    else if (isInteger(node.type.element) &&
             (std::holds_alternative<ScalarUnary>(node.operation) ||
              std::holds_alternative<ScalarBinary>(node.operation))) {
      std::vector<Slot> args;
      for (auto arg : operands(node))
        args.push_back(expression(plan, arg, env, stack));
      plan.code.push_back({Code::Kernel, output, args,
                           options.preserveCalls ? 0 : kernel(id), 0, 0, id});
    } else if (const auto *unary = std::get_if<ScalarUnary>(&node.operation)) {
      auto arg = expression(plan, unary->operand, env, stack);
      plan.code.push_back({Code::Unary, output, {arg}, 0, 0, 0, id});
    } else if (const auto *binary = std::get_if<ScalarBinary>(&node.operation)) {
      auto a = expression(plan, binary->left, env, stack);
      auto b = expression(plan, binary->right, env, stack);
      plan.code.push_back({Code::Binary, output, {a, b}, 0, 0, 0, id});
    } else {
      std::vector<Slot> args;
      const auto *literal = std::get_if<TensorLiteral>(&node.operation);
      // Target-preserved constants are embedded tensor data, not thousands of
      // live continuation values. Nonconstant leaves still evaluate in order.
      const bool embedded =
          options.preserveCalls && literal &&
          std::ranges::all_of(literal->elements, [&](auto value) { return constant(value); });
      if (!embedded)
        for (auto arg : operands(node))
          args.push_back(expression(plan, arg, env, stack));
      plan.code.push_back(
          {Code::Kernel, output, args, options.preserveCalls ? 0 : kernel(id), 0, 0, id});
    }
    env.values[id] = output;
    return output;
  }
};
} // namespace
std::vector<bool> resumableFunctions(const TypedModule &input) {
  std::vector<bool> result(input.functions.size());
  std::vector<std::vector<FunctionId>> callers(input.functions.size());
  std::vector<FunctionId> pending;
  for (FunctionId id = 0; id < input.functions.size(); ++id) {
    result[id] = input.functions[id].resultType.fallible;
    for (auto value : input.functions[id].expressions) {
      const auto &op = input.expressions.at(value).operation;
      if (const auto *call = std::get_if<FunctionCall>(&op))
        callers.at(call->function).push_back(id);
      if (std::holds_alternative<TaskOperation>(op) ||
          std::holds_alternative<ParallelOperation>(op) ||
          std::holds_alternative<CatchOperation>(op) ||
          std::holds_alternative<MatchOperation>(op) || std::holds_alternative<FailOperation>(op) ||
          std::holds_alternative<ErrorFieldRead>(op) ||
          std::holds_alternative<DeviceSelection>(op) || std::holds_alternative<Transfer>(op))
        result[id] = true;
    }
    if (result[id])
      pending.push_back(id);
  }
  while (!pending.empty()) {
    auto id = pending.back();
    pending.pop_back();
    for (auto caller : callers[id])
      if (!result[caller]) {
        result[caller] = true;
        pending.push_back(caller);
      }
  }
  return result;
}
std::expected<ModulePlan, std::string> plan(const TypedModule &input, Options options) {
  try {
    Builder builder(input, options);
    return std::move(static_cast<ModulePlan &>(builder));
  } catch (const std::exception &error) {
    return std::unexpected(error.what());
  }
}
std::string dump(const ModulePlan &module) {
  static constexpr const char *names[] = {"literal", "unary",  "binary", "kernel", "copy",
                                          "open",    "spawn",  "await",  "try",    "join",
                                          "label",   "return", "catch",  "case",   "jump",
                                          "field",   "fail",   "call",   "device", "transfer"};
  std::ostringstream out;
  for (std::size_t f = 0; f < module.plans.size(); ++f) {
    const auto &plan = *module.plans[f];
    if (plan.code.empty())
      continue;
    out << "plan @" << f << " slots=" << plan.slots.size() << " groups=" << plan.groups
        << " result=$" << plan.result << '\n';
    for (std::size_t i = 0; i < plan.slots.size(); ++i)
      out << "  $" << i << " : " << describeType(plan.slots[i]) << '\n';
    for (std::size_t i = 0; i < plan.code.size(); ++i) {
      const auto &op = plan.code[i];
      out << "  " << i << ": " << names[static_cast<unsigned>(op.code)] << " $" << op.output
          << " (";
      for (auto arg : op.args)
        out << '$' << arg << ',';
      out << ") target=" << op.target << " group=" << op.group << " jump=" << op.jump;
      if (op.placement)
        out << " on $" << *op.placement;
      out << '\n';
    }
  }
  return out.str();
}
} // namespace kalandra::continuation
