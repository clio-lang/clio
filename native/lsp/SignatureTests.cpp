#include "Hover.h"
#include "Signature.h"
#include <filesystem>
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
static std::optional<lsp::SignatureInfo> recover(std::string text) {
  const auto cursor = text.rfind('|');
  require(cursor != text.npos, "missing recovery cursor");
  text.erase(cursor, 1);
  return lsp::signatureAt(
      (std::filesystem::temp_directory_path() / "signature-recovery.k").string(), text, cursor);
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
    result = query("fn make()->fn(int)->int:\n  fn(n:int):n\nfn main():\n  make()(|1)\n");
    require(result && result->label == "fn(int64) -> int64" && result->activeParameter == 0,
            "factory result signature rather than factory signature");
    result = query("fn make(offset:int)->fn(int,int)->int:\n  fn(a:int,b:int):a+b+offset\n"
                   "fn main():\n  make(3)(1,|2)\n");
    require(result && result->parameters == std::vector<std::string>{"int64", "int64"} &&
                result->activeParameter == 1,
            "captured factory result parameters");
    result = query("fn make(offset:int)->fn(int,int)->int:\n  fn(a:int,b:int):a+b+offset\n"
                   "fn main():\n  make(|3)(1,2)\n");
    require(result && result->label == "fn make(offset: int64) -> (fn(int64, int64) -> int64)",
            "factory arguments still show factory signature");
    result = query(add + "fn main():\n  callbacks=[add]\n  callbacks[0](1,|2)\n");
    require(result && result->label == "fn(int64, int64) -> int64" && result->activeParameter == 1,
            "indexed callable signature");
    result = query(add + "fn main():\n  callbacks=[add]\n  1 -> callbacks[0](|2)\n");
    require(result && result->activeParameter == 1, "indexed pipeline implicit parameter");
    result = query("fn make()->fn(int,int)->int:\n  fn(a:int,b:int):a+b\n"
                   "fn main():\n  1 -> make()(|2)\n");
    require(result && result->activeParameter == 1, "factory pipeline checked invocation span");
    result = query("fn main():\n  (fn(n:int):n*2)(|3)\n");
    require(result && result->label == "fn(int64) -> int64", "direct anonymous call signature");
    result = query("fn make()->[fn(int)->int]:\n  [fn(n:int):n]\n"
                   "fn main():\n  make()[0](|3)\n");
    require(result && result->label == "fn(int64) -> int64", "indexed factory result signature");
    result = query("error Bad:\n  Failed\nfn make()->fn(int)->int ! Bad:\n  fn(n:int):n\n"
                   "fn main():\n  make()(|3) catch fn(e):0\n");
    require(result && result->label == "fn(int64) -> int64 ! Bad",
            "returned callable error channel is retained");
    require(!query(add + "fn main():\n  callbacks=[add]\n  callbacks[0](|1)\n"),
            "invalid indexed arguments do not leak signature");
    require(!query(add + "fn main():\n  callbacks=[add]\n  callbacks[2](|1,2)\n"),
            "invalid index fails whole graph");
    require(!query("fn main():\n  numbers=[1]\n  numbers[0](|2)\n"),
            "indexed numeric value is not callable");
    require(!query("fn make()->int:\n  1\nfn main():\n  make()(|2)\n"),
            "numeric factory result does not suggest factory signature");
    result = recover(add + "fn main():\n  add(1,2|\n");
    require(result && result->activeParameter == 1, "recover missing closing parenthesis");
    result = recover(add + "fn main():\n  add(1,add(2,3|\n");
    require(result && result->activeParameter == 1, "recover nested trailing parentheses");
    result = recover("fn constant()->int:\n  1\nfn main():\n  constant(|\n");
    require(result && result->parameters.empty(), "empty zero-parameter call recovery");
    result = recover("fn make()->fn(int,int)->int:\n  fn(a:int,b:int):a+b\n"
                     "fn main():\n  make()(1,2|\n");
    require(result && result->label == "fn(int64, int64) -> int64", "factory-result recovery");
    result = recover(add + "fn main():\n  callbacks=[add]\n  1 -> callbacks[0](2|\n");
    require(result && result->activeParameter == 1, "indexed pipeline recovery");
    result = recover(add + "fn main():\n  add(1,2|)\n");
    require(result && result->activeParameter == 1, "ordinary valid calls retain signature");
    result = recover(add + "fn main():\n  add(|\n");
    require(result && result->activeParameter == 0, "first missing argument signature");
    result = recover(add + "fn main():\n  add(1,|\n");
    require(result && result->activeParameter == 1, "next missing argument signature");
    result = query(add + "fn main():\n  add(1,|)\n");
    require(result && result->activeParameter == 1, "balanced incomplete call signature");
    result = recover(add + "fn main():\n  callback=add\n  callback(1,|\n");
    require(result && result->label == "fn callback(int64, int64) -> int64",
            "bound callable missing arguments");
    result = recover("fn make()->fn(int,int)->int:\n  fn(a:int,b:int):a+b\n"
                     "fn main():\n  make()(1,|\n");
    require(result && result->label == "fn(int64, int64) -> int64", "factory missing argument");
    result = recover(add + "fn main():\n  callbacks=[add]\n  1 -> callbacks[0](|\n");
    require(result && result->activeParameter == 1, "indexed pipeline missing argument");
    require(!recover(add + "fn main():\n  add(\"bad\",|\n"),
            "invalid prefix argument type blocks snapshot");
    require(!recover(add + "fn main():\n  add(missing,|\n"), "invalid prefix name blocks snapshot");
    require(!recover(add + "fn broken()->int:\n  missing\nfn main():\n  add(1,|\n"),
            "unrelated graph errors block snapshots");
    require(!recover("fn broken(n:int)->int:\n  missing\nfn main():\n  broken(|\n"),
            "invalid target body blocks named signature snapshot");
    result = recover("type Point:\n  x:int\nfn inspect(point:Point,n:int)->int:\n  point.x+n\n"
                     "fn main():\n  inspect(Point {x:1},|\n");
    require(result && result->parameters == std::vector<std::string>{"point: Point", "n: int64"},
            "nominal parameter snapshot");
    result = recover("error First:\n  Bad\nerror Second:\n  Bad\n"
                     "fn risky(a:int,b:int)->int ! (First | Second):\n  a+b\n"
                     "fn main():\n  risky(1,|\n");
    require(result && result->label == "fn risky(a: int64, b: int64) -> int64 ! First | Second",
            "error union snapshot display metadata");
    require(!query("fn main(n:int)->int:\n  main(|)\n"),
            "incomplete recursive callee does not snapshot an unfinished definition");
    require(!query(add + "fn main():\n  add(1,|)\nfn later()->int:\n  missing\n"),
            "later reported graph error invalidates an already captured snapshot");
    const std::string missingCall = add + "fn main():\n  add(1,)\n";
    auto syntax = parse(std::make_shared<const SourceFile>("snapshot.k", missingCall));
    SourceSpan callSite{};
    for (const auto &expression : syntax.module.expressions)
      if (std::holds_alternative<CallExpr>(expression.value))
        callSite = expression.span;
    CallableSignatureQuery snapshot{callSite, {}};
    CheckOptions options;
    options.signature = &snapshot;
    auto checked = check(std::move(syntax), {}, options);
    require(!checked.ok() && !checked.module && snapshot.snapshot &&
                snapshot.snapshot->parameterNames == std::vector<std::string>{"left", "right"},
            "snapshot never returns a partial typed module");
    (void)check(parse(std::make_shared<const SourceFile>("snapshot.k", "fn main():\n  0\n")), {},
                options);
    require(!snapshot.snapshot, "query snapshot resets between checks");
    auto ordinary = check(parse(std::make_shared<const SourceFile>("snapshot.k", missingCall)));
    require(!ordinary.ok() && !ordinary.module && ordinary.diagnostics.size() == 1 &&
                ordinary.diagnostics.front().code == "S027",
            "ordinary compiler keeps its missing-argument diagnostic");
    require(!recover(add + "fn main():\n  add(1,2|\n  missing\n"), "later code is not hidden");
    require(!recover(add + "fn main():\n  missing\n  add(1,2|\n"), "earlier errors fail closed");
    require(!recover(add + "fn main():\n  add(1,\"text\"|\n"), "argument types must check");
    require(!recover(add + "fn main():\n  add([1,2|\n"), "unclosed array is not recovered");
    require(!recover(add + "fn main():\n  add(1,{|\n"), "unclosed record is not recovered");
    require(!recover(add + "fn main():\n  add(1,2]|\n"), "mismatched delimiters fail closed");
    require(!recover(add + "fn main():\n  add(1,\"unfinished|"),
            "unclosed string is not recovered");
    require(!recover(add + "fn main():\n  add(1,2 # comment|"),
            "comment does not receive delimiters");
    require(!recover(add + "fn main():\n  ((((((((add(1,2|\n"),
            "recovery has an eight-delimiter bound");
    std::cout << "Native checked signature help passed\n";
  } catch (const std::exception &error) {
    std::cerr << error.what() << '\n';
    return 1;
  }
}
