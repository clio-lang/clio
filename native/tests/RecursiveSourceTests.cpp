#include "kalandra/Backend.h"
#include "kalandra/Continuation.h"
#include <algorithm>
#include <iostream>
#include <stdexcept>
using namespace kalandra;
static const std::string prefix = "enum List:\n  Nil\n  Cons:\n    head:int\n    tail:List\n";
static CheckResult analyze(std::string source) {
  return check(parse(std::make_shared<SourceFile>("recursive-source.k", std::move(source))));
}
static void require(bool value, const char *message) {
  if (!value)
    throw std::runtime_error(message);
}
int main() {
  try {
    auto valid = analyze(prefix + "fn sum(items:List)->int:\n  match items:\n    List.Nil:0\n"
                                  "    List.Cons {head,tail}:head+sum(tail)\nfn main()->int:\n"
                                  "  sum(List.Cons {head:42,tail:List.Nil})\n");
    if (!valid.ok())
      for (const auto &d : valid.diagnostics)
        std::cerr << renderDiagnostic(*valid.source, d);
    require(valid.ok() && !numericCapabilityError(*valid.module, NumericTarget::Cpu),
            "valid recursive source rejected");
    require(!continuation::plan(*valid.module), "recursive continuation/worker plan admitted");
    require(bool(numericCapabilityError(*valid.module, NumericTarget::AppleGpu)),
            "recursive GPU admitted");
#ifndef KALANDRA_RECURSIVE_SOURCE_FRONTEND_ONLY
    auto lowered = lowerNative(*valid.module);
    require(lowered && lowered->mlir.find("scf.index_switch") != std::string::npos &&
                lowered->llvm.find("kalandra_recursive_make_v1") != std::string::npos,
            "recursive source did not use ordinary checked switch/boxing lowering");
    require(!lowerNative(*valid.module, {}, {"sum"}), "recursive bridge exports admitted");
#endif
    auto text = analyze(
        "enum Text:\n  Empty\n  More:\n    text:String\n    next:Text\nfn main()->int:\n  0\n");
    require(text.ok(), "recursive String schema rejected");
    auto collections =
        analyze("enum Chain:\n  End\n  Link:\n    values:[int]\n"
                "    flags:[Bool]\n    tensor:Tensor[float64,?,2]\n    names:[String]\n"
                "    next:Chain\nfn main()->int:\n  0\n");
    require(collections.ok() && !numericCapabilityError(*collections.module, NumericTarget::Cpu),
            "recursive numeric/Bool collection schema rejected");
    auto tree = analyze(
        "type Tree:\n  children:[Tree]\nfn main()->int:\n"
        "  leaf=Tree {children:[]}\n  root=Tree {children:[leaf,leaf]}\n  length(root.children)\n");
    require(tree.ok(), "array-mediated recursive source rejected");
#ifndef KALANDRA_RECURSIVE_SOURCE_FRONTEND_ONLY
    require(bool(lowerNative(*tree.module)), "array-mediated source failed native lowering");
#endif
    auto callable = analyze(
        "enum Chain:\n  End\n  More:\n    apply:fn(int)->int\n    next:Chain\n"
        "fn make(offset:int)->Chain:\n  Chain.More {apply:fn(value):value+offset,next:Chain.End}\n"
        "fn main()->int:\n  chain=make(20)\n  match chain:\n    Chain.End:0\n    Chain.More "
        "{apply}:apply(22)\n");
    require(callable.ok(), "recursive captured callable source rejected");
#ifndef KALANDRA_RECURSIVE_SOURCE_FRONTEND_ONLY
    auto callableIr = lowerNative(*callable.module);
    require(callableIr && callableIr->llvm.find("kalandra_recursive_environment_read_v1") !=
                              std::string::npos,
            "recursive callable did not use checked managed environment reads");
#endif
    auto functionArray =
        analyze("enum Chain:\n  End\n  More:\n    callbacks:[fn(int)->int]\n    next:Chain\n"
                "fn make(offset:int)->Chain:\n  add=fn(value:int):value+offset\n"
                "  Chain.More {callbacks:[add,add],next:Chain.End}\n"
                "fn main()->int:\n  match make(20):\n    Chain.End:0\n"
                "    Chain.More {callbacks}:callbacks[0](1)+callbacks[1](1)\n");
    require(functionArray.ok(), "recursive function array source rejected");
#ifndef KALANDRA_RECURSIVE_SOURCE_FRONTEND_ONLY
    auto arrayIr = lowerNative(*functionArray.module);
    require(arrayIr && arrayIr->llvm.find("kalandra_recursive_function_array_dependency_v1") !=
                           std::string::npos,
            "recursive function arrays did not use checked ownership bridge");
#endif
    for (const auto &source :
         {"enum Loop:\n  More:\n    next:Loop\nfn main()->int:\n  0\n",
          "type A:\n  child:B\ntype B:\n  child:A\nfn main()->int:\n  0\n",
          "enum Text:\n  Empty\n  More:\n    text:[fn(int)->int ! TaskError]\n    next:Text\nfn "
          "main()->int:\n "
          " 0\n",
          "enum Callback:\n  Empty\n  More:\n    call:fn(int)->int ! TaskError\n    "
          "next:Callback\nfn "
          "main()->int:\n  0\n"}) {
      auto failed = analyze(source);
      require(!failed.ok() && !failed.diagnostics.empty(),
              "unsupported or infinite recursive schema admitted");
    }
    for (const auto &tail :
         {"fn main()->int ! TaskError:\n  try parallel:\n    0\n",
          "fn main()->int:\n  match List.Nil:\n    List.Cons {head}:head\n",
          "fn main()->int:\n  match List.Nil:\n    List.Nil:0\n    List.Nil:1\n    List.Cons:2\n"})
      require(!analyze(prefix + tail).ok(),
              "unsupported recursive execution or invalid match admitted");
    for (unsigned mutation = 0; mutation < 8; ++mutation) {
      auto forged = *valid.module;
      auto found = std::ranges::find_if(forged.expressions, [](const auto &expression) {
        return std::holds_alternative<MatchOperation>(expression.operation);
      });
      require(found != forged.expressions.end(), "recursive match IR was not preserved");
      auto &match = std::get<MatchOperation>(found->operation);
      switch (mutation) {
      case 0:
        match.subject = SIZE_MAX;
        break;
      case 1:
        match.cases.clear();
        break;
      case 2:
        match.cases[0].tag = 0;
        break;
      case 3:
        match.cases[1].tag = match.cases[0].tag;
        break;
      case 4:
        match.cases[0].tag.reset();
        break;
      case 5:
        match.cases[0].result = SIZE_MAX;
        break;
      case 6:
        match.cases.pop_back();
        break;
      case 7:
        match.cases[0].body.push_back({{}, {}, SIZE_MAX});
        break;
      }
      require(bool(numericCapabilityError(forged, NumericTarget::Cpu)),
              "forged recursive match admitted");
#ifndef KALANDRA_RECURSIVE_SOURCE_FRONTEND_ONLY
      require(!lowerNative(forged), "forged recursive match reached backend");
#endif
    }
    std::cout << "recursive source frontend passed\n";
  } catch (const std::exception &error) {
    std::cerr << error.what() << '\n';
    return 1;
  }
}
