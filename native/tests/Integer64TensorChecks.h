#pragma once
// Shared frontend and backend admission checks, instantiated for each signedness.
static void checkInteger64Tensors(const std::string &element, bool backend) {
  const auto tensor = "Tensor[" + element + ",?]";
  for (const auto &expression : {"x + 1", "1 - x", "x * 2", "x / 2", "x % 2", "-x", "+x"}) {
    auto result = analyze("fn f(x:" + tensor + ") -> " + tensor + ":\n  " + expression +
                          "\nfn main() -> " + element + ":\n  0\n");
    require(result.ok(), "64-bit tensor expression rejected");
#if !defined(KALANDRA_INT64_FRONTEND_ONLY) && !defined(KALANDRA_UINT64_FRONTEND_ONLY)
    if (backend)
      require(bool(lowerNative(*result.module)), "64-bit tensor backend rejected");
#else
    (void)backend;
#endif
  }
  const auto invalidLiteral = element == "uint64" ? "-1" : "9223372036854775808";
  require(
      !analyze("fn f() -> Tensor[" + element + ",1]:\n  tensor([" + invalidLiteral + "])\n").ok(),
      "signedness/range of contextual tensor literal lost");
  const auto other = element == "uint64" ? "int64" : "uint64";
  require(
      !analyze("fn f(x:" + tensor + ", y:Tensor[" + other + ",?]) -> " + tensor + ":\n  x + y\n")
           .ok(),
      "implicit tensor signedness conversion admitted");
  auto alias =
      analyze("fn f(x:Tensor[" + (element == "uint64" ? std::string("uint") : std::string("int")) +
              ",?]) -> " + tensor + ":\n  x\nfn main() -> " + element + ":\n  0\n");
  require(alias.ok(), "64-bit tensor alias rejected");
  for (const auto &expression : {"reduceSum(x)", "matmul(x,x)"})
    require(!analyze("fn f(x:" + tensor + ") -> " + element + ":\n  " + expression + "\n").ok(),
            "unsupported 64-bit tensor builtin admitted");
  require(!analyze("fn f() -> Tensor[" + element + ",1152921504606846976]:\n  tensor([])\n").ok(),
          "eight-byte static allocation bound lost");
  require(!analyze("fn f(x:" + tensor + ", y:Tensor[int32,?]) -> " + tensor + ":\n  x + y\n").ok(),
          "implicit tensor width conversion admitted");
  require(!analyze("fn f() -> Tensor[" + element + ",1]:\n  tensor([18446744073709551616])\n").ok(),
          "out-of-range tensor literal admitted");
#if !defined(KALANDRA_INT64_FRONTEND_ONLY) && !defined(KALANDRA_UINT64_FRONTEND_ONLY)
  if (backend) {
    for (const auto &source :
         {"fn f(x:Tensor[int32,?]) -> int32:\n  reduceSum(x)\nfn main() -> int32:\n  0\n",
          "fn f(x:Tensor[int32,?,?]) -> Tensor[int32,?,?]:\n  matmul(x,x)\nfn main() -> int32:\n  "
          "0\n"}) {
      auto forged = analyze(source);
      require(forged.ok(), "backend gate fixture invalid");
      const auto numeric = element == "uint64" ? NumericType::UInt64 : NumericType::Int64;
      for (auto &fn : forged.module->functions) {
        fn.resultType.element = numeric;
        if (fn.declaredResult)
          fn.declaredResult->element = numeric;
      }
      for (auto &symbol : forged.module->symbols)
        symbol.type.element = numeric;
      for (auto &expr : forged.module->expressions)
        expr.type.element = numeric;
      require(!lowerNative(*forged.module), "backend admitted unqualified wide reduction/matmul");
    }
  }
#endif
}
