#pragma once
static void checkFloat64Tensors() {
  for (auto expression :
       {"a+b", "a-b", "a*b", "a/b", "a+1.5", "1.5-a", "a*2", "2/a", "-a", "+a", "a*b+a"}) {
    auto typed = analyze(
        std::string("fn f(a:Tensor[float,?,?],b:Tensor[float64,?,?]) -> Tensor[float64,?,?]:\n  ") +
        expression + "\nfn main() -> float:\n  0\n");
    require(typed.ok(), expression);
#ifndef KALANDRA_FLOAT64_FRONTEND_ONLY
    auto native = lowerNative(*typed.module);
    require(bool(native), "float64 tensor backend rejected");
    require(native->llvm.find("fadd double") == std::string::npos &&
                native->llvm.find("fmul double") == std::string::npos,
            "float64 tensor arithmetic bypassed strict lowering");
#endif
    require(bool(numericCapabilityError(*typed.module, NumericTarget::AppleGpu)),
            "float64 tensor GPU arithmetic admitted");
  }
  for (auto shape : {"", ",4", ",2,2", ",2,2,1"}) {
    const auto values =
        std::string(shape).empty() ? "tensor(-0.0)"
        : std::string(shape) == ",2,2"
            ? "tensor([[-0.0,1.0000000000000002],[4.9406564584124654e-324,1.7976931348623157e308]])"
        : std::string(shape) == ",2,2,1"
            ? "tensor([-0.0,1.0000000000000002,4.9406564584124654e-324,1.7976931348623157e308],[2,"
              "2,1])"
            : "tensor([-0.0,1.0000000000000002,4.9406564584124654e-324,1.7976931348623157e308])";
    auto typed = analyze("fn values() -> Tensor[float" + std::string(shape) + "]:\n  " + values +
                         "\nfn main() -> float:\n  0\n");
    require(typed.ok(), "ranked binary64 tensor literal rejected");
#ifndef KALANDRA_FLOAT64_FRONTEND_ONLY
    require(bool(lowerNative(*typed.module)), "ranked binary64 literal lowering rejected");
#endif
  }
  struct Bad {
    const char *source;
    const char *code;
  };
  for (auto test :
       {Bad{"fn f(x:Tensor[float64,?]) -> float64:\n  reduceSum(x)\n", "S053"},
        Bad{"fn f(x:Tensor[float64,?,?]) -> Tensor[float64,?,?]:\n  matmul(x,x)\n", "S053"},
        Bad{"fn f(x:Tensor[float,?]) -> Tensor[float,?]:\n  x%2\n", "S019"},
        Bad{"fn f(x:Tensor[float,?],y:Tensor[float32,?]) -> Tensor[float,?]:\n  x+y\n", "S017"},
        Bad{"fn f() -> Tensor[float,1]:\n  tensor([1.8e308])\n", "S015"},
        Bad{"fn f(x:Tensor[float,1152921504606846976]) -> float:\n  0\n", "S002"}}) {
    auto typed = analyze(test.source);
    require(!typed.ok() && typed.diagnostics[0].code == test.code, test.source);
  }
  auto limit = analyze("fn f(x:Tensor[float,1152921504606846975]) -> float:\n  0\n");
  require(limit.ok(), "exact eight-byte static byte bound rejected");
#ifndef KALANDRA_FLOAT64_FRONTEND_ONLY
  // Bypass source checks to verify operation and task admission on all typed IR paths.
  for (auto operation : {"reduceSum(x)", "matmul(x,x)"}) {
    const bool reduction = std::string(operation).starts_with("reduce");
    auto typed = analyze(std::string("fn f(x:Tensor[float32,?,?]) -> ") +
                         (reduction ? "float32" : "Tensor[float32,?,?]") + ":\n  " + operation +
                         "\nfn main() -> float32:\n  0\n");
    require(typed.ok(), "reference builtin source rejected");
    for (auto &fn : typed.module->functions) {
      fn.resultType.element = NumericType::Float64;
      if (fn.declaredResult)
        fn.declaredResult->element = NumericType::Float64;
    }
    for (auto &symbol : typed.module->symbols)
      symbol.type.element = NumericType::Float64;
    for (auto &expr : typed.module->expressions)
      expr.type.element = NumericType::Float64;
    auto rejected = lowerNative(*typed.module);
    require(!rejected && rejected.error().find(reduction ? "reduction element"
                                                         : "matmul element") != std::string::npos,
            "forged float64 builtin reached lowering");
  }
  auto typed = analyze(
      "fn f(x:Tensor[float,?]) -> Tensor[float,?]:\n  x+1\nfn main() -> float ! TaskError:\n  try "
      "parallel:\n    x:Tensor[float,1]=tensor([1])\n    try await spawn f(x)\n    0\n");
  require(typed.ok(), "float64 tensor task rejected");
  auto native = lowerNative(*typed.module);
  require(bool(native) && native->llvm.find("value.layout.tensor.float64.1") != std::string::npos,
          "float64 tensor task lost typed layout");
#endif
}
