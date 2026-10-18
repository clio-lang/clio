#include "kalandra/Backend.h"
#include "kalandra/Continuation.h"
#include <iostream>
#include <stdexcept>
using namespace kalandra;
static void require(bool ok, const std::string &why) {
  if (!ok)
    throw std::runtime_error(why);
}
static CheckResult analyze(const std::string &s) {
  return check(parse(std::make_shared<SourceFile>("narrow-tensors.k", s)));
}
int main() {
  try {
    for (const auto *name : {"int8", "uint8", "int16", "uint16"}) {
      const std::string type = name, tensor = "Tensor[" + type + ",?,?]";
      auto element = *resolveNumeric(type);
      require(numericTensorElementwiseAvailable(element, NumericTarget::Cpu) &&
                  !numericTensorElementwiseAvailable(element, NumericTarget::AppleGpu) &&
                  !numericArithmeticAvailable(element, NumericTarget::Cpu),
              "tensor gate enabled unrelated operations");
      for (const auto &operation : {"a+1", "1-a", "a*2", "a/2", "a%2", "-a", "+a"}) {
        auto result = analyze("fn operation(a:" + tensor + ")->" + tensor + ":\n  " + operation +
                              "\nfn main()->int:\n  0\n");
        require(result.ok(), "narrow tensor arithmetic rejected");
        if (std::string_view(operation) == "a+1")
          require(dumpTypedIR(*result.module)
                          .find("elementwise add." + std::string(isUnsigned(element) ? "u" : "i") +
                                std::to_string(describeNumeric(element)->bits) + " checked") !=
                      std::string::npos,
                  "typed IR lost narrow integer width or signedness");
#ifndef KALANDRA_NARROW_TENSOR_FRONTEND_ONLY
        auto lowered = lowerNative(*result.module);
        require(bool(lowered), lowered ? "" : lowered.error());
#endif
      }
      for (const auto &s :
           {"fn main()->Tensor[" + type + ",2,2]:\n  tensor([[1,2],[3,4]])\n",
            "fn main()->Tensor[" + type + ",2,0,3]:\n  tensor([],[2,0,3])\n",
            "fn main()->[" + type + "]:\n  data:[" + type +
                "]=[1,2,3,4]\n  array(reshape(tensor(data),[2,2]))\n",
            "type Box:\n  matrix:" + tensor +
                "\nfn step(p:Box)->Box:\n  p with {matrix:p.matrix+1}\nfn main()->[" + type +
                "] ! TaskError:\n  original=Box {matrix:tensor([[1,2],[3,4]])}\n  p=try "
                "parallel:\n    work=spawn step(original)\n    first=try await work\n    again=try "
                "await work\n    again\n  array(p.matrix)\n"}) {
        auto result = analyze(s);
        if (!result.ok())
          for (const auto &d : result.diagnostics)
            std::cerr << renderDiagnostic(*result.source, d);
        require(result.ok(), "narrow tensor storage/worker source rejected");
        require(bool(continuation::plan(*result.module)), "tensor continuation plan failed");
        require(bool(numericCapabilityError(*result.module, NumericTarget::AppleGpu)),
                "narrow GPU admitted");
#ifndef KALANDRA_NARROW_TENSOR_FRONTEND_ONLY
        auto lowered = lowerNative(*result.module);
        require(bool(lowered), lowered ? "" : lowered.error());
#endif
      }
      for (const auto &s : {"fn f(a:" + tensor + ")->" + type + ":\n  reduceSum(a)\n",
                            "fn f(a:" + tensor + ")->" + tensor + ":\n  matmul(a,a)\n",
                            "fn f(a:" + tensor + ")->Tensor[int64,?,?]:\n  int64(a)\n",
                            "fn f(a:Tensor[int64,?,?])->" + tensor + ":\n  " + type + "(a)\n",
                            "fn f(a:" + tensor + ")->" + tensor + ":\n  " + type + "(a)\n",
                            "fn f(a:" + tensor + ",b:Tensor[int64,?,?])->" + tensor + ":\n  a+b\n",
                            "fn main()->Tensor[" + type + ",2]:\n  tensor([1,2,3])\n"})
        require(!analyze(s).ok(), "unsupported narrow tensor operation admitted: " + s);
      // Both ends of a forged tensor cast must honor the conversion gate.
      auto original = analyze(
          "fn f(a:Tensor[int64,?])->Tensor[float64,?]:\n  float64(a)\nfn main()->int:\n  0\n");
      for (bool destination : {false, true}) {
        auto forged = *original.module;
        for (auto &e : forged.expressions)
          if (auto *cast = std::get_if<NumericConvert>(&e.operation)) {
            if (destination)
              e.type.element = element;
            else
              forged.expressions[cast->input].type.element = element;
          }
        require(bool(numericCapabilityError(forged, NumericTarget::Cpu)),
                "forged narrow tensor cast bypassed gate");
      }
    }
    std::cout << "Narrow tensors: four element types, checked elementwise operations, owned "
                 "records/workers and explicit reduction/conversion/GPU gates passed\n";
  } catch (const std::exception &e) {
    std::cerr << e.what() << '\n';
    return 1;
  }
}
