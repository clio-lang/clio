#include "Hover.h"
#include <iostream>
#include <stdexcept>
using namespace kalandra;
static void require(bool ok, const std::string &message) {
  if (!ok)
    throw std::runtime_error(message);
}
static std::optional<lsp::SignatureInfo> query(std::string text) {
  const auto cursor = text.rfind('|');
  require(cursor != text.npos, "missing cursor");
  text.erase(cursor, 1);
  return lsp::signatureInfo(parse(std::make_shared<const SourceFile>("signature.k", text)),
                            "signature.k", cursor);
}
int main() {
  try {
    const std::string add = "fn add(left:int,right:int)->int:\n  left+right\n";
    auto result = query(add + "fn main():\n  add(|1,2)\n");
    require(result && result->label == "fn add(left: int64, right: int64) -> int64" &&
                result->parameters == std::vector<std::string>{"left: int64", "right: int64"} &&
                result->activeParameter == 0,
            "named signature and first argument");
    result = query(add + "fn main():\n  add(1, |2)\n");
    require(result && result->activeParameter == 1, "second argument");
    result = query(add + "fn main():\n  add(add(1,2), |3)\n");
    require(result && result->activeParameter == 1, "nested commas do not advance outer arguments");
    result = query(add + "fn main():\n  add(1,add(|2,3))\n");
    require(result && result->activeParameter == 0, "innermost call selected");
    result = query(add + "fn main():\n  1 -> add(|2)\n");
    require(result && result->activeParameter == 1, "pipeline supplies first parameter");
    result = query(add + "fn main():\n  callback=add\n  callback(1,|2)\n");
    require(result && result->label == "fn callback(int64, int64) -> int64" &&
                result->activeParameter == 1,
            "function binding uses checked callable type");
    result = query("fn invoke(callback:fn(int,int)->int)->int:\n  callback(1,|2)\n"
                   "fn main():\n  0\n");
    require(result && result->parameters == std::vector<std::string>{"int64", "int64"},
            "function parameter signature");
    result = query("type Box:\n  callback:fn(int)->int\nfn double(n:int)->int:\n  n*2\n"
                   "fn main():\n  box=Box {callback:double}\n  box.callback(|2)\n");
    require(result && result->label == "fn callback(int64) -> int64", "function field signature");
    result = query("fn constant()->int:\n  1\nfn main():\n  constant(|)\n");
    require(result && result->parameters.empty() && !result->activeParameter,
            "zero-parameter signature has no active parameter");
    result = query("fn count(values:[int],text:String)->int:\n  length(values)\n"
                   "fn main():\n  count([1,2,3], |\"a,b\")\n");
    require(result && result->activeParameter == 1, "array/string commas stay nested");
    result = query("error Bad:\n  Failed\nfn risky(n:int)->int ! Bad:\n  n\n"
                   "fn main():\n  risky(|1) catch fn(e):0\n");
    require(result && result->label == "fn risky(n: int64) -> int64 ! Bad",
            "expected-error channel signature");
    result = query("fn main():\n  scale=2\n  callback=fn(n:int):n*scale\n  callback(|3)\n");
    require(result && result->parameters == std::vector<std::string>{"int64"},
            "captured parameters are not public arguments");
    require(!query(add + "fn main():\n  add(|1)\n"), "argument mismatch supplies no partial types");
    require(!query(add + "fn main():\n  add(|\n"), "unfinished call not recovered");
    require(!query(add + "fn main():\n  add(1,2)|\n"), "outside call has no signature");
    require(!query(add + "fn main():\n  ad|d(1,2)\n"), "callee text has no active argument");
    require(!query(add + "fn main():\n  missing\n  add(|1,2)\n"), "invalid graph fails closed");
    require(!query("fn main():\n  length(|[1,2])\n"), "no guessed builtin signatures");
    require(!query("fn make()->fn(int)->int:\n  fn(n:int):n\nfn main():\n  make()(|1)\n"),
            "factory callee does not show factory signature");
    std::cout << "Native checked signature help passed\n";
  } catch (const std::exception &error) {
    std::cerr << error.what() << '\n';
    return 1;
  }
}
