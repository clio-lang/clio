#include "kalandra/Backend.h"
#include <iostream>
#include <stdexcept>
using namespace kalandra;
static CheckResult analyze(const std::string &source) {
  return check(parse(std::make_shared<SourceFile>("uint32.kalandra", source)));
}
static void require(bool ok, const char *message) {
  if (!ok)
    throw std::runtime_error(message);
}
int main() {
  try {
    for (const auto *value :
         {"0", "4294967295", "2147483648", "16777217", "+17", "-0", "4294967295 / 2",
          "4294967295 % 2", "4294967295 * 0", "(4294967295 - 2) + 1"}) {
      auto checked = analyze(std::string("fn main() -> uint32:\n  ") + value + "\n");
      require(checked.ok(), value);
#ifndef KALANDRA_UINT32_FRONTEND_ONLY
      auto lowered = lowerNative(*checked.module);
      require(bool(lowered), "uint32 lowering rejected");
      require(lowered->llvm.find("_mlir_ciface_kalandra_uint32_entry") != std::string::npos,
              "uint32 CLI entry lost");
#endif
    }
    for (const auto *value :
         {"4294967296", "-1", "-4294967295", "1.0", "1e0", "18446744073709551616", "4294967295 + 1",
          "0 - 1", "65536 * 65536", "4294967295 * 4294967295", "-4294967295", "1 / 0", "1 % 0"}) {
      auto checked = analyze(std::string("fn main() -> uint32:\n  ") + value + "\n");
      require(!checked.ok(), value);
      require(checked.diagnostics.front().code == "S051" ||
                  checked.diagnostics.front().code == "S052",
              "wrong constant diagnostic");
    }
    for (const auto *source :
         {"fn main() -> uint32:\n  x:uint32 = 4294967295\n  x * x\n",
          "fn main() -> uint32:\n  x:uint32 = 1\n  -x\n", "fn main() -> uint32:\n  x = 1\n  x\n",
          "fn f(x:int32) -> uint32:\n  x\nfn main() -> uint32:\n  f(1)\n",
          "fn f(x:uint32) -> int32:\n  x\nfn main() -> int32:\n  f(1)\n",
          "fn f(x:uint32,y:int32) -> uint32:\n  x + y\nfn main() -> uint32:\n  f(1,1)\n",
          "fn f(x:uint32,y:float32) -> uint32:\n  x + y\nfn main() -> uint32:\n  f(1,1)\n",
          "fn main() -> uint:\n  1\n", "fn f(x:Tensor[uint32,?]) -> uint32:\n  reduceSum(x)\n",
          "fn f() -> Tensor[uint32,1]:\n  tensor([1])\n"})
      require(!analyze(source).ok(), "unsupported conversion/default/tensor accepted");
    auto knownZero = analyze(
        "fn f(x:uint32) -> uint32:\n  z:uint32 = 0\n  x / z\nfn main() -> uint32:\n  f(1)\n");
    require(!knownZero.ok() && knownZero.diagnostics.front().code == "S052",
            "known zero divisor escaped");
    auto task = analyze("fn inc(x:uint32) -> uint32:\n  x + 1\nfn main() -> uint32 ! TaskError:\n  "
                        "try parallel:\n    try await spawn inc(2147483648)\n");
    require(task.ok(), "uint32 task rejected");
#ifndef KALANDRA_UINT32_FRONTEND_ONLY
    auto loweredTask = lowerNative(*task.module);
    require(bool(loweredTask), "uint32 task lowering rejected");
    require(loweredTask->llvm.find("value.layout.scalar.uint32") != std::string::npos,
            "unsigned task identity lost");
    auto tensor = analyze(
        "fn f(x:Tensor[float32,?]) -> Tensor[float32,?]:\n  x\nfn main() -> float32:\n  0\n");
    for (auto &fn : tensor.module->functions) {
      fn.resultType.element = NumericType::UInt32;
      if (fn.declaredResult)
        fn.declaredResult->element = NumericType::UInt32;
    }
    for (auto &symbol : tensor.module->symbols)
      symbol.type.element = NumericType::UInt32;
    for (auto &expr : tensor.module->expressions)
      expr.type.element = NumericType::UInt32;
    auto rejected = lowerNative(*tensor.module);
    require(!rejected && rejected.error().find("uint32 tensors") != std::string::npos,
            "unqualified unsigned tensors enabled");
#endif
    require(bool(numericCapabilityError(*task.module, NumericTarget::AppleGpu)),
            "unsigned GPU arithmetic enabled");
    std::cout << "Checked uint32 literals, constants, unsigned task identity and strict "
                 "type/target gates passed\n";
  } catch (const std::exception &e) {
    std::cerr << e.what() << '\n';
    return 1;
  }
}
