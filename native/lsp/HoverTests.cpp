#include "Hover.h"
#include <iostream>
#include <stdexcept>
using namespace kalandra;
static void require(bool ok, const std::string &message) {
  if (!ok)
    throw std::runtime_error(message);
}
static std::optional<lsp::HoverInfo> query(const std::string &text, const std::string &needle,
                                           std::size_t within = 0) {
  const auto at = text.find(needle);
  require(at != std::string::npos, "missing test token");
  auto source = std::make_shared<const SourceFile>("hover.k", text);
  return lsp::hoverInfo(parse(source), "hover.k", at + within);
}
static void expect(const std::string &text, const std::string &needle, const std::string &expected,
                   std::size_t within = 0) {
  auto result = query(text, needle, within);
  require(result && result->text == expected, "hover mismatch for " + needle + ": " +
                                                  (result ? result->text : "null") +
                                                  " != " + expected + "\nsource:\n" + text);
  require(result->source->path() == "hover.k" && result->span.begin <= text.find(needle) + within &&
              result->span.end > text.find(needle) + within,
          "hover range did not cover token");
}
int main() {
  try {
    const std::string code =
        "fn double(value:int):\n  value*2\nfn main():\n  result=double(21)\n  result\n";
    expect(code, "double(value", "fn double(value: int64) -> int64");
    expect(code, "double(21", "fn double(value: int64) -> int64", 2);
    expect(code, "value:int", "value: int64");
    expect(code, "value*2", "value: int64");
    expect(code, "result=", "result: int64");
    expect(code, "result\n", "result: int64");
    expect(code, "21", "21: int64");
    require(!query(code, "fn double"), "keyword produced misleading hover");
    require(!query(code, "  result"), "whitespace produced misleading hover");
    require(!query(code, "*2"), "operator produced misleading hover");
    require(!query("fn main():\n  missing\n", "main"), "failed graph leaked partial types");
    const std::string closure =
        "fn main():\n  offset=1\n  transform=fn(x:int):x+offset\n  transform(2)\n";
    expect(closure, "transform=", "transform: fn(int64) -> int64");
    expect(closure, "transform(2", "transform: fn(int64) -> int64");
    expect(closure, "x:int", "x: int64");
    const std::string tensor =
        "fn matrix(value:Tensor[float32,?,2])->Tensor[float32,?,2]:\n  value\nfn main():\n  0\n";
    expect(tensor, "matrix", "fn matrix(value: Tensor[float32, ?, 2]) -> Tensor[float32, ?, 2]");
    expect(tensor, "value\n", "value: Tensor[float32, ?, 2]");
    const std::string record =
        "type Box:\n  value:int\nfn main():\n  box=Box {value:42}\n  box.value\n";
    expect(record, "Box:", "type Box");
    expect(record, "value:int", "value: int64");
    expect(record, "box.value", "value: int64", 4);
    expect(record, "box=", "box: Box");
    const std::string strings = "fn main()->String:\n  text=\"😀```é\"\n  text\n";
    expect(strings, "\"😀", "String", 2);
    expect(strings, "text=", "text: String");
    const std::string errors =
        "error InputError:\n  Invalid\nfn checked(value:int)->int ! InputError:\n"
        "  if value==0:\n    fail InputError.Invalid\n  value\nfn main()->int:\n  checked(1) catch "
        "fn(error):0\n";
    expect(errors, "checked(value", "fn checked(value: int64) -> int64 ! InputError");
    expect(errors, "checked(1", "fn checked(value: int64) -> int64 ! InputError");
    const std::string factory =
        "error InputError:\n  Bad\nerror BuildError:\n  Bad\n"
        "fn checked(value:int)->int ! InputError:\n  value\n"
        "fn factory()->(fn(int)->int ! InputError) ! BuildError:\n  checked\nfn main():\n  0\n";
    expect(factory, "factory()", "fn factory() -> (fn(int64) -> int64 ! InputError) ! BuildError");
    const std::string unionError = "error A:\n  Bad\nerror B:\n  Bad\ntype Both=A | B\n"
                                   "fn joined()->int ! Both:\n  fail A.Bad\nfn main():\n  0\n";
    expect(unionError, "joined()", "fn joined() -> int64 ! A | B");
    const std::string pipeline = "fn twice(value:int):\n  value*2\nfn main():\n  21 -> twice\n";
    expect(pipeline, "twice\n", "fn twice(value: int64) -> int64");
    // Distinct same-spelled parameters must use semantic declaration identity.
    const std::string shadow =
        "fn first(value:int):\n  value\nfn second(value:String):\n  value\nfn main():\n  0\n";
    expect(shadow, "value:int", "value: int64");
    expect(shadow, "value:String", "value: String");
    expect(code, "int):", "int: int64");
    auto parsed = parse(std::make_shared<const SourceFile>("hover.k", code));
    require(!lsp::hoverInfo(std::move(parsed), "other.k", 3), "foreign source position matched");
    std::string large = "fn large(";
    for (unsigned i = 0; i < 3000; ++i) {
      if (i)
        large += ',';
      large += "parameter" + std::to_string(i) + ":int";
    }
    large += "):\n  0\nfn main():\n  0\n";
    require(check(parse(std::make_shared<SourceFile>("hover.k", large))).ok(),
            "large fixture is invalid");
    require(!query(large, "large("), "hover presentation size limit was bypassed");
    std::cout << "Native hover: checked values, signatures, fields, closures, shapes, errors, "
                 "literal safety, source ranges and failure isolation passed\n";
  } catch (const std::exception &e) {
    std::cerr << e.what() << '\n';
    return 1;
  }
}
