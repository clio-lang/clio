#include "NativeLayout.h"
#include "NativeStack.h"
#include "llvm/Analysis/LoopInfo.h"
#include "llvm/IR/CFG.h"
#include "llvm/IR/Constants.h"
#include "llvm/IR/Dominators.h"
#include "llvm/IR/Function.h"
#include "llvm/IR/IRBuilder.h"
#include "llvm/IR/Instructions.h"
#include "llvm/IR/Module.h"
#include "llvm/Passes/PassBuilder.h"
#include "llvm/Transforms/InstCombine/InstCombine.h"
#include "llvm/Transforms/Scalar/DCE.h"
#include "llvm/Transforms/Scalar/EarlyCSE.h"
#include <optional>
#include <string>
#include <unordered_map>
#include <vector>

namespace kalandra {
namespace {
void simplifyCheckedStackIR(llvm::Function &function) {
  using namespace llvm;
  // Simplify only after checked allocation/fault/poll calls are installed, so
  // optimizations cannot assume an unchecked fault path continues to execute.
  LoopAnalysisManager loopAnalyses;
  FunctionAnalysisManager functionAnalyses;
  CGSCCAnalysisManager callAnalyses;
  ModuleAnalysisManager moduleAnalyses;
  PassBuilder passes;
  passes.registerLoopAnalyses(loopAnalyses);
  passes.registerFunctionAnalyses(functionAnalyses);
  passes.registerCGSCCAnalyses(callAnalyses);
  passes.registerModuleAnalyses(moduleAnalyses);
  passes.crossRegisterProxies(loopAnalyses, functionAnalyses, callAnalyses, moduleAnalyses);
  FunctionPassManager simplify;
  simplify.addPass(InstCombinePass());
  simplify.addPass(EarlyCSEPass());
  simplify.addPass(DCEPass());
  simplify.run(function, functionAnalyses);
}
} // namespace
// Apply after bufferization/LLVM translation, so allocations and clones
// introduced by ownership lowering receive the same checked convention too.
std::optional<std::string> addCheckedInvocationABI(llvm::Module &module, bool functionValues) {
  using namespace llvm;
  // Structural simplification must use the same target layout as storage and
  // stack admission, including i64/i128 alignment on the pinned ARM64 target.
  module.setDataLayout(nativeCpuDataLayout);
  auto &context = module.getContext();
  auto *pointer = PointerType::getUnqual(context);
  auto *i64 = Type::getInt64Ty(context);
  auto *voidType = Type::getVoidTy(context);
  auto allocate = module.getOrInsertFunction("kalandra_alloc_v1", pointer, pointer, i64);
  auto release = module.getOrInsertFunction("kalandra_free_v1", voidType, pointer, pointer);
  auto fault = module.getOrInsertFunction("kalandra_fault_v1", voidType, pointer, i64, i64, i64);
  auto status = module.getOrInsertFunction("kalandra_poll_v1", i64, pointer);
  auto enter = module.getOrInsertFunction("kalandra_call_enter_v1", Type::getInt1Ty(context),
                                          pointer, i64, i64);
  auto leave = module.getOrInsertFunction("kalandra_call_leave_v1", voidType, pointer);
  std::vector<Function *> originals;
  for (auto &function : module)
    if (!function.isDeclaration())
      originals.push_back(&function);
  std::unordered_map<Function *, Function *> checked;
  for (auto *old : originals) {
    auto name = old->getName().str();
    old->setName(name + ".unchecked");
    std::vector<Type *> parameters(old->getFunctionType()->params().begin(),
                                   old->getFunctionType()->params().end());
    parameters.push_back(pointer);
    auto *function = Function::Create(FunctionType::get(old->getReturnType(), parameters, false),
                                      old->getLinkage(), name, module);
    function->setAttributes(old->getAttributes());
    function->setCallingConv(old->getCallingConv());
    function->splice(function->begin(), old);
    for (auto &argument : old->args())
      argument.replaceAllUsesWith(function->getArg(argument.getArgNo()));
    function->getArg(function->arg_size() - 1)->setName("invocation");
    checked.emplace(old, function);
  }
  for (auto *old : originals) {
    auto *function = checked.at(old);
    auto *invocation = function->getArg(function->arg_size() - 1);
    auto *failed = BasicBlock::Create(context, "invocation.failed", function);
    IRBuilder<> failure(failed);
    if (function->getReturnType()->isVoidTy())
      failure.CreateRetVoid();
    else
      failure.CreateRet(Constant::getNullValue(function->getReturnType()));
    std::vector<CallInst *> calls;
    for (auto &block : *function)
      for (auto &instruction : block)
        if (auto *call = dyn_cast<CallInst>(&instruction))
          calls.push_back(call);
    for (auto *call : calls) {
      auto *target = call->getCalledFunction();
      IRBuilder<> builder(call);
      std::vector<Value *> arguments(call->args().begin(), call->args().end());
      FunctionCallee callee;
      bool alwaysFail = false;
      if (!target) {
        if (!functionValues || call->getFunctionType()->isVarArg())
          return "indirect call has no checked invocation convention";
        std::vector<Type *> parameters(call->getFunctionType()->param_begin(),
                                       call->getFunctionType()->param_end());
        parameters.push_back(pointer);
        callee = FunctionCallee(FunctionType::get(call->getType(), parameters, false),
                                call->getCalledOperand());
        arguments.push_back(invocation);
      } else if (auto found = checked.find(target); found != checked.end()) {
        callee = found->second;
        arguments.push_back(invocation);
      } else if (target->getName() == "_mlir_memref_to_llvm_alloc") {
        callee = allocate;
        arguments.insert(arguments.begin(), invocation);
      } else if (target->getName() == "_mlir_memref_to_llvm_free") {
        callee = release;
        arguments.insert(arguments.begin(), invocation);
      } else if (target->getName() == "kalandra_fault") {
        callee = fault;
        arguments.insert(arguments.begin(), invocation);
        alwaysFail = true;
      } else if (target->getName() == "kalandra_record_alloc" ||
                 target->getName() == "kalandra_recursive_make" ||
                 target->getName() == "kalandra_recursive_read" ||
                 target->getName() == "kalandra_recursive_transfer" ||
                 target->getName() == "kalandra_recursive_environment_bind" ||
                 target->getName() == "kalandra_recursive_environment_read" ||
                 target->getName() == "kalandra_recursive_function_dependency" ||
                 target->getName() == "kalandra_recursive_function_array_dependency" ||
                 target->getName() == "kalandra_recursive_record_array_dependency" ||
                 target->getName() == "kalandra_recursive_reference_dependency" ||
                 target->getName() == "kalandra_recursive_tag_check" ||
                 target->getName() == "kalandra_recursive_string_dependency" ||
                 target->getName() == "kalandra_recursive_string_array_dependency" ||
                 target->getName() == "kalandra_recursive_tensor_dependency" ||
                 target->getName() == "kalandra_recursive_bool_dependency" ||
                 target->getName() == "kalandra_environment_alloc" ||
                 target->getName() == "kalandra_record_cleanup" ||
                 target->getName() == "kalandra_record_validate" ||
                 target->getName() == "kalandra_record_array_validate" ||
                 target->getName() == "kalandra_string_literal" ||
                 target->getName() == "kalandra_string_validate" ||
                 target->getName() == "kalandra_string_array_validate" ||
                 target->getName() == "kalandra_string_concat" ||
                 target->getName() == "kalandra_string_equal" ||
                 target->getName() == "kalandra_string_length" ||
                 target->getName() == "kalandra_string_byte_length" ||
                 target->getName() == "kalandra_string_index" ||
                 target->getName() == "kalandra_string_slice") {
        std::vector<Type *> parameters{pointer};
        parameters.insert(parameters.end(), target->getFunctionType()->param_begin(),
                          target->getFunctionType()->param_end());
        callee = module.getOrInsertFunction(
            target->getName().str() + "_v1",
            FunctionType::get(target->getReturnType(), parameters, false));
        arguments.insert(arguments.begin(), invocation);
      } else if (target->isIntrinsic())
        continue;
      else
        return "external call has no checked invocation convention: " + target->getName().str();
      auto *replacement = builder.CreateCall(callee, arguments);
      replacement->setCallingConv(call->getCallingConv());
      call->replaceAllUsesWith(replacement);
      call->eraseFromParent();
      auto *block = replacement->getParent();
      auto *continuation =
          block->splitBasicBlock(std::next(replacement->getIterator()), "invocation.continue");
      block->getTerminator()->eraseFromParent();
      builder.SetInsertPoint(block);
      if (alwaysFail)
        builder.CreateBr(failed);
      else {
        auto *code = builder.CreateCall(status, {invocation});
        builder.CreateCondBr(builder.CreateICmpNE(code, ConstantInt::get(i64, 0)), failed,
                             continuation);
      }
    }
    // Poll every generated loop header, including bufferization/copy loops.
    // Cancellation exits through the checked ABI; the invocation ledger owns
    // any live buffers until its task acknowledges and settles the request.
    DominatorTree dominators(*function);
    LoopInfo loops(dominators);
    std::vector<Loop *> pending(loops.begin(), loops.end());
    std::vector<Loop *> headers;
    while (!pending.empty()) {
      auto *loop = pending.back();
      pending.pop_back();
      headers.push_back(loop);
      pending.insert(pending.end(), loop->begin(), loop->end());
    }
    for (auto *loop : headers) {
      auto *header = loop->getHeader();
      IRBuilder<> counter(header, header->getFirstInsertionPt());
      auto *tick = counter.CreatePHI(i64, pred_size(header), "poll.tick");
      auto *nextTick = counter.CreateAdd(tick, ConstantInt::get(i64, 1), "poll.next");
      for (auto *predecessor : predecessors(header))
        tick->addIncoming(loop->contains(predecessor) ? nextTick : ConstantInt::get(i64, 0),
                          predecessor);
      auto *body = header->splitBasicBlock(header->getFirstInsertionPt(), "loop.body");
      header->getTerminator()->eraseFromParent();
      auto *pollBlock = BasicBlock::Create(context, "loop.poll", function);
      IRBuilder<> gate(header);
      // Bound response latency without a runtime call for every scalar element.
      auto *due = gate.CreateICmpEQ(gate.CreateAnd(tick, ConstantInt::get(i64, 255)),
                                    ConstantInt::get(i64, 0));
      gate.CreateCondBr(due, pollBlock, body);
      IRBuilder<> poll(pollBlock);
      auto *code = poll.CreateCall(status, {invocation});
      poll.CreateCondBr(poll.CreateICmpNE(code, ConstantInt::get(i64, 0)), failed, body);
    }

  }
  // Source function references must point at the checked entry, including references
  // passed through arguments, returned values and branch-selected pointers.
  for (auto *old : originals)
    old->replaceAllUsesWith(checked.at(old));
  for (auto *old : originals)
    old->eraseFromParent();
  // Resolve every function pointer to its final checked signature before LLVM
  // simplification, including constants feeding indirect calls and closures.
  for (auto &body : module) {
    if (body.isDeclaration())
      continue;
    auto *function = &body;
    auto *invocation = function->getArg(function->arg_size() - 1);
    // Emit the simplified IR even at -O0, then apply the unchanged budget to
    // those actual instructions, without assuming register/stack-slot reuse.
    simplifyCheckedStackIR(*function);
    // The compiler-owned SIMD matmul leaf cannot re-enter source code. Its
    // register-heavy SSA follows separate numeric qualification; still bound
    // fixed allocas/arguments and verify the leaf-call restriction.
    const bool numericLeaf = function->getName().starts_with("kalandra_fn_matmul_wide_");
    if (auto error =
            nativeStackBudgetError(*function, llvm::DataLayout(nativeCpuDataLayout), numericLeaf))
      return error;
    // Balance every admitted return, including fault/cancellation exits. The
    // rejected-entry block below never acquired a call slot and must not leave.
    for (auto &block : *function)
      if (auto *ret = dyn_cast<ReturnInst>(block.getTerminator())) {
        IRBuilder<> exit(ret);
        exit.CreateCall(leave, {invocation});
      }
    auto *denied = BasicBlock::Create(context, "invocation.denied", function);
    IRBuilder<> reject(denied);
    if (function->getReturnType()->isVoidTy())
      reject.CreateRetVoid();
    else
      reject.CreateRet(Constant::getNullValue(function->getReturnType()));
    // Re-entering an already faulted/cancelled context cannot execute source operations.
    auto *entry = &function->getEntryBlock();
    auto *start = entry->splitBasicBlock(entry->getFirstInsertionPt(), "invocation.start");
    entry->getTerminator()->eraseFromParent();
    IRBuilder<> builder(entry);
    auto *admitted =
        builder.CreateCall(enter, {invocation, ConstantInt::get(i64, 0), ConstantInt::get(i64, 0)});
    builder.CreateCondBr(admitted, start, denied);
  }
  for (const auto *name : {"kalandra_fault",
                           "_mlir_memref_to_llvm_alloc",
                           "_mlir_memref_to_llvm_free",
                           "kalandra_record_alloc",
                           "kalandra_recursive_make",
                           "kalandra_recursive_read",
                           "kalandra_recursive_transfer",
                           "kalandra_recursive_environment_bind",
                           "kalandra_recursive_environment_read",
                           "kalandra_recursive_function_dependency",
                           "kalandra_recursive_function_array_dependency",
                           "kalandra_recursive_record_array_dependency",
                           "kalandra_recursive_reference_dependency",
                           "kalandra_recursive_tag_check",
                           "kalandra_recursive_string_dependency",
                           "kalandra_recursive_string_array_dependency",
                           "kalandra_recursive_tensor_dependency",
                           "kalandra_recursive_bool_dependency",
                           "kalandra_environment_alloc",
                           "kalandra_record_cleanup",
                           "kalandra_record_validate",
                           "kalandra_record_array_validate",
                           "kalandra_string_literal",
                           "kalandra_string_validate",
                           "kalandra_string_array_validate",
                           "kalandra_string_concat",
                           "kalandra_string_equal",
                           "kalandra_string_length",
                           "kalandra_string_byte_length",
                           "kalandra_string_index",
                           "kalandra_string_slice"})
    if (auto *old = module.getFunction(name); old && old->use_empty())
      old->eraseFromParent();
  return std::nullopt;
}
} // namespace kalandra
