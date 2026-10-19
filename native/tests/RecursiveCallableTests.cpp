#include "kalandra/Backend.h"
#include "kalandra/Continuation.h"
#include <algorithm>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <iterator>
#include <stdexcept>
using namespace kalandra;
static void require(bool ok, const char *message) {
  if (!ok)
    throw std::runtime_error(message);
}
static CheckResult analyze(std::string text) {
  return check(parse(std::make_shared<SourceFile>("recursive-callables.k", std::move(text))));
}
int main() {
  try {
    unsigned programs = 0;
    for (const auto &entry : std::filesystem::directory_iterator(KALANDRA_RECURSIVE_FIXTURES)) {
      if (entry.path().extension() != ".k")
        continue;
      std::ifstream file(entry.path());
      auto result = analyze({std::istreambuf_iterator<char>(file), {}});
      if (!result.ok())
        for (const auto &d : result.diagnostics)
          std::cerr << renderDiagnostic(*result.source, d);
      require(result.ok(), "recursive callable source rejected");
      auto plan = continuation::plan(*result.module);
      require(bool(plan), "recursive callable planning failed");
      if (entry.path().stem() == "self" || entry.path().stem() == "mutual") {
        bool backedge = false;
        for (const auto &p : plan->plans)
          for (const auto &op : p->code)
            backedge |= op.code == continuation::Code::SynchronousCall;
        require(backedge, "static recursion still expanded its body");
        require(continuation::dump(*plan).find("synchronous.call") != std::string::npos,
                "recursive plan dump lost its call kind");
      }
      ++programs;
    }
    require(programs == 22, "recursive fixture catalog incomplete");
    for (const auto *text :
         {"fn descend(n:int):\n  if n==0:\n    0\n  else:\n    descend(n-1)\nfn main()->int:\n  "
          "0\n",
          "fn main()->int:\n  f=fn(n:int):\n    if n==0:\n      0\n    else:\n      f(n-1)\n  "
          "f(20)\n",
          "fn leaf(n:int)->int:\n  n\nfn recur(n:int)->int ! TaskError:\n  try parallel:\n    try "
          "await spawn leaf(n)\nfn main()->int:\n  callback=recur\n  0\n"})
      require(!analyze(text).ok(), "unsupported recursion/inference/coordination admitted");
    auto co = analyze("fn leaf(n:int)->int:\n  n\nfn recur(n:int)->int ! TaskError:\n  if n==0:\n  "
                      "  try parallel:\n      try await spawn leaf(n)\n  else:\n    try "
                      "recur(n-1)\nfn main()->int ! TaskError:\n  try recur(20)\n");
    require(co.ok() && !continuation::plan(*co.module), "coordinating recursion admitted");
    std::cout << "Recursive callables: 22 checked/planned programs, static backedges and 4 "
                 "unsupported boundaries passed\n";
  } catch (const std::exception &error) {
    std::cerr << error.what() << '\n';
    return 1;
  }
}
