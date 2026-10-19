#include "kalandra/Backend.h"
#include "kalandra/Continuation.h"
#include <iostream>
#include <stdexcept>

using namespace kalandra;
namespace {
void require(bool ok, const char *message) {
  if (!ok)
    throw std::runtime_error(message);
}
CheckResult analyze(std::string text) {
  return check(parse(std::make_shared<SourceFile>("function-values.k", std::move(text))));
}
const std::string functions =
    "fn double(value:int)->int:\n  value*2\n"
    "fn triple(value:int)->int:\n  value*3\n"
    "fn apply(value:int,transform:fn(int)->int)->int:\n  transform(value)\n"
    "fn choose(flag:Bool)->fn(int)->int:\n  if flag:double\n  else:triple\n";
void positive() {
  for (const auto *body :
       {"fn main()->int:\n  f=double\n  alias:fn(int)->int=f\n  alias(21)\n",
        "fn main()->int:\n  apply(14,choose(false))\n", "fn main()->int:\n  choose(true)(21)\n",
        "fn main()->int:\n  f=choose(false)\n  14->f\n",
        "fn main()->int:\n  f=choose(true)\n  values=map([1,2,3],f)\n  values[2]\n",
        "fn main()->int:\n  f=choose(true)\n  values=map([1,2,3],fn(value):f(value))\n  "
        "values[2]\n",
        "fn keep(f:fn(int)->int)->fn(int)->int:\n  f\n"
        "fn main()->int:\n  keep(choose(false))(14)\n",
        "fn factory()->fn(Bool)->fn(int)->int:\n  choose\n"
        "fn main()->int:\n  factory()(false)(14)\n",
        "fn worker(value:int)->int:\n  f=choose(false)\n  f(value)\n"
        "fn main()->int ! TaskError:\n  try parallel:\n    try await spawn worker(14)\n",
        "fn answer()->int:\n  42\nfn main()->int:\n  f=answer\n  f()\n"}) {
    auto checked = analyze(functions + body);
    if (!checked.ok())
      for (const auto &diagnostic : checked.diagnostics)
        std::cerr << renderDiagnostic(*checked.source, diagnostic);
    require(checked.ok(), "valid function value rejected");
    require(dumpTypedIR(*checked.module).find("function.") != std::string::npos,
            "function values disappeared from typed IR");
    require(bool(continuation::plan(*checked.module)), "function continuation planning failed");
#ifndef KALANDRA_FUNCTION_FRONTEND_ONLY
    auto lowered = lowerNative(*checked.module);
    require(bool(lowered), lowered ? "" : lowered.error().c_str());
    require(lowered->llvm.find(".unchecked") == std::string::npos,
            "function pointer retained an unchecked entry");
#endif
  }
}
void negative() {
  for (const auto *body :
       {"fn main()->int:\n  f:fn(float)->float=double\n  0\n",
        "fn main()->int:\n  f=double\n  f()\n", "fn main()->int:\n  f=double\n  f(\"bad\")\n",
        "fn main()->int:\n  f=double\n  f(1,2)\n",
        "fn bad(value:float)->float:\n  value\n"
        "fn main()->int:\n  f=if true:double\n  else:bad\n  0\n",
        "fn main()->int:\n  f=fn(value:int):value+1\n  f(1)\n",
        "type Holder:\n  callback:fn(int)->int\nfn main()->int:\n  0\n",
        "fn main()->int:\n  values=[double,triple]\n  0\n",
        "fn main()->int ! TaskError:\n  f=double\n  try parallel:\n    try await spawn f(1)\n",
        "fn main()->int ! TaskError:\n  try parallel:\n    try await spawn apply(1,double)\n",
        "fn main()->int ! TaskError:\n  try parallel:\n    f=try await spawn choose(true)\n    "
        "f(1)\n",
        "fn main()->int ! TaskError:\n  f=double\n  try parallel:\n    result=try await spawn "
        "map([1],f)\n    result[0]\n",
        "fn coordinate(value:int)->int:\n  run(value) catch fn(error):0\n"
        "fn run(value:int)->int ! TaskError:\n  try parallel:\n    try await spawn double(value)\n"
        "fn main()->int:\n  f=coordinate\n  f(1)\n",
        "fn use(f:fn(int)->int ! TaskError)->int:\n  0\nfn main()->int:\n  0\n",
        "fn arrays(values:[int])->[int]:\n  values\n"
        "fn main()->int:\n  f=arrays\n  0\n",
        "type A:\n  value:int\ntype B:\n  value:int\n"
        "fn read(value:A)->int:\n  value.value\n"
        "fn main()->int:\n  f:fn(B)->int=read\n  0\n"}) {
    auto checked = analyze(functions + body);
    require(!checked.ok(), "invalid signature, capture or execution boundary accepted");
  }
}
void forged() {
  auto checked = analyze(functions + "fn main()->int:\n  f=double\n  f(21)\n");
  require(checked.ok(), "forged IR fixture rejected");
  for (unsigned mode = 0; mode < 10; ++mode) {
    auto module = *checked.module;
    bool changed = false;
    for (ValueId id = 0; id < module.expressions.size(); ++id) {
      auto &expression = module.expressions[id];
      if (auto *ref = std::get_if<FunctionReference>(&expression.operation); ref && mode < 5) {
        if (mode == 0)
          ref->function = SIZE_MAX;
        if (mode == 1)
          expression.type.callable.reset();
        if (mode == 2) {
          auto signature = std::make_shared<FunctionSignature>(*expression.type.callable);
          signature->parameters[0].element = NumericType::Float64;
          expression.type.callable = signature;
        }
        if (mode == 3)
          expression.type.task = true;
        if (mode == 4)
          expression.type.builtin = BuiltinValue::Numeric;
        changed = true;
        break;
      }
      if (auto *call = std::get_if<FunctionInvoke>(&expression.operation); call && mode >= 5) {
        if (mode == 5)
          call->callee = id;
        if (mode == 6)
          call->callee = SIZE_MAX;
        if (mode == 7)
          call->arguments[0] = SIZE_MAX;
        if (mode == 8)
          call->arguments.clear();
        if (mode == 9)
          expression.type.element = NumericType::Float64;
        changed = true;
        break;
      }
    }
    require(changed && numericCapabilityError(module, NumericTarget::Cpu).has_value(),
            "forged callable IR accepted");
  }
}
} // namespace
int main() {
  try {
    positive();
    negative();
    forged();
    std::cout << "Function-value signatures, calls, boundaries and IR checks passed\n";
    return 0;
  } catch (const std::exception &error) {
    std::cerr << error.what() << '\n';
    return 1;
  }
}
