#include "kalandra/Backend.h"
#include "llvm/AsmParser/Parser.h"
#include "llvm/IR/Constants.h"
#include "llvm/IR/IRBuilder.h"
#include "llvm/IR/Module.h"
#include "llvm/IR/Verifier.h"
#include "llvm/Support/SourceMgr.h"
#include <map>
#include <set>
#include <stdexcept>
#include <unordered_map>

namespace kalandra {
namespace {
using Slot = std::size_t;
enum class Code {
  Literal,
  Unary,
  Binary,
  Kernel,
  Copy,
  Open,
  Spawn,
  Await,
  Try,
  Join,
  Label,
  Return
};
struct Instruction {
  Code code;
  Slot output = 0;
  std::vector<Slot> args;
  std::size_t target = 0, group = 0, jump = 0;
  ValueId source = 0;
};
struct Plan {
  std::vector<ValueType> slots;
  std::vector<Slot> parameters;
  std::vector<Instruction> code;
  std::size_t groups = 0;
  Slot result = 0;
};
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
        else if constexpr (std::is_same_v<T, Matmul>)
          return {op.left, op.right};
        else if constexpr (std::is_same_v<T, ReduceSum> || std::is_same_v<T, ShapeCheck>)
          return {op.input};
        else
          return {};
      },
      expression.operation);
}
class Planner {
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
  const TypedModule &input;
  TypedModule kernels;
  std::vector<std::unique_ptr<Plan>> plans;
  std::map<ValueId, FunctionId> kernelIds;
  std::size_t totalSlots = 0;
  explicit Planner(const TypedModule &input) : input(input) {
    kernels.source = input.source;
    plans.resize(input.functions.size());
    for (auto &plan : plans)
      plan = std::make_unique<Plan>();
    for (FunctionId id = 0; id < input.functions.size(); ++id) {
      auto &plan = *plans[id];
      std::vector<Slot> parameters;
      for (auto parameter : input.functions[id].parameters)
        parameters.push_back(slot(plan, input.symbols[parameter].type));
      plan.parameters = parameters;
      std::set<FunctionId> stack;
      plan.result = function(plan, id, parameters, stack);
      plan.code.push_back({Code::Return, 0, {plan.result}});
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
    } else if (auto *reduce = std::get_if<ReduceSum>(&op))
      reduce->input = reads[0];
    else if (auto *shape = std::get_if<ShapeCheck>(&op))
      shape->input = reads[0];
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
      auto value = function(plan, call->function, args, stack, env.group);
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
      plan.code.push_back({Code::Open, 0, {}, env.group.value_or(SIZE_MAX), group});
      Slot value = output;
      for (const auto &statement : block->body) {
        value = expression(plan, statement.value, nested, stack);
        if (statement.binding)
          nested.symbols[*statement.binding] = value;
      }
      const auto exit = plan.code.size();
      plan.code.push_back({Code::Join, output, {value}, 0, group});
      for (auto jump : boundary.jumps)
        plan.code[jump].jump = exit;
    } else if (const auto *task = std::get_if<TaskOperation>(&node.operation)) {
      if (task->prefix == TaskPrefix::Spawn) {
        const auto &invocation = input.expressions[task->operand];
        std::vector<ValueId> operands;
        std::size_t target;
        if (const auto *call = std::get_if<FunctionCall>(&invocation.operation)) {
          operands = call->arguments;
          target = call->function;
        } else {
          operands = kalandra::operands(invocation);
          target = builtinPlan(task->operand);
        }
        std::vector<Slot> args;
        for (auto arg : operands)
          args.push_back(expression(plan, arg, env, stack));
        plan.code.push_back({Code::Spawn, output, args, target, *env.group});
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
    } else if (std::holds_alternative<Float32Literal>(node.operation))
      plan.code.push_back({Code::Literal, output, {}, 0, 0, 0, id});
    else if (const auto *unary = std::get_if<ScalarUnary>(&node.operation)) {
      auto arg = expression(plan, unary->operand, env, stack);
      plan.code.push_back({Code::Unary, output, {arg}, 0, 0, 0, id});
    } else if (const auto *binary = std::get_if<ScalarBinary>(&node.operation)) {
      auto a = expression(plan, binary->left, env, stack);
      auto b = expression(plan, binary->right, env, stack);
      plan.code.push_back({Code::Binary, output, {a, b}, 0, 0, 0, id});
    } else {
      std::vector<Slot> args;
      for (auto arg : operands(node))
        args.push_back(expression(plan, arg, env, stack));
      plan.code.push_back({Code::Kernel, output, args, kernel(id), 0, 0, id});
    }
    env.values[id] = output;
    return output;
  }
};
class Emitter {
  using Type = llvm::Type;
  using Value = llvm::Value;
  using Function = llvm::Function;
  using Block = llvm::BasicBlock;
  Planner &planner;
  llvm::Module &module;
  llvm::LLVMContext &context;
  llvm::IRBuilder<> builder;
  Type *pointer, *i32, *i64, *f32, *boolean, *voidType;
  llvm::StructType *failureType, *handleType, *packetType, *layoutType, *entryType;
  std::map<std::string, llvm::StructType *> values;
  std::map<std::string, llvm::GlobalVariable *> layouts;
  std::vector<llvm::StructType *> frames, packets;
  std::vector<llvm::GlobalVariable *> entries;
  Function *destroy;

public:
  Emitter(Planner &planner, llvm::Module &module)
      : planner(planner), module(module), context(module.getContext()), builder(context) {
    module.setDataLayout("e-m:o-p270:32:32-p271:32:32-p272:64:64-i64:64-i128:128-n32:64-S128-Fn32");
    pointer = builder.getPtrTy();
    i32 = builder.getInt32Ty();
    i64 = builder.getInt64Ty();
    f32 = builder.getFloatTy();
    boolean = builder.getInt1Ty();
    voidType = builder.getVoidTy();
    failureType = llvm::StructType::get(context, {i32, i64, i64, i64});
    handleType = llvm::StructType::get(context, {i32, i64});
    packetType = llvm::StructType::get(context, {i64, pointer, i64, pointer});
    layoutType = llvm::StructType::get(context, {i64, i64, i64, pointer, pointer});
    entryType = llvm::StructType::get(
        context, {i32, i64, i64, i64, i64, i64, pointer, pointer, pointer, pointer});
    destroy = function("kalandra_frame_destroy", voidType, {pointer});
    builder.SetInsertPoint(Block::Create(context, "entry", destroy));
    builder.CreateRetVoid();
    for (std::size_t id = 0; id < planner.plans.size(); ++id) {
      const auto &plan = *planner.plans[id];
      std::vector<Type *> fields{i32}, parameters;
      for (const auto &slot : plan.slots)
        fields.push_back(valueType(slot));
      for (std::size_t g = 0; g < plan.groups; ++g)
        fields.push_back(handleType);
      for (auto slot : plan.parameters)
        parameters.push_back(valueType(plan.slots[slot]));
      frames.push_back(
          llvm::StructType::create(context, fields, "task.frame." + std::to_string(id)));
      packets.push_back(llvm::StructType::get(context, parameters));
      entries.push_back(new llvm::GlobalVariable(module, entryType, true,
                                                 llvm::GlobalValue::InternalLinkage, nullptr,
                                                 "task.entry." + std::to_string(id)));
    }
  }
  void run() {
    for (std::size_t id = 0; id < planner.plans.size(); ++id)
      emitPlan(id);
    auto main = std::ranges::find_if(planner.input.functions,
                                     [](const auto &f) { return f.name == "main"; });
    if (main == planner.input.functions.end() || !main->parameters.empty() ||
        main->resultType.tensor)
      throw std::runtime_error("native task entry requires parameterless float32 main");
    const auto id = std::size_t(main - planner.input.functions.begin());
    auto *entry = module.getFunction("_mlir_ciface_kalandra_entry");
    entry->deleteBody();
    builder.SetInsertPoint(Block::Create(context, "entry", entry));
    auto *ctx = entry->getArg(0);
    auto *packet = builder.CreateAlloca(packetType);
    auto *result = builder.CreateAlloca(valueType(main->resultType));
    auto *failure = builder.CreateAlloca(failureType);
    builder.CreateStore(llvm::Constant::getNullValue(valueType(main->resultType)), result);
    fillPacket(packet, id, llvm::ConstantPointerNull::get(builder.getPtrTy()), ctx);
    call("kalandra_run_task_v1", voidType, {entries[id], packet, result, ctx, failure});
    auto *bad = Block::Create(context, "root.fault", entry);
    auto *ok = Block::Create(context, "root.result", entry);
    builder.CreateCondBr(hasFailure(failure), bad, ok);
    builder.SetInsertPoint(bad);
    auto *checkedFault = Block::Create(context, "root.checked_fault", entry);
    auto *executionError = Block::Create(context, "root.execution_error", entry);
    auto *rootKind = builder.CreateLoad(i32, builder.CreateStructGEP(failureType, failure, 0));
    builder.CreateCondBr(builder.CreateICmpEQ(rootKind, c32(1)), checkedFault, executionError);
    builder.SetInsertPoint(executionError);
    call("kalandra_expected_task_error_v1", voidType,
         {ctx, builder.CreateZExt(rootKind, i64), loadFailure(failure, 1), loadFailure(failure, 2),
          loadFailure(failure, 3)});
    builder.CreateRet(llvm::ConstantFP::get(f32, 0));
    builder.SetInsertPoint(checkedFault);
    Value *code = builder.CreateLoad(i64, builder.CreateStructGEP(failureType, failure, 1));
    code = builder.CreateSelect(builder.CreateICmpEQ(code, c64(0)), c64(3), code);
    call("kalandra_fault_v1", voidType,
         {ctx, code, loadFailure(failure, 2), loadFailure(failure, 3)});
    builder.CreateRet(llvm::ConstantFP::get(f32, 0));
    builder.SetInsertPoint(ok);
    auto *expected = Block::Create(context, "root.expected_error", entry);
    auto *success = Block::Create(context, "root.success", entry);
    auto *header = builder.CreateStructGEP(valueType(main->resultType), result, 0);
    builder.CreateCondBr(hasFailure(header), expected, success);
    builder.SetInsertPoint(expected);
    auto *kind = builder.CreateZExt(
        builder.CreateLoad(i32, builder.CreateStructGEP(failureType, header, 0)), i64);
    call("kalandra_expected_task_error_v1", voidType,
         {ctx, kind, loadFailure(header, 1), loadFailure(header, 2), loadFailure(header, 3)});
    builder.CreateRet(llvm::ConstantFP::get(f32, 0));
    builder.SetInsertPoint(success);
    builder.CreateRet(
        builder.CreateLoad(f32, builder.CreateStructGEP(valueType(main->resultType), result, 1)));
  }

private:
  llvm::ConstantInt *c64(std::uint64_t n) { return builder.getInt64(n); }
  llvm::ConstantInt *c32(std::uint32_t n) { return builder.getInt32(n); }
  Function *function(const std::string &name, Type *result, const std::vector<Type *> &args) {
    return Function::Create(llvm::FunctionType::get(result, args, false),
                            llvm::GlobalValue::InternalLinkage, name, module);
  }
  Value *call(const char *name, Type *result, std::initializer_list<Value *> args) {
    std::vector<Type *> types;
    for (auto *arg : args)
      types.push_back(arg->getType());
    return builder.CreateCall(
        module.getOrInsertFunction(name, llvm::FunctionType::get(result, types, false)), args);
  }
  std::uint64_t size(Type *type) const { return module.getDataLayout().getTypeAllocSize(type); }
  std::uint64_t alignment(Type *type) const {
    return module.getDataLayout().getABITypeAlign(type).value();
  }
  llvm::StructType *descriptor(const ValueType &type) {
    auto *dims = llvm::ArrayType::get(i64, type.shape.size());
    return llvm::StructType::get(context, {pointer, pointer, i64, dims, dims});
  }
  std::string key(const ValueType &type) {
    return type.task     ? "handle"
           : type.tensor ? "tensor" + std::to_string(type.shape.size())
                         : "scalar";
  }
  llvm::StructType *valueType(const ValueType &type) {
    const auto name = key(type);
    if (auto found = values.find(name); found != values.end())
      return found->second;
    Type *payload = type.task     ? static_cast<Type *>(handleType)
                    : type.tensor ? static_cast<Type *>(descriptor(type))
                                  : f32;
    return values[name] =
               llvm::StructType::create(context, {failureType, payload}, "result." + name);
  }
  void copy(Value *output, Value *input, Type *type) {
    builder.CreateMemCpy(output, llvm::MaybeAlign(alignment(type)), input,
                         llvm::MaybeAlign(alignment(type)), size(type));
  }
  Value *loadFailure(Value *pointer, unsigned index) {
    return builder.CreateLoad(i64, builder.CreateStructGEP(failureType, pointer, index));
  }
  Value *hasFailure(Value *pointer) {
    return builder.CreateICmpNE(
        builder.CreateLoad(i32, builder.CreateStructGEP(failureType, pointer, 0)), c32(0));
  }
  llvm::GlobalVariable *layout(const ValueType &type) {
    const auto name = key(type);
    if (auto found = layouts.find(name); found != layouts.end())
      return found->second;
    llvm::IRBuilderBase::InsertPointGuard guard(builder);
    auto *wrapper = valueType(type);
    auto *fn = function("value.copy." + name, boolean, {pointer, pointer, pointer, pointer});
    builder.SetInsertPoint(Block::Create(context, "entry", fn));
    auto *ready = Block::Create(context, "copy", fn);
    if (type.tensor) {
      auto *retain = Block::Create(context, "retain", fn);
      builder.CreateCondBr(hasFailure(builder.CreateStructGEP(wrapper, fn->getArg(3), 0)), ready,
                           retain);
      builder.SetInsertPoint(retain);
      auto *tensor = builder.CreateStructGEP(wrapper, fn->getArg(3), 1);
      auto *allocated =
          builder.CreateLoad(pointer, builder.CreateStructGEP(descriptor(type), tensor, 0));
      auto *success =
          call("kalandra_retain_v1", boolean, {fn->getArg(0), fn->getArg(2), allocated});
      auto *failed = Block::Create(context, "failed", fn);
      builder.CreateCondBr(success, ready, failed);
      builder.SetInsertPoint(failed);
      builder.CreateRet(builder.getFalse());
    } else
      builder.CreateBr(ready);
    builder.SetInsertPoint(ready);
    copy(fn->getArg(1), fn->getArg(3), wrapper);
    builder.CreateRet(builder.getTrue());
    auto *constant = llvm::ConstantStruct::get(
        layoutType, {c64(type.tensor ? type.shape.size() + 2 : 1), c64(size(wrapper)),
                     c64(alignment(wrapper)), fn, destroy});
    return layouts[name] = new llvm::GlobalVariable(module, layoutType, true,
                                                    llvm::GlobalValue::InternalLinkage, constant,
                                                    "value.layout." + name);
  }
  void fillPacket(Value *packet, std::size_t target, Value *data, Value *ctx) {
    builder.CreateStore(c64(target + 100), builder.CreateStructGEP(packetType, packet, 0));
    builder.CreateStore(data, builder.CreateStructGEP(packetType, packet, 1));
    builder.CreateStore(c64(size(packets[target])), builder.CreateStructGEP(packetType, packet, 2));
    builder.CreateStore(ctx, builder.CreateStructGEP(packetType, packet, 3));
  }
  void emitPlan(std::size_t id) {
    const auto &plan = *planner.plans[id];
    auto *frameType = frames[id];
    auto *construct =
        function("task.construct." + std::to_string(id), boolean, {pointer, pointer, pointer});
    builder.SetInsertPoint(Block::Create(context, "entry", construct));
    builder.CreateMemSet(construct->getArg(1), builder.getInt8(0), size(frameType),
                         llvm::MaybeAlign(alignment(frameType)));
    auto *data =
        builder.CreateLoad(pointer, builder.CreateStructGEP(packetType, construct->getArg(2), 1));
    auto *source =
        builder.CreateLoad(pointer, builder.CreateStructGEP(packetType, construct->getArg(2), 3));
    auto *failed = Block::Create(context, "failed", construct);
    for (std::size_t n = 0; n < plan.parameters.size(); ++n) {
      auto slot = plan.parameters[n];
      auto *target = builder.CreateStructGEP(frameType, construct->getArg(1), slot + 1);
      auto *input = builder.CreateStructGEP(packets[id], data, n);
      auto *layoutValue = layout(plan.slots[slot]);
      auto *fn = llvm::cast<llvm::ConstantStruct>(layoutValue->getInitializer())->getOperand(3);
      auto *copyFn = llvm::cast<Function>(fn);
      auto *ok = builder.CreateCall(copyFn, {construct->getArg(0), target, source, input});
      auto *next = Block::Create(context, "parameter", construct);
      builder.CreateCondBr(ok, next, failed);
      builder.SetInsertPoint(next);
    }
    builder.CreateRet(builder.getTrue());
    builder.SetInsertPoint(failed);
    builder.CreateRet(builder.getFalse());
    auto *resume = function("task.resume." + std::to_string(id), voidType, {pointer});
    builder.SetInsertPoint(Block::Create(context, "entry", resume));
    auto *task = resume->getArg(0);
    auto *frame = call("kalandra_task_frame_v1", pointer, {task});
    auto *ctx = call("kalandra_task_context_v1", pointer, {task});
    auto *packet = builder.CreateAlloca(packetType);
    // Packet staging belongs to one resume interval, never to a suspended frame.
    std::unordered_map<std::size_t, Value *> staging;
    for (const auto &instruction : plan.code)
      if (instruction.code == Code::Spawn && !staging.contains(instruction.target))
        staging[instruction.target] = builder.CreateAlloca(packets[instruction.target]);
    auto *leave = Block::Create(context, "suspend", resume);
    auto *abort = Block::Create(context, "fault", resume);
    std::vector<Block *> blocks;
    for (std::size_t n = 0; n < plan.code.size(); ++n)
      blocks.push_back(Block::Create(context, "step." + std::to_string(n), resume));
    auto *pc = builder.CreateStructGEP(frameType, frame, 0);
    auto *dispatch = builder.CreateSwitch(builder.CreateLoad(i32, pc), abort, blocks.size());
    for (std::size_t n = 0; n < blocks.size(); ++n)
      dispatch->addCase(c32(n), blocks[n]);
    builder.SetInsertPoint(leave);
    builder.CreateRetVoid();
    builder.SetInsertPoint(abort);
    auto *status = call("kalandra_status_v1", i64, {ctx});
    status = builder.CreateSelect(builder.CreateICmpEQ(status, c64(0)), c64(3), status);
    call("kalandra_task_fault_v1", voidType, {task, status, c64(0), c64(0)});
    builder.CreateRetVoid();
    const auto slot = [&](Slot n) { return builder.CreateStructGEP(frameType, frame, n + 1); };
    const auto payload = [&](Slot n) {
      return builder.CreateStructGEP(valueType(plan.slots[n]), slot(n), 1);
    };
    const auto group = [&](std::size_t n) {
      return builder.CreateStructGEP(frameType, frame, plan.slots.size() + 1 + n);
    };
    for (std::size_t n = 0; n < plan.code.size(); ++n) {
      const auto &instruction = plan.code[n];
      builder.SetInsertPoint(blocks[n]);
      auto *next = n + 1 < blocks.size() ? blocks[n + 1] : abort;
      auto check = [&] {
        auto *status = call("kalandra_status_v1", i64, {ctx});
        builder.CreateCondBr(builder.CreateICmpEQ(status, c64(0)), next, abort);
      };
      auto wait = [&](Value *ready) {
        builder.CreateStore(c32(n), pc);
        auto *proceed = Block::Create(context, "ready", resume);
        builder.CreateCondBr(ready, proceed, leave);
        builder.SetInsertPoint(proceed);
      };
      const auto &type = plan.slots[instruction.output];
      switch (instruction.code) {
      case Code::Literal: {
        auto bits =
            std::get<Float32Literal>(planner.input.expressions[instruction.source].operation).bits;
        builder.CreateStore(
            llvm::ConstantFP::get(
                context, llvm::APFloat(llvm::APFloat::IEEEsingle(), llvm::APInt(32, bits))),
            payload(instruction.output));
        builder.CreateBr(next);
        break;
      }
      case Code::Unary: {
        Value *value = builder.CreateLoad(f32, payload(instruction.args[0]));
        if (std::get<ScalarUnary>(planner.input.expressions[instruction.source].operation)
                .operation == TokenKind::Minus)
          value = builder.CreateFNeg(value);
        builder.CreateStore(value, payload(instruction.output));
        builder.CreateBr(next);
        break;
      }
      case Code::Binary: {
        auto *a = builder.CreateLoad(f32, payload(instruction.args[0]));
        auto *b = builder.CreateLoad(f32, payload(instruction.args[1]));
        auto op = std::get<ScalarBinary>(planner.input.expressions[instruction.source].operation)
                      .operation;
        Value *value = op == TokenKind::Plus    ? builder.CreateFAdd(a, b)
                       : op == TokenKind::Minus ? builder.CreateFSub(a, b)
                       : op == TokenKind::Star  ? builder.CreateFMul(a, b)
                                                : builder.CreateFDiv(a, b);
        builder.CreateStore(value, payload(instruction.output));
        builder.CreateBr(next);
        break;
      }
      case Code::Kernel: {
        auto *fn =
            module.getFunction("_mlir_ciface_kalandra_fn_" + std::to_string(instruction.target));
        std::vector<Value *> arguments;
        if (type.tensor)
          arguments.push_back(payload(instruction.output));
        for (auto argument : instruction.args)
          arguments.push_back(plan.slots[argument].tensor
                                  ? payload(argument)
                                  : builder.CreateLoad(f32, payload(argument)));
        arguments.push_back(ctx);
        auto *value = builder.CreateCall(fn, arguments);
        if (!type.tensor) {
          auto *good = Block::Create(context, "kernel.result", resume);
          auto *status = call("kalandra_status_v1", i64, {ctx});
          builder.CreateCondBr(builder.CreateICmpEQ(status, c64(0)), good, abort);
          builder.SetInsertPoint(good);
          builder.CreateStore(value, payload(instruction.output));
          builder.CreateBr(next);
        } else
          check();
        break;
      }
      case Code::Copy:
        copy(slot(instruction.output), slot(instruction.args[0]), valueType(type));
        builder.CreateBr(next);
        break;
      case Code::Open: {
        call("kalandra_task_open_v1", voidType,
             {task,
              instruction.target == SIZE_MAX
                  ? static_cast<Value *>(llvm::ConstantPointerNull::get(builder.getPtrTy()))
                  : group(instruction.target),
              group(instruction.group)});
        auto *valid = builder.CreateLoad(
            i32, builder.CreateStructGEP(handleType, group(instruction.group), 0));
        builder.CreateCondBr(builder.CreateICmpNE(valid, c32(UINT32_MAX)), next, leave);
        break;
      }
      case Code::Spawn: {
        for (std::size_t i = 0; i < instruction.args.size(); ++i)
          copy(builder.CreateStructGEP(packets[instruction.target], staging[instruction.target], i),
               slot(instruction.args[i]), valueType(plan.slots[instruction.args[i]]));
        fillPacket(packet, instruction.target, staging[instruction.target], ctx);
        call("kalandra_task_spawn_v1", voidType,
             {task, group(instruction.group), entries[instruction.target], packet,
              payload(instruction.output)});
        builder.CreateBr(next);
        break;
      }
      case Code::Await: {
        auto *handle = payload(instruction.args[0]);
        wait(call("kalandra_task_await_v1", boolean, {task, handle}));
        auto *header = builder.CreateStructGEP(valueType(type), slot(instruction.output), 0);
        call("kalandra_task_failure_v1", voidType, {task, handle, header});
        auto *read = Block::Create(context, "await.success", resume);
        builder.CreateCondBr(hasFailure(header), next, read);
        builder.SetInsertPoint(read);
        auto *resultLayout = layout(
            planner.plans[instruction.target]->slots[planner.plans[instruction.target]->result]);
        auto *ok = call("kalandra_task_read_v1", boolean,
                        {task, handle, resultLayout, slot(instruction.output)});
        builder.CreateCondBr(ok, next, abort);
        break;
      }
      case Code::Try: {
        auto *header = builder.CreateStructGEP(valueType(plan.slots[instruction.args[0]]),
                                               slot(instruction.args[0]), 0);
        auto *propagate = Block::Create(context, "try.propagate", resume);
        auto *success = Block::Create(context, "try.success", resume);
        builder.CreateCondBr(hasFailure(header), propagate, success);
        builder.SetInsertPoint(propagate);
        if (instruction.group != SIZE_MAX)
          call("kalandra_task_fail_group_v1", voidType, {task, group(instruction.group), header});
        else
          copy(builder.CreateStructGEP(valueType(plan.slots[instruction.target]),
                                       slot(instruction.target), 0),
               header, failureType);
        builder.CreateBr(blocks[instruction.jump]);
        builder.SetInsertPoint(success);
        copy(slot(instruction.output), slot(instruction.args[0]), valueType(type));
        builder.CreateBr(next);
        break;
      }
      case Code::Join: {
        call("kalandra_task_close_v1", voidType, {task, group(instruction.group)});
        wait(call("kalandra_task_join_v1", boolean, {task, group(instruction.group)}));
        auto *header = builder.CreateStructGEP(valueType(type), slot(instruction.output), 0);
        call("kalandra_group_failure_v1", voidType, {task, group(instruction.group), header});
        auto *success = Block::Create(context, "group.success", resume);
        builder.CreateCondBr(hasFailure(header), next, success);
        builder.SetInsertPoint(success);
        copy(slot(instruction.output), slot(instruction.args[0]), valueType(type));
        builder.CreateBr(next);
        break;
      }
      case Code::Label:
        builder.CreateBr(next);
        break;
      case Code::Return:
        call("kalandra_task_complete_v1", voidType, {task, slot(instruction.args[0])});
        builder.CreateRetVoid();
        break;
      }
    }
    auto *resultLayout = layout(plan.slots[plan.result]);
    entries[id]->setInitializer(llvm::ConstantStruct::get(
        entryType, {c32(1), c64(id + 100), c64(size(packets[id])), c64(alignment(packets[id])),
                    c64(size(frameType)), c64(alignment(frameType)), construct, destroy, resume,
                    resultLayout}));
  }
};
} // namespace
std::expected<BackendOutput, std::string> lowerTaskNative(const TypedModule &input,
                                                          std::optional<std::string> testEntry) {
  if (testEntry)
    return std::unexpected(
        "private runtime-input test wrappers for task programs are not implemented yet");
  try {
    Planner planner(input);
    auto kernels = lowerNative(planner.kernels);
    if (!kernels)
      return kernels;
    llvm::LLVMContext context;
    llvm::SMDiagnostic diagnostic;
    auto module = llvm::parseAssemblyString(kernels->llvm, diagnostic, context);
    if (!module)
      return std::unexpected("cannot read verified kernel LLVM module");
    Emitter(planner, *module).run();
    std::string errors;
    llvm::raw_string_ostream stream(errors);
    if (llvm::verifyModule(*module, &stream))
      return std::unexpected("task LLVM verification failed: " + errors);
    BackendOutput result;
    result.mlir = std::move(kernels->mlir);
    {
      llvm::raw_string_ostream output(result.llvm);
      module->print(output, nullptr);
    }
    return result;
  } catch (const std::exception &error) {
    return std::unexpected(error.what());
  }
}
} // namespace kalandra
