#include "kalandra/Backend.h"
#include "kalandra/Continuation.h"
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
using namespace continuation;
class Emitter {
  using Type = llvm::Type;
  using Value = llvm::Value;
  using Function = llvm::Function;
  using Block = llvm::BasicBlock;
  ModulePlan &planner;
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
  Emitter(ModulePlan &planner, llvm::Module &module)
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
  void run(const std::optional<std::string> &testEntry) {
    for (std::size_t id = 0; id < planner.plans.size(); ++id)
      emitPlan(id);
    if (testEntry) {
      const auto found = std::ranges::find_if(planner.input.functions,
                                           [&](const auto &f) { return f.name == *testEntry; });
      if (found == planner.input.functions.end() || !found->parameters.empty() ||
          found->resultType.builtin != BuiltinValue::Numeric)
        throw std::runtime_error("private task test entry requires a parameterless numeric function");
      const auto id = std::size_t(found - planner.input.functions.begin());
      // Trusted native test export, not a dynamic/public task or wire ABI.
      new llvm::GlobalVariable(module, pointer, true, llvm::GlobalValue::ExternalLinkage,
                               entries[id], "kalandra_task_test_entry");
    }
    auto main = std::ranges::find_if(planner.input.functions,
                                     [](const auto &f) { return f.name == "main"; });
    if (main == planner.input.functions.end() || !main->parameters.empty() ||
        main->resultType.tensor || main->resultType.builtin != BuiltinValue::Numeric)
      throw std::runtime_error("native task entry requires parameterless float32, int32 or uint32 main");
    const auto id = std::size_t(main - planner.input.functions.begin());
    auto *entry = module.getFunction("_mlir_ciface_kalandra_entry");
    if (isInteger32(main->resultType.element)) {
      entry->eraseFromParent();
      entry = Function::Create(llvm::FunctionType::get(i32, {pointer}, false),
                               llvm::GlobalValue::ExternalLinkage,
                               main->resultType.element == NumericType::UInt32 ? "_mlir_ciface_kalandra_uint32_entry" : "_mlir_ciface_kalandra_int32_entry", module);
    } else
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
    builder.CreateRet(llvm::Constant::getNullValue(scalarType(main->resultType)));
    builder.SetInsertPoint(checkedFault);
    Value *code = builder.CreateLoad(i64, builder.CreateStructGEP(failureType, failure, 1));
    code = builder.CreateSelect(builder.CreateICmpEQ(code, c64(0)), c64(3), code);
    call("kalandra_fault_v1", voidType,
         {ctx, code, loadFailure(failure, 2), loadFailure(failure, 3)});
    builder.CreateRet(llvm::Constant::getNullValue(scalarType(main->resultType)));
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
    builder.CreateRet(llvm::Constant::getNullValue(scalarType(main->resultType)));
    builder.SetInsertPoint(success);
    builder.CreateRet(
        builder.CreateLoad(scalarType(main->resultType),
                           builder.CreateStructGEP(valueType(main->resultType), result, 1)));
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
  Type *scalarType(const ValueType &type) const {
    return isInteger32(type.element) ? i32 : f32;
  }
  std::string key(const ValueType &type) {
    return type.builtin == BuiltinValue::TaskError   ? "TaskError"
           : type.builtin == BuiltinValue::FaultKind ? "FaultKind"
           : type.builtin == BuiltinValue::String    ? "String"
           : type.task                               ? "handle"
           : type.tensor                             ? (type.element == NumericType::UInt32 ? "tensor.uint32."
                                                        : type.element == NumericType::Int32 ? "tensor.int32." : "tensor") +
                                                         std::to_string(type.shape.size())
                                                     : type.element == NumericType::UInt32 ? "scalar.uint32" : type.element == NumericType::Int32 ? "scalar.int32" : "scalar";
  }
  llvm::StructType *valueType(const ValueType &type) {
    const auto name = key(type);
    if (auto found = values.find(name); found != values.end())
      return found->second;
    Type *payload = type.builtin == BuiltinValue::TaskError   ? static_cast<Type *>(failureType)
                    : type.builtin == BuiltinValue::FaultKind ? i32
                    : type.builtin == BuiltinValue::String
                        ? static_cast<Type *>(llvm::StructType::get(context, {pointer, i64}))
                    : type.task   ? static_cast<Type *>(handleType)
                    : type.tensor ? static_cast<Type *>(descriptor(type))
                                  : scalarType(type);
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
        layoutType,
        {c64(type.builtin != BuiltinValue::Numeric ? 0x10000 + static_cast<unsigned>(type.builtin)
             : type.tensor                         ? (isInteger32(type.element)
                                                        ? 0x30000 + 16 * static_cast<unsigned>(type.element) + type.shape.size()
                                                        : type.shape.size() + 2)
                                                   : isInteger32(type.element)
                                                       ? 0x20000 + static_cast<unsigned>(type.element) : 1),
         c64(size(wrapper)), c64(alignment(wrapper)), fn, destroy});
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
    auto *cancelled = call("kalandra_task_cancelled_v1", boolean, {task});
    auto *cancelExit = Block::Create(context, "cancelled", resume);
    auto *faultExit = Block::Create(context, "checked.fault", resume);
    builder.CreateCondBr(builder.CreateAnd(cancelled, builder.CreateICmpEQ(status, c64(0))),
                         cancelExit, faultExit);
    builder.SetInsertPoint(cancelExit);
    builder.CreateRetVoid();
    builder.SetInsertPoint(faultExit);
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
        auto *status = call("kalandra_poll_v1", i64, {ctx});
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
        const auto &literal = planner.input.expressions[instruction.source].operation;
        if (const auto *integer = std::get_if<Int32Literal>(&literal)) {
          builder.CreateStore(c32(static_cast<std::uint32_t>(integer->value)), payload(instruction.output));
          builder.CreateBr(next);
          break;
        }
        if (const auto *integer = std::get_if<UInt32Literal>(&literal)) {
          builder.CreateStore(c32(integer->value), payload(instruction.output));
          builder.CreateBr(next);
          break;
        }
        auto bits = std::get<Float32Literal>(literal).bits;
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
        // A shape refinement on a result must preserve an error without reading
        // its absent tensor payload. Only the success path enters the kernel.
        if (std::holds_alternative<ShapeCheck>(
                planner.input.expressions[instruction.source].operation) &&
            plan.slots[instruction.args[0]].fallible) {
          auto input = instruction.args[0];
          auto *header = builder.CreateStructGEP(valueType(plan.slots[input]), slot(input), 0);
          auto *error = Block::Create(context, "refine.error", resume);
          auto *success = Block::Create(context, "refine.success", resume);
          builder.CreateCondBr(hasFailure(header), error, success);
          builder.SetInsertPoint(error);
          copy(builder.CreateStructGEP(valueType(type), slot(instruction.output), 0), header,
               failureType);
          builder.CreateBr(next);
          builder.SetInsertPoint(success);
        }
        auto *fn =
            module.getFunction("_mlir_ciface_kalandra_fn_" + std::to_string(instruction.target));
        std::vector<Value *> arguments;
        if (type.tensor)
          arguments.push_back(payload(instruction.output));
        for (auto argument : instruction.args)
          arguments.push_back(plan.slots[argument].tensor
                                  ? payload(argument)
                                  : builder.CreateLoad(scalarType(plan.slots[argument]), payload(argument)));
        arguments.push_back(ctx);
        auto *value = builder.CreateCall(fn, arguments);
        if (!type.tensor) {
          auto *good = Block::Create(context, "kernel.result", resume);
          auto *status = call("kalandra_poll_v1", i64, {ctx});
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
      case Code::Fail:
      case Code::Try: {
        auto *header = builder.CreateStructGEP(valueType(plan.slots[instruction.args[0]]),
                                               slot(instruction.args[0]),
                                               instruction.code == Code::Fail ? 1 : 0);
        auto *propagate = Block::Create(context, "try.propagate", resume);
        auto *success = Block::Create(context, "try.success", resume);
        if (instruction.code == Code::Fail)
          builder.CreateBr(propagate);
        else
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
      case Code::Catch: {
        auto input = instruction.args[0];
        auto *header = builder.CreateStructGEP(valueType(plan.slots[input]), slot(input), 0);
        auto *handle = Block::Create(context, "catch.error", resume);
        auto *success = Block::Create(context, "catch.success", resume);
        builder.CreateCondBr(hasFailure(header), handle, success);
        builder.SetInsertPoint(handle);
        copy(payload(instruction.args[1]), header, failureType);
        builder.CreateBr(blocks[instruction.jump]);
        builder.SetInsertPoint(success);
        copy(slot(instruction.output), slot(input), valueType(type));
        builder.CreateBr(blocks[instruction.target]);
        break;
      }
      case Code::Case: {
        auto subject = instruction.args[0];
        auto *tagAddress = plan.slots[subject].builtin == BuiltinValue::TaskError
                               ? builder.CreateStructGEP(failureType, payload(subject), 0)
                               : payload(subject);
        auto *tag = builder.CreateLoad(i32, tagAddress);
        builder.CreateCondBr(builder.CreateICmpEQ(tag, c32(instruction.target)), next,
                             instruction.jump == SIZE_MAX ? abort : blocks[instruction.jump]);
        break;
      }
      case Code::Jump:
        builder.CreateBr(blocks[instruction.jump]);
        break;
      case Code::Field: {
        auto *error = payload(instruction.args[0]);
        auto *code = loadFailure(error, 1);
        auto field = static_cast<ErrorField>(instruction.target);
        if (field == ErrorField::Kind) {
          auto *kind = builder.CreateSelect(
              builder.CreateICmpEQ(code, c64(1)), c32(3),
              builder.CreateSelect(builder.CreateICmpEQ(code, c64(2)), c32(4),
                                   builder.CreateSelect(builder.CreateICmpEQ(code, c64(4)), c32(1), c32(5))));
          builder.CreateStore(kind, payload(instruction.output));
        } else {
          auto *textType = llvm::cast<llvm::StructType>(valueType(type)->getElementType(1));
          auto text = [&](const char *message) -> Value * {
            return llvm::ConstantStruct::get(
                textType, {llvm::cast<llvm::Constant>(builder.CreateGlobalString(message)),
                           c64(std::char_traits<char>::length(message))});
          };
          Value *message;
          if (field == ErrorField::Reason)
            message = text("task admission rejected");
          else
            message = builder.CreateSelect(
                builder.CreateICmpEQ(code, c64(1)), text("tensor shape mismatch"),
                builder.CreateSelect(builder.CreateICmpEQ(code, c64(2)), text("allocation failed"),
                                     builder.CreateSelect(builder.CreateICmpEQ(code, c64(4)),
                                                          text("integer arithmetic fault"),
                                                          text("native execution fault"))));
          builder.CreateStore(message, payload(instruction.output));
        }
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
      case Code::Call:
      case Code::Device:
      case Code::Transfer:
        throw std::runtime_error("CPU emitter received an unsupported placed operation");
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
  if (auto error = numericCapabilityError(input, NumericTarget::Cpu))
    return std::unexpected(*error);
  if (hasPlacement(input))
    return std::unexpected("placement-aware IR requires a placement-capable execution backend");
  try {
    auto planned = continuation::plan(input);
    if (!planned)
      return std::unexpected(planned.error());
    auto &planner = *planned;
    auto kernels = lowerNative(planner.kernels);
    if (!kernels)
      return kernels;
    llvm::LLVMContext context;
    llvm::SMDiagnostic diagnostic;
    auto module = llvm::parseAssemblyString(kernels->llvm, diagnostic, context);
    if (!module)
      return std::unexpected("cannot read verified kernel LLVM module");
    Emitter(planner, *module).run(testEntry);
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
