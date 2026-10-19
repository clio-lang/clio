#include "CollectionMetadata.h"
#include "ErrorFamilies.h"
#include "NativeLayout.h"
#include "RecordLayout.h"
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
  std::map<std::size_t, Type *> recordTypes;
  std::map<std::string, llvm::GlobalVariable *> layouts;
  std::vector<llvm::StructType *> frames, packets;
  std::vector<std::map<std::size_t, std::size_t>> observationFields;
  std::vector<llvm::GlobalVariable *> entries;
  Function *destroy;

public:
  Emitter(ModulePlan &planner, llvm::Module &module)
      : planner(planner), module(module), context(module.getContext()), builder(context) {
    module.setDataLayout(nativeCpuDataLayout);
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
      // Widening observes a child using its own layout. Keep that temporary
      // in the budgeted frame rather than growing the native worker stack.
      observationFields.emplace_back();
      for (const auto &instruction : plan.code)
        if (instruction.code == Code::Await &&
            !observationFields.back().contains(instruction.target)) {
          const auto &child = *planner.plans[instruction.target];
          if (key(child.slots[child.result]) != key(plan.slots[instruction.output])) {
            observationFields.back()[instruction.target] = fields.size();
            fields.push_back(valueType(child.slots[child.result]));
          }
        }
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
      if (found == planner.input.functions.end() ||
          (!found->parameters.empty() && found->resultType.builtin != BuiltinValue::Record &&
           !isBoolArray(found->resultType) && found->resultType.builtin != BuiltinValue::String) ||
          (found->resultType.builtin != BuiltinValue::Numeric &&
           found->resultType.builtin != BuiltinValue::Bool &&
           found->resultType.builtin != BuiltinValue::Record &&
           found->resultType.builtin != BuiltinValue::String))
        throw std::runtime_error("private task test entry requires a parameterless numeric/Bool "
                                 "function or a record/String function with typed parameters");
      const auto id = std::size_t(found - planner.input.functions.begin());
      // Trusted native test export, not a dynamic/public task or wire ABI.
      new llvm::GlobalVariable(module, pointer, true, llvm::GlobalValue::ExternalLinkage,
                               entries[id], "kalandra_task_test_entry");
    }
    auto main = std::ranges::find_if(planner.input.functions,
                                     [](const auto &f) { return f.name == "main"; });
    if (main == planner.input.functions.end() || !main->parameters.empty() ||
        (main->resultType.builtin != BuiltinValue::Numeric &&
         main->resultType.builtin != BuiltinValue::Bool &&
         main->resultType.builtin != BuiltinValue::String))
      throw std::runtime_error(
          "native task entry requires parameterless float32, int32, uint32, "
          "int64, uint64, float64, Bool, String or CPU numeric array/tensor main");
    const auto id = std::size_t(main - planner.input.functions.begin());
    auto *entry = module.getFunction("_mlir_ciface_kalandra_entry");
    const bool stringResult =
        main->resultType.builtin == BuiltinValue::String && !main->resultType.tensor;
    const bool indirectResult = main->resultType.tensor || stringResult;
    if (indirectResult) {
      if (!stringResult)
        collectionMetadata(module, main->resultType);
      entry->eraseFromParent();
      entry = Function::Create(llvm::FunctionType::get(voidType, {pointer, pointer}, false),
                               llvm::GlobalValue::ExternalLinkage,
                               stringResult ? "_mlir_ciface_kalandra_string_entry"
                                            : "_mlir_ciface_kalandra_collection_entry",
                               module);
    } else if (main->resultType.builtin == BuiltinValue::Bool ||
               isInteger(main->resultType.element) ||
               main->resultType.element == NumericType::Float64) {
      entry->eraseFromParent();
      entry = Function::Create(
          llvm::FunctionType::get(
              isNarrowInteger(main->resultType.element) ? i64 : scalarType(main->resultType),
              {pointer}, false),
          llvm::GlobalValue::ExternalLinkage,
          main->resultType.builtin == BuiltinValue::Bool     ? "_mlir_ciface_kalandra_bool_entry"
          : main->resultType.element == NumericType::Float64 ? "_mlir_ciface_kalandra_float64_entry"
          : (main->resultType.element == NumericType::UInt64 ||
             main->resultType.element == NumericType::UInt8 ||
             main->resultType.element == NumericType::UInt16)
              ? "_mlir_ciface_kalandra_uint64_entry"
          : (main->resultType.element == NumericType::Int64 ||
             main->resultType.element == NumericType::Int8 ||
             main->resultType.element == NumericType::Int16)
              ? "_mlir_ciface_kalandra_int64_entry"
          : main->resultType.element == NumericType::UInt32 ? "_mlir_ciface_kalandra_uint32_entry"
                                                            : "_mlir_ciface_kalandra_int32_entry",
          module);
    } else
      entry->deleteBody();
    builder.SetInsertPoint(Block::Create(context, "entry", entry));
    auto *ctx = entry->getArg(indirectResult ? 1 : 0);
    const auto returnFailure = [&] {
      if (indirectResult)
        builder.CreateRetVoid();
      else
        builder.CreateRet(llvm::Constant::getNullValue(entry->getReturnType()));
    };
    if (stringResult)
      builder.CreateStore(llvm::Constant::getNullValue(scalarType(main->resultType)),
                          entry->getArg(0));
    else if (main->resultType.tensor)
      builder.CreateMemSet(entry->getArg(0), builder.getInt8(0), size(descriptor(main->resultType)),
                           llvm::MaybeAlign(alignment(descriptor(main->resultType))));
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
    returnFailure();
    builder.SetInsertPoint(checkedFault);
    Value *code = builder.CreateLoad(i64, builder.CreateStructGEP(failureType, failure, 1));
    code = builder.CreateSelect(builder.CreateICmpEQ(code, c64(0)), c64(3), code);
    call("kalandra_fault_v1", voidType,
         {ctx, code, loadFailure(failure, 2), loadFailure(failure, 3)});
    returnFailure();
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
    returnFailure();
    builder.SetInsertPoint(success);
    if (main->resultType.errorRecord) {
      const auto family = *main->resultType.errorRecord;
      const auto &record = planner.input.records[family];
      auto *data = application(main->resultType, result);
      auto *tag = builder.CreateLoad(
          i64, builder.CreateStructGEP(scalarType(errorRecordType(family)), data, 0));
      auto *valid = Block::Create(context, "root.application.success", entry);
      auto *invalid = Block::Create(context, "root.application.invalid", entry);
      auto *dispatch = builder.CreateSwitch(tag, invalid, record.variants.size() + 1);
      dispatch->addCase(c64(0), valid);
      for (std::size_t i = 0; i < record.variants.size(); ++i) {
        auto *report = Block::Create(context, "root.application.error", entry);
        dispatch->addCase(c64(i + 1), report);
        builder.SetInsertPoint(report);
        const auto [original, variant] = errorOrigin(planner.input, family, i);
        const auto &source = planner.input.records[original];
        if (source.taskErrorFamily) {
          const auto slot = record.variants[i].fields.front();
          auto *failure = builder.CreateStructGEP(scalarType(errorRecordType(family)), data, slot);
          call("kalandra_expected_task_error_v1", voidType,
               {ctx,
                builder.CreateZExt(
                    builder.CreateLoad(i32, builder.CreateStructGEP(failureType, failure, 0)), i64),
                loadFailure(failure, 1), loadFailure(failure, 2), loadFailure(failure, 3)});
        } else
          call("kalandra_expected_application_error_v1", voidType,
               {ctx, builder.CreateGlobalString(source.name),
                builder.CreateGlobalString(source.variants[variant].name)});
        returnFailure();
      }
      builder.SetInsertPoint(invalid);
      call("kalandra_fault_v1", voidType, {ctx, c64(3), c64(0), c64(0)});
      returnFailure();
      builder.SetInsertPoint(valid);
    }
    auto *payload = builder.CreateStructGEP(valueType(main->resultType), result, 1);
    if (indirectResult) {
      copy(entry->getArg(0), payload, scalarType(main->resultType));
      builder.CreateRetVoid();
    } else {
      Value *value = builder.CreateLoad(scalarType(main->resultType), payload);
      if (isNarrowInteger(main->resultType.element))
        value = isUnsigned(main->resultType.element) ? builder.CreateZExt(value, i64)
                                                     : builder.CreateSExt(value, i64);
      if (hasRecordBacking(planner.input) ||
          std::ranges::any_of(planner.input.expressions,
                              [](const auto &e) { return e.type.builtin == BuiltinValue::String; }))
        call("kalandra_record_cleanup_v1", voidType, {ctx});
      builder.CreateRet(value);
    }
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
  Type *scalarType(const ValueType &type) {
    if (type.builtin == BuiltinValue::Function)
      return pointer;
    if (type.tensor)
      return descriptor(type);
    if (type.builtin == BuiltinValue::Record) {
      if (auto found = recordTypes.find(*type.record); found != recordTypes.end())
        return found->second;
      std::vector<Type *> fields;
      for (const auto &field : planner.input.records.at(*type.record).fields)
        fields.push_back(scalarType(field.type));
      return recordTypes[*type.record] = llvm::StructType::get(context, fields);
    }
    if (type.builtin == BuiltinValue::TaskError)
      return failureType;
    if (type.builtin == BuiltinValue::FaultKind)
      return i32;
    if (type.builtin == BuiltinValue::Bool)
      return boolean;
    if (type.builtin == BuiltinValue::String)
      return llvm::StructType::get(context, {pointer, pointer, i64});
    return isInteger(type.element) ? builder.getIntNTy(describeNumeric(type.element)->bits)
           : type.element == NumericType::Float64 ? Type::getDoubleTy(context)
                                                  : f32;
  }
  std::string payloadKey(const ValueType &type) {
    if (type.task)
      return "handle";
    if (type.builtin == BuiltinValue::Function)
      return "function.reference";
    if (isStringArray(type) && !type.task)
      return "array.String";
    if (isBoolArray(type) && !type.task)
      return "array.Bool";
    if (isRecordArray(type) && !type.task)
      return "record.array." + std::to_string(*type.record);
    if (type.builtin == BuiltinValue::Record && !type.task)
      return "record." + std::to_string(*type.record);
    if (type.array && !type.task)
      return "array." + std::string(describeNumeric(type.element)->name);
    if (type.builtin == BuiltinValue::Numeric && !type.task && type.tensor &&
        (isInteger(type.element) || type.element == NumericType::Float64))
      return "tensor." + std::string(describeNumeric(type.element)->name) + "." +
             std::to_string(type.shape.size());
    return type.builtin == BuiltinValue::TaskError   ? "TaskError"
           : type.builtin == BuiltinValue::FaultKind ? "FaultKind"
           : type.builtin == BuiltinValue::String    ? "String"
           : type.task                               ? "handle"
           : type.builtin == BuiltinValue::Bool      ? "Bool"
           : type.tensor                             ? "tensor" + std::to_string(type.shape.size())
           : type.element == NumericType::Float64    ? "scalar.float64"
           : type.element == NumericType::UInt64     ? "scalar.uint64"
           : type.element == NumericType::Int64      ? "scalar.int64"
           : type.element == NumericType::UInt32     ? "scalar.uint32"
           : type.element == NumericType::Int32      ? "scalar.int32"
           : type.element == NumericType::Int16      ? "scalar.int16"
           : type.element == NumericType::UInt16     ? "scalar.uint16"
           : type.element == NumericType::Int8       ? "scalar.int8"
           : type.element == NumericType::UInt8      ? "scalar.uint8"
                                                     : "scalar";
  }

  std::string key(const ValueType &type) {
    return payloadKey(type) +
           (type.errorRecord ? ".error." + std::to_string(*type.errorRecord) : "");
  }
  ValueType errorRecordType(std::size_t id) {
    ValueType type;
    type.builtin = BuiltinValue::Record;
    type.record = id;
    return type;
  }
  llvm::StructType *valueType(const ValueType &type) {
    const auto name = key(type);
    if (auto found = values.find(name); found != values.end())
      return found->second;
    Type *payload = type.task                                 ? static_cast<Type *>(handleType)
                    : type.builtin == BuiltinValue::TaskError ? static_cast<Type *>(failureType)
                    : type.builtin == BuiltinValue::FaultKind ? i32
                    : type.tensor ? static_cast<Type *>(descriptor(type))
                                  : scalarType(type);
    std::vector<Type *> fields{failureType, payload};
    if (type.errorRecord)
      fields.push_back(scalarType(errorRecordType(*type.errorRecord)));
    return values[name] = llvm::StructType::create(context, fields, "result." + name);
  }
  void copy(Value *output, Value *input, Type *type) {
    builder.CreateMemCpy(output, llvm::MaybeAlign(alignment(type)), input,
                         llvm::MaybeAlign(alignment(type)), size(type));
  }
  Value *application(const ValueType &type, Value *slot) {
    return builder.CreateStructGEP(valueType(type), slot, 2);
  }
  Value *hasResultError(const ValueType &type, Value *slot) {
    auto *failure = hasFailure(builder.CreateStructGEP(valueType(type), slot, 0));
    if (!type.errorRecord)
      return failure;
    auto *record = application(type, slot);
    auto *tag = builder.CreateLoad(
        i64, builder.CreateStructGEP(scalarType(errorRecordType(*type.errorRecord)), record, 0));
    return builder.CreateOr(failure, builder.CreateICmpNE(tag, c64(0)));
  }
  void copyErrorValue(std::size_t target, Value *output, std::size_t source, Value *input) {
    auto *outType = scalarType(errorRecordType(target));
    auto *inType = scalarType(errorRecordType(source));
    if (source == target) {
      copy(output, input, outType);
      return;
    }
    if (!errorSubset(planner.input, source, target))
      throw std::runtime_error("error conversion loses a declared family");
    const auto &from = planner.input.records[source], &to = planner.input.records[target];
    builder.CreateStore(llvm::Constant::getNullValue(outType), output);
    auto *fn = builder.GetInsertBlock()->getParent();
    auto *done = Block::Create(context, "error.converted", fn);
    auto *invalid = Block::Create(context, "error.invalid", fn);
    auto *tag = builder.CreateLoad(i64, builder.CreateStructGEP(inType, input, 0));
    auto *dispatch = builder.CreateSwitch(tag, invalid, from.variants.size() + 1);
    dispatch->addCase(c64(0), done);
    for (std::size_t i = 0; i < from.variants.size(); ++i) {
      auto origin = errorOrigin(planner.input, source, i);
      std::size_t j = 0;
      while (j < to.variants.size() && errorOrigin(planner.input, target, j) != origin)
        ++j;
      if (j == to.variants.size())
        throw std::runtime_error("missing error-union variant");
      auto *active = Block::Create(context, "error.inject", fn);
      dispatch->addCase(c64(i + 1), active);
      builder.SetInsertPoint(active);
      builder.CreateStore(c64(j + 1), builder.CreateStructGEP(outType, output, 0));
      for (std::size_t field = 0; field < from.variants[i].fields.size(); ++field) {
        const auto a = from.variants[i].fields[field], b = to.variants[j].fields[field];
        copy(builder.CreateStructGEP(outType, output, b), builder.CreateStructGEP(inType, input, a),
             scalarType(from.fields[a].type));
      }
      builder.CreateBr(done);
    }
    builder.SetInsertPoint(invalid);
    builder.CreateStore(c64(UINT64_MAX), builder.CreateStructGEP(outType, output, 0));
    builder.CreateBr(done);
    builder.SetInsertPoint(done);
  }
  void injectTaskError(std::size_t target, Value *output, Value *failure) {
    if (!errorSubset(planner.input, {}, target))
      throw std::runtime_error("destination does not cover TaskError");
    const auto &record = planner.input.records[target];
    auto *outType = scalarType(errorRecordType(target));
    builder.CreateStore(llvm::Constant::getNullValue(outType), output);
    auto *fn = builder.GetInsertBlock()->getParent();
    auto *done = Block::Create(context, "task.error.injected", fn);
    auto *invalid = Block::Create(context, "task.error.invalid", fn);
    auto *kind = builder.CreateLoad(i32, builder.CreateStructGEP(failureType, failure, 0));
    auto *dispatch = builder.CreateSwitch(kind, invalid, 4);
    for (std::size_t i = 0; i < record.variants.size(); ++i) {
      const auto [original, variant] = errorOrigin(planner.input, target, i);
      if (!planner.input.records[original].taskErrorFamily)
        continue;
      auto *active = Block::Create(context, "task.error.payload", fn);
      dispatch->addCase(c32(variant + 1), active);
      builder.SetInsertPoint(active);
      builder.CreateStore(c64(i + 1), builder.CreateStructGEP(outType, output, 0));
      copy(builder.CreateStructGEP(outType, output, record.variants[i].fields.front()), failure,
           failureType);
      builder.CreateBr(done);
    }
    builder.SetInsertPoint(invalid);
    builder.CreateStore(c64(UINT64_MAX), builder.CreateStructGEP(outType, output, 0));
    builder.CreateBr(done);
    builder.SetInsertPoint(done);
  }
  void copyErrorPayload(std::size_t target, Value *output, const ValueType &source, Value *input) {
    if (source.errorRecord)
      copyErrorValue(target, output, *source.errorRecord, application(source, input));
    else
      builder.CreateStore(llvm::Constant::getNullValue(scalarType(errorRecordType(target))),
                          output);
    if (errorSubset(planner.input, {}, target)) {
      auto *fn = builder.GetInsertBlock()->getParent();
      auto *active = Block::Create(context, "task.error.normalize", fn);
      auto *done = Block::Create(context, "task.error.normalized", fn);
      auto *header = builder.CreateStructGEP(valueType(source), input, 0);
      builder.CreateCondBr(hasFailure(header), active, done);
      builder.SetInsertPoint(active);
      injectTaskError(target, output, header);
      builder.CreateBr(done);
      builder.SetInsertPoint(done);
    }
  }
  void copyErrors(const ValueType &outType, Value *output, const ValueType &inType, Value *input) {
    copy(builder.CreateStructGEP(valueType(outType), output, 0),
         builder.CreateStructGEP(valueType(inType), input, 0), failureType);
    if (outType.errorRecord) {
      copyErrorPayload(*outType.errorRecord, application(outType, output), inType, input);
      if (errorSubset(planner.input, {}, outType.errorRecord))
        builder.CreateStore(llvm::Constant::getNullValue(failureType),
                            builder.CreateStructGEP(valueType(outType), output, 0));
    }
  }
  void copyResult(const ValueType &outType, Value *output, const ValueType &inType, Value *input) {
    copyErrors(outType, output, inType, input);
    copy(builder.CreateStructGEP(valueType(outType), output, 1),
         builder.CreateStructGEP(valueType(inType), input, 1),
         valueType(outType)->getElementType(1));
  }
  Value *loadFailure(Value *pointer, unsigned index) {
    return builder.CreateLoad(i64, builder.CreateStructGEP(failureType, pointer, index));
  }
  Value *hasFailure(Value *pointer) {
    return builder.CreateICmpNE(
        builder.CreateLoad(i32, builder.CreateStructGEP(failureType, pointer, 0)), c32(0));
  }
  void retainRecordArray(const ValueType &type, Value *input, Function *fn, Block *failed) {
    const auto cellType = recordArrayElement(type);
    auto *cell = scalarType(cellType);
    auto *valid =
        call("kalandra_record_array_retain_v1", boolean,
             {fn->getArg(0), fn->getArg(2), input, c64(size(cell)), c64(alignment(cell))});
    auto *begin = Block::Create(context, "array.begin", fn);
    builder.CreateCondBr(valid, begin, failed);
    builder.SetInsertPoint(begin);
    auto *value = builder.CreateLoad(descriptor(type), input);
    auto *count = builder.CreateExtractValue(value, {3, 0});
    auto *storage = builder.CreateExtractValue(value, {1});
    auto *head = Block::Create(context, "array.head", fn);
    auto *body = Block::Create(context, "array.body", fn);
    auto *done = Block::Create(context, "array.done", fn);
    builder.CreateBr(head);
    builder.SetInsertPoint(head);
    auto *index = builder.CreatePHI(i64, 2, "element");
    index->addIncoming(c64(0), begin);
    auto *gate = Block::Create(context, "array.poll.gate", fn);
    auto *poll = Block::Create(context, "array.poll", fn);
    builder.CreateCondBr(builder.CreateICmpULT(index, count), gate, done);
    builder.SetInsertPoint(gate);
    builder.CreateCondBr(builder.CreateICmpEQ(builder.CreateAnd(index, c64(255)), c64(0)), poll,
                         body);
    builder.SetInsertPoint(poll);
    auto *status = call("kalandra_poll_v1", i64, {fn->getArg(0)});
    builder.CreateCondBr(builder.CreateICmpEQ(status, c64(0)), body, failed);
    builder.SetInsertPoint(body);
    auto *address = builder.CreateInBoundsGEP(cell, storage, index);
    retainRecord(cellType, address, fn, failed);
    auto *next = builder.CreateAdd(index, c64(1));
    index->addIncoming(next, builder.GetInsertBlock());
    builder.CreateBr(head);
    builder.SetInsertPoint(done);
  }
  void retainRecord(const ValueType &type, Value *input, Function *fn, Block *failed) {
    const auto &record = planner.input.records[*type.record];
    const auto &fields = record.fields;
    const auto retainField = [&](std::size_t i, std::optional<std::size_t> taskKind = {}) {
      const auto &field = fields[i].type;
      auto *address = builder.CreateStructGEP(scalarType(type), input, i);
      if (field.builtin == BuiltinValue::TaskError) {
        auto *kind = builder.CreateLoad(i32, builder.CreateStructGEP(failureType, address, 0));
        auto *next = Block::Create(context, "task.error.validated", fn);
        builder.CreateCondBr(taskKind ? builder.CreateICmpEQ(kind, c32(*taskKind))
                                      : builder.CreateAnd(builder.CreateICmpUGE(kind, c32(1)),
                                                          builder.CreateICmpULE(kind, c32(4))),
                             next, failed);
        builder.SetInsertPoint(next);
      } else if (isRecordArray(field))
        retainRecordArray(field, address, fn, failed);
      else if (field.builtin == BuiltinValue::Record)
        retainRecord(field, address, fn, failed);
      else if (isStringArray(field)) {
        auto *success = call("kalandra_string_array_retain_v1", boolean,
                             {fn->getArg(0), fn->getArg(2), address});
        auto *next = Block::Create(context, "record.string.array.next", fn);
        builder.CreateCondBr(success, next, failed);
        builder.SetInsertPoint(next);
      } else if (field.builtin == BuiltinValue::String) {
        auto *success =
            call("kalandra_string_retain_v1", boolean, {fn->getArg(0), fn->getArg(2), address});
        auto *next = Block::Create(context, "record.string.next", fn);
        builder.CreateCondBr(success, next, failed);
        builder.SetInsertPoint(next);
      } else if (field.tensor) {
        auto *success = isBoolArray(field)
                            ? call("kalandra_bool_array_retain_v1", boolean,
                                   {fn->getArg(0), fn->getArg(2), address})
                            : call("kalandra_record_retain_v1", boolean,
                                   {fn->getArg(0), fn->getArg(2), address, c64(field.shape.size()),
                                    c64(static_cast<unsigned>(field.element))});
        for (std::size_t axis = 0; axis < field.shape.size(); ++axis)
          if (field.shape[axis].constant) {
            auto *dimensions = builder.CreateStructGEP(descriptor(field), address, 3);
            auto *extent = builder.CreateLoad(
                i64, builder.CreateInBoundsGEP(llvm::ArrayType::get(i64, field.shape.size()),
                                               dimensions, {c64(0), c64(axis)}));
            success = builder.CreateAnd(
                success, builder.CreateICmpEQ(extent, c64(*field.shape[axis].constant)));
          }
        auto *next = Block::Create(context, "record.next", fn);
        builder.CreateCondBr(success, next, failed);
        builder.SetInsertPoint(next);
      }
    };
    if (record.variants.empty()) {
      for (std::size_t i = 0; i < fields.size(); ++i)
        retainField(i);
    } else {
      auto *tag = builder.CreateLoad(i64, builder.CreateStructGEP(scalarType(type), input, 0));
      auto *done = Block::Create(context, "enum.retained", fn);
      auto *dispatch = builder.CreateSwitch(tag, failed, record.variants.size());
      for (std::size_t i = 0; i < record.variants.size(); ++i) {
        auto *active = Block::Create(context, "enum.payload", fn);
        dispatch->addCase(c64(i + 1), active);
        builder.SetInsertPoint(active);
        const auto [origin, variant] = errorOrigin(planner.input, *type.record, i);
        for (auto slot : record.variants[i].fields)
          retainField(slot, planner.input.records[origin].taskErrorFamily
                                ? std::optional{variant + 1}
                                : std::nullopt);
        builder.CreateBr(done);
      }
      builder.SetInsertPoint(done);
    }
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
    if (type.errorRecord) {
      auto *dispatch = Block::Create(context, "application.dispatch", fn);
      auto *active = Block::Create(context, "application.retain", fn);
      auto *success = Block::Create(context, "application.success", fn);
      auto *failed = Block::Create(context, "application.failed", fn);
      builder.CreateCondBr(hasFailure(builder.CreateStructGEP(wrapper, fn->getArg(3), 0)), ready,
                           dispatch);
      builder.SetInsertPoint(dispatch);
      builder.CreateCondBr(hasResultError(type, fn->getArg(3)), active, success);
      builder.SetInsertPoint(active);
      retainRecord(errorRecordType(*type.errorRecord), application(type, fn->getArg(3)), fn,
                   failed);
      builder.CreateBr(ready);
      builder.SetInsertPoint(failed);
      builder.CreateRet(builder.getFalse());
      builder.SetInsertPoint(success);
    }
    if (type.builtin == BuiltinValue::TaskError && !type.task) {
      auto *validate = Block::Create(context, "task.value.success", fn);
      builder.CreateCondBr(hasFailure(builder.CreateStructGEP(wrapper, fn->getArg(3), 0)), ready,
                           validate);
      builder.SetInsertPoint(validate);
      auto *data = builder.CreateStructGEP(wrapper, fn->getArg(3), 1);
      auto *kind = builder.CreateLoad(i32, builder.CreateStructGEP(failureType, data, 0));
      auto *failed = Block::Create(context, "task.value.invalid", fn);
      builder.CreateCondBr(builder.CreateAnd(builder.CreateICmpUGE(kind, c32(1)),
                                             builder.CreateICmpULE(kind, c32(4))),
                           ready, failed);
      builder.SetInsertPoint(failed);
      builder.CreateRet(builder.getFalse());
    } else if (isStringArray(type) && !type.task) {
      auto *retain = Block::Create(context, "string.array.retain", fn);
      auto *failed = Block::Create(context, "string.array.failed", fn);
      builder.CreateCondBr(hasFailure(builder.CreateStructGEP(wrapper, fn->getArg(3), 0)), ready,
                           retain);
      builder.SetInsertPoint(retain);
      auto *success =
          call("kalandra_string_array_retain_v1", boolean,
               {fn->getArg(0), fn->getArg(2), builder.CreateStructGEP(wrapper, fn->getArg(3), 1)});
      builder.CreateCondBr(success, ready, failed);
      builder.SetInsertPoint(failed);
      builder.CreateRet(builder.getFalse());
    } else if (type.builtin == BuiltinValue::String && !type.task) {
      auto *retain = Block::Create(context, "string.retain", fn);
      auto *failed = Block::Create(context, "string.failed", fn);
      builder.CreateCondBr(hasFailure(builder.CreateStructGEP(wrapper, fn->getArg(3), 0)), ready,
                           retain);
      builder.SetInsertPoint(retain);
      auto *success =
          call("kalandra_string_retain_v1", boolean,
               {fn->getArg(0), fn->getArg(2), builder.CreateStructGEP(wrapper, fn->getArg(3), 1)});
      builder.CreateCondBr(success, ready, failed);
      builder.SetInsertPoint(failed);
      builder.CreateRet(builder.getFalse());
    } else if (isBoolArray(type)) {
      auto *retain = Block::Create(context, "bool.array.retain", fn);
      auto *failed = Block::Create(context, "bool.array.failed", fn);
      builder.CreateCondBr(hasFailure(builder.CreateStructGEP(wrapper, fn->getArg(3), 0)), ready,
                           retain);
      builder.SetInsertPoint(retain);
      auto *success =
          call("kalandra_bool_array_retain_v1", boolean,
               {fn->getArg(0), fn->getArg(2), builder.CreateStructGEP(wrapper, fn->getArg(3), 1)});
      builder.CreateCondBr(success, ready, failed);
      builder.SetInsertPoint(failed);
      builder.CreateRet(builder.getFalse());
    } else if (isRecordArray(type)) {
      auto *retain = Block::Create(context, "array.retain", fn);
      auto *failed = Block::Create(context, "array.failed", fn);
      builder.CreateCondBr(hasFailure(builder.CreateStructGEP(wrapper, fn->getArg(3), 0)), ready,
                           retain);
      builder.SetInsertPoint(retain);
      retainRecordArray(type, builder.CreateStructGEP(wrapper, fn->getArg(3), 1), fn, failed);
      builder.CreateBr(ready);
      builder.SetInsertPoint(failed);
      builder.CreateRet(builder.getFalse());
    } else if (type.tensor) {
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
    } else if (type.builtin == BuiltinValue::Record && !type.task) {
      auto *retain = Block::Create(context, "record.retain", fn);
      auto *failed = Block::Create(context, "record.failed", fn);
      builder.CreateCondBr(hasFailure(builder.CreateStructGEP(wrapper, fn->getArg(3), 0)), ready,
                           retain);
      builder.SetInsertPoint(retain);
      retainRecord(type, builder.CreateStructGEP(wrapper, fn->getArg(3), 1), fn, failed);
      builder.CreateBr(ready);
      builder.SetInsertPoint(failed);
      builder.CreateRet(builder.getFalse());
    } else
      builder.CreateBr(ready);
    builder.SetInsertPoint(ready);
    copy(fn->getArg(1), fn->getArg(3), wrapper);
    builder.CreateRet(builder.getTrue());
    auto *constant = llvm::ConstantStruct::get(
        layoutType,
        {c64(type.errorRecord                                     ? 0x1000000 + layouts.size()
             : isStringArray(type) && !type.task                  ? 0x80000
             : isBoolArray(type) && !type.task                    ? 0x70000
             : isRecordArray(type) && !type.task                  ? 0x60000 + *type.record
             : type.builtin == BuiltinValue::Record && !type.task ? 0x50000 + *type.record
             : type.builtin != BuiltinValue::Numeric ? 0x10000 + static_cast<unsigned>(type.builtin)
             : type.array                            ? 0x40000 + static_cast<unsigned>(type.element)
             : type.tensor
                 ? (isInteger(type.element) || type.element == NumericType::Float64
                        ? 0x30000 + 16 * static_cast<unsigned>(type.element) + type.shape.size()
                        : type.shape.size() + 2)
             : isInteger(type.element)              ? 0x20000 + static_cast<unsigned>(type.element)
             : type.element == NumericType::Float64 ? 0x20000 + static_cast<unsigned>(type.element)
                                                    : 1),
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
    auto *spawnFailure = staging.empty() ? nullptr : builder.CreateAlloca(failureType);
    std::unordered_map<std::size_t, Value *> observations;
    for (const auto &[target, field] : observationFields[id])
      observations[target] = builder.CreateStructGEP(frameType, frame, field);
    std::vector<std::size_t> groupExits(plan.groups, SIZE_MAX);
    for (std::size_t n = 0; n < plan.code.size(); ++n)
      if (plan.code[n].code == Code::Join)
        groupExits.at(plan.code[n].group) = n;
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
          builder.CreateStore(
              llvm::ConstantInt::get(llvm::cast<llvm::IntegerType>(scalarType(type)),
                                     static_cast<std::uint64_t>(integer->value), true),
              payload(instruction.output));
          builder.CreateBr(next);
          break;
        }
        if (const auto *integer = std::get_if<Int64Literal>(&literal)) {
          builder.CreateStore(c64(static_cast<std::uint64_t>(integer->value)), payload(instruction.output));
          builder.CreateBr(next);
          break;
        }
        if (const auto *integer = std::get_if<UInt64Literal>(&literal)) {
          builder.CreateStore(c64(integer->value), payload(instruction.output));
          builder.CreateBr(next);
          break;
        }
        if (const auto *integer = std::get_if<UInt32Literal>(&literal)) {
          builder.CreateStore(llvm::ConstantInt::get(
                                  llvm::cast<llvm::IntegerType>(scalarType(type)), integer->value),
                              payload(instruction.output));
          builder.CreateBr(next);
          break;
        }
        if (const auto *real = std::get_if<Float64Literal>(&literal)) {
          builder.CreateStore(
              llvm::ConstantFP::get(
                  context, llvm::APFloat(llvm::APFloat::IEEEdouble(), llvm::APInt(64, real->bits))),
              payload(instruction.output));
          builder.CreateBr(next);
          break;
        }
        if (const auto *boolean = std::get_if<BoolLiteral>(&literal)) {
          builder.CreateStore(builder.getInt1(boolean->value), payload(instruction.output));
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
          auto *error = Block::Create(context, "refine.error", resume);
          auto *success = Block::Create(context, "refine.success", resume);
          builder.CreateCondBr(hasResultError(plan.slots[input], slot(input)), error, success);
          builder.SetInsertPoint(error);
          copyErrors(type, slot(instruction.output), plan.slots[input], slot(input));
          builder.CreateBr(next);
          builder.SetInsertPoint(success);
        }
        auto *fn =
            module.getFunction("_mlir_ciface_kalandra_fn_" + std::to_string(instruction.target));
        std::vector<Value *> arguments;
        // MLIR C wrappers return both memrefs and LLVM aggregate values through
        // a leading output pointer, while record arguments remain values.
        const bool indirectResult = type.tensor || type.builtin == BuiltinValue::Record ||
                                    type.builtin == BuiltinValue::String ||
                                    type.builtin == BuiltinValue::TaskError;
        if (indirectResult)
          arguments.push_back(payload(instruction.output));
        for (auto argument : instruction.args)
          arguments.push_back(
              plan.slots[argument].tensor && !isOwnedArray(plan.slots[argument])
                  ? payload(argument)
                  : builder.CreateLoad(scalarType(plan.slots[argument]), payload(argument)));
        arguments.push_back(ctx);
        auto *value = builder.CreateCall(fn, arguments);
        if (!indirectResult) {
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
        copyResult(type, slot(instruction.output), plan.slots[instruction.args[0]],
                   slot(instruction.args[0]));
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
        auto *valid = builder.CreateLoad(
            i32, builder.CreateStructGEP(handleType, payload(instruction.output), 0));
        auto *rejected = Block::Create(context, "spawn.rejected", resume);
        builder.CreateCondBr(builder.CreateICmpNE(valid, c32(UINT32_MAX)), next, rejected);
        builder.SetInsertPoint(rejected);
        // A failed group may settle between dispatches. Preserve that failure
        // and join its children instead of awaiting an invalid task handle.
        call("kalandra_group_failure_v1", voidType, {task, group(instruction.group), spawnFailure});
        auto exit = groupExits.at(instruction.group);
        if (exit == SIZE_MAX)
          throw std::runtime_error("spawn has no owning group exit");
        builder.CreateCondBr(hasFailure(spawnFailure), blocks[exit], abort);
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
        const auto &child = *planner.plans[instruction.target];
        const auto &childType = child.slots[child.result];
        if (key(childType) == key(type)) {
          auto *ok = call("kalandra_task_read_v1", boolean,
                          {task, handle, layout(childType), slot(instruction.output)});
          builder.CreateCondBr(ok, next, abort);
          break;
        }
        auto *observed = observations.at(instruction.target);
        auto *ok =
            call("kalandra_task_read_v1", boolean, {task, handle, layout(childType), observed});
        auto *copied = Block::Create(context, "await.observed", resume);
        builder.CreateCondBr(ok, copied, abort);
        builder.SetInsertPoint(copied);
        copyResult(type, slot(instruction.output), childType, observed);
        builder.CreateBr(next);
        break;
      }
      case Code::Fail:
      case Code::Try: {
        const auto input = instruction.args[0];
        const auto &source = plan.slots[input];
        const auto &target = plan.slots[instruction.target];
        const bool explicitFail = instruction.code == Code::Fail;
        auto *header =
            builder.CreateStructGEP(valueType(source), slot(input), explicitFail ? 1 : 0);
        auto *propagate = Block::Create(context, "try.propagate", resume);
        auto *success = Block::Create(context, "try.success", resume);
        if (explicitFail)
          builder.CreateBr(propagate);
        else
          builder.CreateCondBr(hasResultError(source, slot(input)), propagate, success);
        builder.SetInsertPoint(propagate);
        if (instruction.group != SIZE_MAX && target.errorRecord) {
          auto *accepted =
              call("kalandra_task_stop_group_v1", boolean, {task, group(instruction.group)});
          auto *store = Block::Create(context, "group.primary", resume);
          builder.CreateCondBr(accepted, store, blocks[instruction.jump]);
          builder.SetInsertPoint(store);
          if (explicitFail && source.builtin == BuiltinValue::Record)
            copyErrorValue(*target.errorRecord, application(target, slot(instruction.target)),
                           *source.record, payload(input));
          else if (explicitFail)
            injectTaskError(*target.errorRecord, application(target, slot(instruction.target)),
                            header);
          else
            copyErrors(target, slot(instruction.target), source, slot(input));
        } else if (instruction.group != SIZE_MAX) {
          call("kalandra_task_fail_group_v1", voidType, {task, group(instruction.group), header});
        } else if (explicitFail && source.builtin == BuiltinValue::Record) {
          if (!target.errorRecord || !source.record)
            throw std::runtime_error("application fail lost its declared error family");
          copyErrorValue(*target.errorRecord, application(target, slot(instruction.target)),
                         *source.record, payload(input));
        } else if (explicitFail) {
          if (target.errorRecord)
            injectTaskError(*target.errorRecord, application(target, slot(instruction.target)),
                            header);
          else
            copy(builder.CreateStructGEP(valueType(target), slot(instruction.target), 0), header,
                 failureType);
        } else
          copyErrors(target, slot(instruction.target), source, slot(input));
        builder.CreateBr(blocks[instruction.jump]);
        builder.SetInsertPoint(success);
        if (!explicitFail)
          copyResult(type, slot(instruction.output), source, slot(input));
        builder.CreateBr(next);
        break;
      }
      case Code::Catch: {
        auto input = instruction.args[0];
        auto *header = builder.CreateStructGEP(valueType(plan.slots[input]), slot(input), 0);
        auto *handle = Block::Create(context, "catch.error", resume);
        auto *success = Block::Create(context, "catch.success", resume);
        builder.CreateCondBr(hasResultError(plan.slots[input], slot(input)), handle, success);
        builder.SetInsertPoint(handle);
        if (plan.slots[input].errorRecord)
          copyErrorPayload(*plan.slots[input].errorRecord, payload(instruction.args[1]),
                           plan.slots[input], slot(input));
        else
          copy(payload(instruction.args[1]), header, failureType);
        builder.CreateBr(blocks[instruction.jump]);
        builder.SetInsertPoint(success);
        builder.CreateStore(llvm::Constant::getNullValue(valueType(type)),
                            slot(instruction.output));
        copy(builder.CreateStructGEP(valueType(type), slot(instruction.output), 1), payload(input),
             valueType(type)->getElementType(1));
        builder.CreateBr(blocks[instruction.target]);
        break;
      }
      case Code::Branch:
        builder.CreateCondBr(builder.CreateLoad(boolean, payload(instruction.args[0])), next,
                             blocks[instruction.jump]);
        break;
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
        const auto &read =
            std::get<ErrorFieldRead>(planner.input.expressions[instruction.source].operation);
        auto *error = payload(instruction.args[0]);
        if (read.taskSlot)
          error = builder.CreateStructGEP(scalarType(plan.slots[instruction.args[0]]), error,
                                          *read.taskSlot);
        auto *code = loadFailure(error, 1);
        auto field = static_cast<ErrorField>(instruction.target);
        if (field == ErrorField::Kind) {
          auto *kind = builder.CreateSelect(
              builder.CreateICmpEQ(code, c64(1)), c32(3),
              builder.CreateSelect(
                  builder.CreateICmpEQ(code, c64(2)), c32(4),
                  builder.CreateSelect(
                      builder.CreateICmpEQ(code, c64(4)), c32(1),
                      builder.CreateSelect(builder.CreateICmpEQ(code, c64(5)), c32(2), c32(5)))));
          builder.CreateStore(kind, payload(instruction.output));
        } else {
          auto *textType = llvm::cast<llvm::StructType>(valueType(type)->getElementType(1));
          auto text = [&](const char *message) -> Value * {
            return llvm::ConstantStruct::get(
                textType, {llvm::ConstantPointerNull::get(builder.getPtrTy()),
                           llvm::cast<llvm::Constant>(builder.CreateGlobalString(message)),
                           c64(std::char_traits<char>::length(message))});
          };
          Value *message;
          if (field == ErrorField::Reason)
            message = text("task admission rejected");
          else
            message = builder.CreateSelect(
                builder.CreateICmpEQ(code, c64(1)), text("tensor shape mismatch"),
                builder.CreateSelect(
                    builder.CreateICmpEQ(code, c64(2)), text("allocation failed"),
                    builder.CreateSelect(builder.CreateICmpEQ(code, c64(4)),
                                         text("integer arithmetic fault"),
                                         builder.CreateSelect(builder.CreateICmpEQ(code, c64(5)),
                                                              text("index out of bounds"),
                                                              text("native execution fault")))));
          call("kalandra_string_literal_v1", voidType,
               {ctx, payload(instruction.output), builder.CreateExtractValue(message, {1}),
                builder.CreateExtractValue(message, {2})});
          check();
          break;
        }
        builder.CreateBr(next);
        break;
      }
      case Code::Join: {
        call("kalandra_task_close_v1", voidType, {task, group(instruction.group)});
        wait(call("kalandra_task_join_v1", boolean, {task, group(instruction.group)}));
        auto *header = builder.CreateStructGEP(valueType(type), slot(instruction.output), 0);
        // The primary typed error lives in this frame until all children settle.
        // Do not replace it with the scheduler's internal stop marker.
        if (type.errorRecord) {
          auto *settled = Block::Create(context, "group.outcome", resume);
          builder.CreateCondBr(hasResultError(type, slot(instruction.output)), next, settled);
          builder.SetInsertPoint(settled);
        }
        call("kalandra_group_failure_v1", voidType, {task, group(instruction.group), header});
        auto *success = Block::Create(context, "group.success", resume);
        builder.CreateCondBr(hasFailure(header), next, success);
        builder.SetInsertPoint(success);
        copyResult(type, slot(instruction.output), plan.slots[instruction.args[0]],
                   slot(instruction.args[0]));
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
