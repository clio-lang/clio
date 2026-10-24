#pragma once
#include "../runtime/Runtime.h"
#include "llvm/IR/IRBuilder.h"
#include "llvm/IR/Module.h"

namespace kalandra {
// Inline only the checked ABI's small fast paths. Source functions retain their
// noinline/stack-budget boundary, including logical call depth and every poll.
inline void defineNativeFastABI(llvm::Module &module) {
  using namespace llvm;
  using Layout = runtime::InvocationABI;
  auto &context = module.getContext();
  auto *i8 = Type::getInt8Ty(context);
  auto *i64 = Type::getInt64Ty(context);
  auto *ptr = PointerType::getUnqual(context);
  auto *fault = module.getFunction("kalandra_fault_v1");
  auto *poll = module.getFunction("kalandra_poll_v1");
  auto *enter = module.getFunction("kalandra_call_enter_v1");
  auto *leave = module.getFunction("kalandra_call_leave_v1");
  auto prepare = [&](Function *fn) {
    fn->setLinkage(GlobalValue::InternalLinkage);
    fn->addFnAttr(Attribute::AlwaysInline);
    fn->addFnAttr(Attribute::NoUnwind);
    return BasicBlock::Create(context, "entry", fn);
  };
  auto address = [&](IRBuilder<> &b, Value *invocation, std::size_t offset) {
    return b.CreateConstGEP1_64(i8, invocation, offset);
  };
  auto load = [&](IRBuilder<> &b, Type *type, Value *invocation, std::size_t offset) {
    return b.CreateLoad(type, address(b, invocation, offset));
  };
  {
    IRBuilder<> b(prepare(poll));
    auto *invocation = poll->getArg(0);
    auto *mode = load(b, i8, invocation, Layout::pollMode);
    auto *fast = BasicBlock::Create(context, "simple", poll);
    auto *tokenCheck = BasicBlock::Create(context, "token.check", poll);
    auto *tokenLoad = BasicBlock::Create(context, "token.load", poll);
    auto *slow = BasicBlock::Create(context, "observable", poll);
    b.CreateCondBr(b.CreateICmpEQ(mode, b.getInt8(0)), fast, tokenCheck);
    b.SetInsertPoint(fast);
    b.CreateRet(b.getInt64(0));
    b.SetInsertPoint(tokenCheck);
    b.CreateCondBr(b.CreateICmpEQ(mode, b.getInt8(1)), tokenLoad, slow);
    b.SetInsertPoint(tokenLoad);
    auto *token = load(b, ptr, invocation, Layout::cancellation);
    auto *value = b.CreateLoad(i8, token);
    value->setAtomic(AtomicOrdering::Acquire);
    value->setAlignment(Align(1));
    b.CreateRet(b.CreateSelect(b.CreateICmpNE(value, b.getInt8(0)), b.getInt64(-1), b.getInt64(0)));
    b.SetInsertPoint(slow);
    // Keep fault/probe/token handling out of every source function's hot body.
    // A probe, fault or settlement permanently selects the observed path.
    auto fallback = module.getOrInsertFunction("kalandra_poll_slow_v1", i64, ptr);
    b.CreateRet(b.CreateCall(fallback, {invocation}));
  }
  {
    IRBuilder<> b(prepare(enter));
    auto *invocation = enter->getArg(0);
    auto *check = BasicBlock::Create(context, "depth", enter);
    auto *denied = BasicBlock::Create(context, "denied", enter);
    auto *exhausted = BasicBlock::Create(context, "exhausted", enter);
    auto *accepted = BasicBlock::Create(context, "accepted", enter);
    auto *code = b.CreateCall(poll, {invocation});
    b.CreateCondBr(b.CreateICmpEQ(code, b.getInt64(0)), check, denied);
    b.SetInsertPoint(check);
    auto *depth = load(b, i64, invocation, Layout::depth);
#if defined(__APPLE__)
    auto *stack = BasicBlock::Create(context, "stack", enter);
    b.CreateCondBr(b.CreateICmpULT(depth, b.getInt64(runtime::Invocation::maxCallDepth)), stack,
                   exhausted);
    b.SetInsertPoint(stack);
    // Native generated frames cannot migrate while this synchronous chain is
    // live. Its outermost admitted frame snapshots this pthread's TLS bounds;
    // every return releases the lease at that frame's logical entry depth.
    // Manual runtime admissions may already exist, so depth zero is not a proxy
    // for the end of a generated chain. Continuations reacquire after returning.
    auto *lease = load(b, i64, invocation, Layout::leaseDepth);
    auto *acquire = BasicBlock::Create(context, "acquire", enter);
    auto *position = BasicBlock::Create(context, "position", enter);
    b.CreateCondBr(b.CreateICmpEQ(lease, b.getInt64(0)), acquire, position);
    b.SetInsertPoint(acquire);
    auto *type = ArrayType::get(i64, 2);
    auto *global = module.getGlobalVariable("kalandra_stack_bounds_v1");
    if (!global)
      global = new GlobalVariable(module, type, false, GlobalValue::ExternalLinkage, nullptr,
                                  "kalandra_stack_bounds_v1", nullptr,
                                  GlobalValue::GeneralDynamicTLSModel);
    auto *bounds = b.CreateThreadLocalAddress(global);
    auto *highPtr = b.CreateConstGEP2_64(type, bounds, 0, 1);
    auto *init = BasicBlock::Create(context, "initialize", enter);
    auto *cache = BasicBlock::Create(context, "cache", enter);
    b.CreateCondBr(b.CreateICmpEQ(b.CreateLoad(i64, highPtr), b.getInt64(0)), init, cache);
    b.SetInsertPoint(init);
    auto initialize =
        module.getOrInsertFunction("kalandra_stack_bounds_init_v1", Type::getVoidTy(context));
    b.CreateCall(initialize);
    b.CreateBr(cache);
    b.SetInsertPoint(cache);
    b.CreateStore(b.CreateLoad(i64, b.CreateConstGEP2_64(type, bounds, 0, 0)),
                  address(b, invocation, Layout::stackLow));
    b.CreateStore(b.CreateLoad(i64, highPtr), address(b, invocation, Layout::stackHigh));
    b.CreateBr(position);
    b.SetInsertPoint(position);
    auto *low = load(b, i64, invocation, Layout::stackLow);
    auto *high = load(b, i64, invocation, Layout::stackHigh);
    // stacksave reads the actual executing stack pointer, including its frame.
    auto *sp = b.CreatePtrToInt(b.CreateStackSave(), i64);
    auto *fits = b.CreateAnd(b.CreateICmpUGT(sp, low), b.CreateICmpULE(sp, high));
    b.CreateCondBr(fits, accepted, exhausted);
#else
    b.CreateCondBr(b.CreateICmpULT(depth, b.getInt64(runtime::Invocation::maxCallDepth)), accepted,
                   exhausted);
#endif
    b.SetInsertPoint(accepted);
#if defined(__APPLE__)
    b.CreateStore(b.CreateSelect(b.CreateICmpEQ(lease, b.getInt64(0)),
                                 b.CreateAdd(depth, b.getInt64(1)), lease),
                  address(b, invocation, Layout::leaseDepth));
#endif
    b.CreateStore(b.CreateAdd(depth, b.getInt64(1)), address(b, invocation, Layout::depth));
    b.CreateRet(b.getTrue());
    b.SetInsertPoint(exhausted);
    b.CreateCall(fault, {invocation, b.getInt64(6), enter->getArg(1), enter->getArg(2)});
    b.CreateBr(denied);
    b.SetInsertPoint(denied);
    b.CreateRet(b.getFalse());
  }
  {
    IRBuilder<> b(prepare(leave));
    auto *invocation = leave->getArg(0);
    auto *depth = load(b, i64, invocation, Layout::depth);
    auto *valid = BasicBlock::Create(context, "valid", leave);
    auto *invalid = BasicBlock::Create(context, "invalid", leave);
    b.CreateCondBr(b.CreateICmpNE(depth, b.getInt64(0)), valid, invalid);
    b.SetInsertPoint(valid);
#if defined(__APPLE__)
    auto *lease = load(b, i64, invocation, Layout::leaseDepth);
    b.CreateStore(b.CreateSelect(b.CreateICmpEQ(depth, lease), b.getInt64(0), lease),
                  address(b, invocation, Layout::leaseDepth));
#endif
    b.CreateStore(b.CreateSub(depth, b.getInt64(1)), address(b, invocation, Layout::depth));
    b.CreateRetVoid();
    b.SetInsertPoint(invalid);
    b.CreateCall(fault, {invocation, b.getInt64(3), b.getInt64(0), b.getInt64(0)});
    b.CreateRetVoid();
  }
  if (auto *observed = module.getFunction("kalandra_tail_enter_v1")) {
    // A separate bounded frame prevents loop optimizers from hoisting the TLS
    // address computation out of a cold admission branch into a private loop.
    observed->setLinkage(GlobalValue::InternalLinkage);
    observed->addFnAttr(Attribute::NoInline);
    observed->addFnAttr(Attribute::NoUnwind);
    IRBuilder<> b(BasicBlock::Create(context, "entry", observed));
    b.CreateRet(b.CreateCall(enter, {observed->getArg(0), observed->getArg(1), observed->getArg(2)}));
  }
}
} // namespace kalandra
