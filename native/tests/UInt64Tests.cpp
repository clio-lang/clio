#include "kalandra/Backend.h"
#include <iostream>
#include <stdexcept>
using namespace kalandra;
static CheckResult analyze(const std::string &source) {
  return check(parse(std::make_shared<SourceFile>("uint64.kalandra", source)));
}
static void require(bool ok, const char *message) {
  if (!ok)
    throw std::runtime_error(message);
}
int main() {
  try {
    for (const auto *value :
         {"0", "18446744073709551615", "9223372036854775808", "9007199254740993", "+17", "-0",
          "18446744073709551615 / 2", "18446744073709551615 % 2", "18446744073709551615 * 0",
          "4294967295 * 4294967297"}) {
      auto checked = analyze(std::string("fn main() -> uint64:\n  ") + value + "\n");
      require(checked.ok(), value);
#ifndef KALANDRA_UINT64_FRONTEND_ONLY
      auto lowered = lowerNative(*checked.module);
      require(bool(lowered) &&
                  lowered->llvm.find("_mlir_ciface_kalandra_uint64_entry") != std::string::npos,
              "uint64 CLI/lowering rejected");
#endif
    }
    for (const auto *value : {"18446744073709551616", "-1", "-18446744073709551615", "1.0", "1e0",
                              "18446744073709551615 + 1", "0 - 1", "4294967296 * 4294967296",
                              "18446744073709551615 * 18446744073709551615", "1 / 0", "1 % 0"}) {
      auto checked = analyze(std::string("fn main() -> uint64:\n  ") + value + "\n");
      require(!checked.ok(), value);
      require(checked.diagnostics.front().code == "S051" ||
                  checked.diagnostics.front().code == "S052",
              "wrong uint64 constant diagnostic");
    }
    for (const auto *source :
         {"fn identity(value:uint) -> uint64:\n  value\nfn main() -> uint:\n  "
          "identity(18446744073709551615)\n",
          "fn main() -> uint64:\n  value:uint = 18446744073709551615\n  value - 1\n",
          "fn main() -> uint64:\n  value:uint = 9223372036854775808\n  value + value - 1\n"}) {
      auto checked = analyze(source);
      if (std::string(source).find("value + value") != std::string::npos) {
        require(!checked.ok(), "overflowing intermediate constant escaped");
        continue;
      }
      require(checked.ok(), "uint alias or full-range binding rejected");
#ifndef KALANDRA_UINT64_FRONTEND_ONLY
      require(bool(lowerNative(*checked.module)), "uint alias lowering rejected");
#endif
    }
    for (const auto *source :
         {"fn f(x:uint64) -> int64:\n  x\n", "fn f(x:int64) -> uint64:\n  x\n",
          "fn f(x:uint64,y:uint32) -> uint64:\n  x + y\n",
          "fn f(x:uint64,y:float32) -> uint64:\n  x + y\n",
          "fn f(x:Tensor[uint64,?]) -> uint64:\n  0\n", "fn f() -> uint16:\n  0\n",
          "fn f() -> float64:\n  0\n", "fn main() -> uint:\n  value = 1\n  value\n",
          "fn main() -> uint:\n  value:uint = 18446744073709551615\n  value * value\n",
          "fn main() -> uint:\n  value:uint = 18446744073709551615\n  -value\n",
          "fn f(value:uint) -> uint:\n  zero:uint = 0\n  value / zero\n"})
      require(!analyze(source).ok(), "unsupported conversion/type or invalid binding accepted");
    auto task =
        analyze("fn identity(value:uint) -> uint:\n  value\nfn main() -> uint ! TaskError:\n"
                "  try parallel:\n    try await spawn identity(18446744073709551615)\n");
    require(task.ok(), "uint64 task rejected");
#ifndef KALANDRA_UINT64_FRONTEND_ONLY
    auto lowered = lowerNative(*task.module);
    require(bool(lowered) && lowered->llvm.find("value.layout.scalar.uint64") != std::string::npos,
            "uint64 task layout lost");
    require(dumpTypedIR(*task.module).find("u64 18446744073709551615") != std::string::npos,
            "unsigned literal lost full-range typed identity");
    auto forged =
        analyze("fn f(x:Tensor[uint32,?]) -> Tensor[uint32,?]:\n  x\nfn main() -> uint32:\n  0\n");
    for (auto &expr : forged.module->expressions)
      if (expr.type.tensor)
        expr.type.element = NumericType::UInt64;
    auto rejected = lowerNative(*forged.module);
    require(!rejected && rejected.error().find("uint64 tensor") != std::string::npos,
            "backend admitted uint64 tensors");
#endif
    require(bool(numericCapabilityError(*task.module, NumericTarget::AppleGpu)),
            "uint64 GPU arithmetic enabled");
    std::cout << "Checked uint64 literals/constants, uint alias, full-range bindings, scalar task "
                 "identity and strict width/tensor/target gates passed\n";
  } catch (const std::exception &error) {
    std::cerr << error.what() << '\n';
    return 1;
  }
}
