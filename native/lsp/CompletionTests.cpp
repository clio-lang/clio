#include "Completion.h"
#include <filesystem>
#include <iostream>
#include <stdexcept>
using namespace kalandra;
static void require(bool value, const std::string &message) {
  if (!value)
    throw std::runtime_error(message);
}
static lsp::CompletionInfo query(std::string text) {
  const auto cursor = text.find('|');
  require(cursor != text.npos, "missing cursor");
  text.erase(cursor, 1);
  return lsp::completeNames((std::filesystem::temp_directory_path() / "completion.k").string(),
                            text, cursor);
}
static bool has(const lsp::CompletionInfo &info, const std::string &name) {
  for (const auto &item : info.names)
    if (item.name == name)
      return true;
  return false;
}
int main() {
  try {
    auto info = query("fn main():\n  earlier = 2\n  ear|ly\n  later = 3\n  later\n");
    require(has(info, "earlier") && info.names.size() == 1, "partial prefix and suffix");
    require(info.replacement.end - info.replacement.begin == 5, "whole identifier replacement");
    info = query(
        "fn helper(value:int):\n  value\nfn main():\n  earlier = 2\n  |\n  later = 3\n  later\n");
    require(has(info, "earlier") && has(info, "helper") && !has(info, "later"), "binding order");
    info = query("fn helper(value:int):\n  val|\nfn main():\n  0\n");
    require(has(info, "value") && info.names[0].kind == ScopeNameKind::Parameter, "parameter");
    info = query("fn helper(value:int):\n  value\nfn main():\n  hel|(2)\n");
    require(has(info, "helper"), "call callee");
    info = query("fn helper(value:int):\n  value\nfn main():\n  2 -> hel|\n");
    require(has(info, "helper"), "pipeline callee");
    info =
        query("fn main():\n  earlier = 1\n  values = [1, 2]\n  map(values, fn(value:int): ear|)\n");
    require(has(info, "earlier"), "lambda captures");
    info = query(
        "fn main():\n  visible = 1\n  if true:\n    hidden = 1\n    hidden\n  else:\n    |\n");
    require(has(info, "visible") && !has(info, "hidden"), "branch isolation");
    info = query("fn helper(value:int):\n  value\nfn main():\n  map([1,2], hel|)\n");
    require(has(info, "helper"), "named map callback");
    info = query("fn helper(value:int):\n  value\nfn main():\n  helper = 2\n  hel|\n");
    require(info.names.size() == 1 && info.names[0].kind == ScopeNameKind::Variable,
            "local shadows function");
    info = query("fn main():\n  value = 1\n  map([1,2], fn(value:int): val|)\n");
    require(info.names.size() == 1 && info.names[0].kind == ScopeNameKind::Parameter,
            "lambda parameter shadows capture");
    info = query("enum Choice:\n  Some:\n    value:int\n  Other\nfn inspect(choice:Choice):\n"
                 "  match choice:\n    Choice.Some {value:item}:\n      ite|\n"
                 "    Choice.Other: 0\nfn main():\n  0\n");
    require(has(info, "item"), "match binding");
    info = query("fn main():\n  parallel:\n    available = 1\n    av|\n");
    require(has(info, "available"), "parallel suite");
    info = query("type Point:\n  value:int\nfn main():\n  Poi|\n");
    require(info.names.size() == 1 && info.names[0].kind == ScopeNameKind::Type,
            "nominal constructor name");
    const std::string broken = "fn main():\n  earlier=1\n  missing\n";
    const auto site = broken.find("missing");
    ScopeCompletion scope{{site, site + 7}, "ear", {}, false, false};
    auto checked =
        check(parse(std::make_shared<const SourceFile>("scope.k", broken)), {}, {false, &scope});
    require(!checked.module && scope.reached && scope.names.size() == 1,
            "scope names must not publish partial IR");
    info = query("fn main():\n  broken = unknown\n  bro|\n");
    require(info.names.empty(), "prior errors fail closed");
    require(query("fn main():\n  value = 1\n  \"val|\"\n").names.empty(), "string position");
    require(query("fn main():\n  value = 1\n  # val|\n  value\n").names.empty(),
            "comment position");
    require(query("fn main():\n  value = 1\n  value.val|\n").names.empty(), "member not lexical");
    info = query("type Point:\n  x:int\n  y:int\nfn main():\n  p=Point {x:1,y:2}\n  p.|\n");
    require(info.names.size() == 2 && info.names[0].name == "x" && info.names[1].name == "y" &&
                info.names[0].kind == ScopeNameKind::Field,
            "completed record fields at a dot");
    info = query("type Box:\n  value:int\nfn main():\n  b=Box {value:1}\n  b.val|ue\n");
    require(info.names.size() == 1 && has(info, "value") &&
                info.replacement.end - info.replacement.begin == 5,
            "member prefix replaces whole suffix");
    info = query("type Inner:\n  value:int\ntype Outer:\n  inner:Inner\n"
                 "fn main():\n  o=Outer {inner:Inner {value:1}}\n  o.inner.|\n");
    require(info.names.size() == 1 && has(info, "value"), "nested receiver");
    info = query("type Box:\n  value:int\nfn make():\n  Box {value:1}\nfn main():\n  make().|\n");
    require(info.names.size() == 1 && has(info, "value"), "call result receiver");
    info = query("type Box:\n  value:int\nfn main():\n  boxes=[Box {value:1}]\n  boxes[0].|\n");
    require(info.names.size() == 1 && has(info, "value"), "indexed record receiver");
    info = query("type Box:\n  value:int\nfn inspect(b:Box):\n  map([1],fn(item:int):b.|)\nfn "
                 "main():\n  0\n");
    require(info.names.size() == 1 && has(info, "value"), "captured record receiver");
    require(
        query("type Box:\n  value:int\nfn main():\n  b=Box {value:1}\n  broken=unknown\n  b.|\n")
            .names.empty(),
        "prior errors block member names");
    require(query("type Box:\n  value:int\nfn main():\n  b=Box {value:1}\n  b.missing.|\n")
                .names.empty(),
            "invalid receiver chain fails closed");
    require(query("enum Choice:\n  Some:\n    value:int\n  Other\nfn inspect(c:Choice):\n  c.|\nfn "
                  "main():\n  0\n")
                .names.empty(),
            "unmatched enum payloads stay hidden");
    // A requested member snapshot still never publishes partial typed IR.
    const std::string member =
        "type Box:\n  value:int\nfn main():\n  b=Box {value:1}\n  b.missing\n";
    const auto memberSite = member.find("missing");
    ScopeCompletion members{{memberSite, memberSite + 7}, "", {}, false, false};
    auto failed = check(parse(std::make_shared<const SourceFile>("members.k", member)), {},
                        {false, &members});
    require(!failed.module && members.reached && members.names.size() == 1 &&
                members.names[0].kind == ScopeNameKind::Field,
            "member names do not expose partial IR");
    require(query("fn main():\n  missing(|\n").names.empty(), "no parser recovery");
    std::string many = "fn main():\n";
    for (int i = 0; i < 300; ++i)
      many += "  candidate" + std::to_string(i) + " = 1\n";
    info = query(many + "  can|\n");
    require(info.names.size() == 256 && info.incomplete, "bounded list");
    info = query(many + "  candidate29|\n");
    require(info.names.size() == 11 && !info.incomplete, "narrowed list");
    std::string record = "type Many:\n";
    for (int i = 0; i < 300; ++i)
      record += "  candidate" + std::to_string(i) + ":int\n";
    info = query(record + "fn inspect(value:Many):\n  value.can|\nfn main():\n  0\n");
    require(info.names.size() == 256 && info.incomplete, "bounded record fields");
    info = query(record + "fn inspect(value:Many):\n  value.candidate29|\nfn main():\n  0\n");
    require(info.names.size() == 11 && !info.incomplete, "narrowed record fields");
    std::cout << "Native scope completion passed\n";
  } catch (const std::exception &error) {
    std::cerr << error.what() << '\n';
    return 1;
  }
}
