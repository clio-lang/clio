#include "kalandra/Backend.h"
#include "kalandra/StringLiteral.h"
#include <iostream>
#include <stdexcept>
using namespace kalandra;
static void require(bool ok, const char *message) {
  if (!ok)
    throw std::runtime_error(message);
}
static CheckResult analyze(const std::string &text) {
  return check(parse(std::make_shared<SourceFile>("string.kalandra", text)));
}
int main() {
  try {
    for (const auto *source :
         {"fn main()->String:\n  \"\"\n", "fn main():\n  text:String=\"hello\"\n  text\n",
          "fn pass(x:String)->String:\n  x\nfn main()->String:\n  pass(\"سلام\\0👩\\u{200d}💻\")\n",
          "fn choose(flag:Bool,a:String,b:String)->String:\n  if flag:\n    a\n  else:\n    b\nfn "
          "main()->String:\n  choose(true,\"é\",\"é\")\n",
          "fn main()->Bool:\n  ignored=\"hello\"\n  true\n",
          "fn main()->[int64]:\n  ignored=\"hello\"\n  [1,2]\n"}) {
      auto result = analyze(source);
      if (!result.ok())
        for (const auto &d : result.diagnostics)
          std::cerr << renderDiagnostic(*result.source, d);
      require(result.ok(), "valid String source rejected");
#ifndef KALANDRA_STRING_FRONTEND_ONLY
      require(bool(lowerNative(*result.module)), "String lowering failed");
#endif
      require(bool(numericCapabilityError(*result.module, NumericTarget::AppleGpu)),
              "GPU String admitted");
    }
    for (const auto *source :
         {"fn main()->String:\n  1\n", "fn main()->int64:\n  \"1\"\n",
          "fn f(x:String)->String:\n  x\nfn main()->String:\n  f(true)\n",
          "fn main()->[String]:\n  [\"a\"]\n", "type A:\n  text:String\nfn main()->int64:\n  1\n",
          "fn main()->String:\n  \"a\"[0]\n", "fn main()->[String]:\n  [1,2]->map(fn(x): \"a\")\n",
          "fn f()->String:\n  \"a\"\nfn main()->String ! TaskError:\n  try parallel:\n    try "
          "await spawn f()\n",
          "fn helper()->int64:\n  1\nfn main()->int64 ! TaskError:\n  ignored=\"a\"\n  try "
          "parallel:\n    try await spawn helper()\n"})
      require(!analyze(source).ok(), "unsupported String source admitted");
    for (const auto *source :
         {"fn main()->String:\n  \"a\"+\"b\"\n",
          "fn eq(a:String,b:String)->Bool:\n  a==b\nfn main()->Bool:\n  eq(\"é\",\"e\\u{301}\")\n",
          "fn main()->Bool:\n  \"a\"!=\"b\" and \"x\"+\"y\"==\"xy\"\n",
          "fn same(x:int64)->Bool:\n  \"a\"+\"b\"==\"ab\"\nfn main():\n  [1,2]->map(same)\n"}) {
      auto value = analyze(source);
      if (!value.ok())
        for (const auto &d : value.diagnostics)
          std::cerr << renderDiagnostic(*value.source, d);
      require(value.ok(), "valid String operation rejected");
#ifndef KALANDRA_STRING_FRONTEND_ONLY
      require(bool(lowerNative(*value.module)), "String operation lowering failed");
#endif
    }
    for (const auto *source :
         {"fn main():\n  \"a\"+1\n", "fn main():\n  1+\"a\"\n", "fn main():\n  \"a\"-\"b\"\n",
          "fn main():\n  \"a\"<\"b\"\n", "fn main():\n  \"a\"==true\n", "fn main():\n  \"a\"!=1\n",
          "fn task()->int64 ! TaskError:\n  fail 1\nfn main()->Bool:\n  task() catch fn(error): "
          "error.message==error.message\n"})
      require(!analyze(source).ok(), "invalid or borrowed-diagnostic String operation admitted");
#ifndef KALANDRA_STRING_FRONTEND_ONLY
    for (unsigned mode = 0; mode < 4; ++mode) {
      auto value = analyze("fn main():\n  \"a\"+\"b\"\n");
      for (auto &expr : value.module->expressions)
        if (auto *concat = std::get_if<StringConcat>(&expr.operation)) {
          if (mode == 0)
            expr.type.builtin = BuiltinValue::Bool;
          if (mode == 1)
            concat->left = value.module->expressions.size();
          if (mode == 2)
            value.module->expressions[concat->left].type.builtin = BuiltinValue::Numeric;
          if (mode == 3)
            expr.type.task = true;
        }
      require(!lowerNative(*value.module), "forged String concat admitted");
    }
    auto order = analyze("fn main():\n  \"a\"==\"b\"\n");
    for (auto &expr : order.module->expressions)
      if (auto *cmp = std::get_if<ScalarCompare>(&expr.operation))
        cmp->operation = ComparisonKind::Less;
    require(!lowerNative(*order.module), "forged String ordering admitted");
#endif
    auto diagnostic = analyze(
        "fn task()->Bool ! TaskError:\n  true\nfn main()->Bool:\n  task() catch fn(error):\n    "
        "match error:\n      TaskError.Fault { message }: message==message\n      _: false\n");
    require(!diagnostic.ok(), "borrowed diagnostic equality admitted");
    bool gated = false;
    for (const auto &d : diagnostic.diagnostics)
      gated |= d.code == "S054";
    require(gated, "borrowed diagnostic equality did not reach the ordinary-String gate");
    for (const auto *source :
         {"fn size(value:String)->int64:\n  length(value)+byteLength(value)\nfn main():\n  "
          "size(\"👩‍💻\")\n",
          "fn main():\n  \"سلام\" -> length\n", "fn main():\n  \"سلام\" -> byteLength\n",
          "fn count(value:int64)->int64:\n  value+length(\"é\")\nfn main():\n  "
          "[1,2]->map(count)\n"}) {
      auto value = analyze(source);
      require(value.ok(), "valid String length rejected");
#ifndef KALANDRA_STRING_FRONTEND_ONLY
      require(bool(lowerNative(*value.module)), "String length lowering failed");
#endif
    }
    for (const auto *source :
         {"fn main():\n  length()\n", "fn main():\n  length(\"a\",\"b\")\n",
          "fn main():\n  byteLength()\n", "fn main():\n  byteLength(\"a\",\"b\")\n",
          "fn main():\n  byteLength([1,2])\n", "fn main():\n  byteLength(3)\n",
          "fn main():\n  byteLength(true)\n", "fn main():\n  byteLength(tensor([1,2]))\n",
          "fn main():\n  shape(\"a\")\n", "fn main()->int32:\n  length(\"a\")\n",
          "fn main()->Bool:\n  byteLength(\"a\")\n",
          "fn main() ! TaskError:\n  try parallel:\n    try await spawn length(\"a\")\n"})
      require(!analyze(source).ok(), "invalid String length type, arity or worker admitted");
    for (const auto *query : {"length", "byteLength"}) {
      auto value = analyze("fn task()->int64 ! TaskError:\n  1\nfn main()->int64:\n  task() catch "
                           "fn(error):\n    match error:\n      TaskError.Fault { message }: " +
                           std::string(query) + "(message)\n      _: 0\n");
      bool gated = false;
      for (const auto &d : value.diagnostics)
        gated |= d.code == "S054";
      require(!value.ok() && gated, "borrowed diagnostic length bypassed ordinary String gate");
    }
#ifndef KALANDRA_STRING_FRONTEND_ONLY
    for (unsigned mode = 0; mode < 6; ++mode) {
      auto value = analyze("fn main():\n  length(\"é\")\n");
      for (auto &expr : value.module->expressions)
        if (auto *q = std::get_if<StringQuery>(&expr.operation)) {
          if (mode == 0)
            q->input = value.module->expressions.size();
          if (mode == 1)
            q->kind = static_cast<StringQueryKind>(99);
          if (mode == 2)
            expr.type.element = NumericType::UInt64;
          if (mode == 3)
            expr.type.builtin = BuiltinValue::Bool;
          if (mode == 4)
            expr.type.tensor = true;
          if (mode == 5)
            value.module->expressions[q->input].type.task = true;
        }
      require(!lowerNative(*value.module), "forged String length admitted");
    }
#endif
    for (const auto *source : {"fn String()->int64:\n  1\n", "fn main():\n  [\"a\",\"b\"]\n",
                               "fn main():\n  [1,2]->map(fn(x): \"a\")\n",
                               "fn main():\n  text=\"a\"\n  [1,2]->map(fn(x): text)\n"})
      require(!analyze(source).ok(), "String compound/capture or builtin name admitted");
    require(!analyze("fn main()->String:\n  \"" + std::string(4097, 'a') + "\"\n").ok(),
            "oversized literal admitted");
#ifndef KALANDRA_STRING_FRONTEND_ONLY
    for (unsigned mode = 0; mode < 5; ++mode) {
      auto value = analyze("fn main()->String:\n  \"hello\"\n");
      auto &expr = value.module->expressions.front();
      if (mode == 0)
        expr.type.builtin = BuiltinValue::Bool;
      if (mode == 1)
        std::get<StringLiteral>(expr.operation).value = std::string(1, char(0x80));
      if (mode == 2)
        expr.type.tensor = true;
      if (mode == 3)
        expr.type.task = true;
      if (mode == 4)
        expr.type.device = 0;
      require(!lowerNative(*value.module), "forged String IR admitted");
    }
#endif
    std::cout << "String source typing, helpers, conditionals, unsupported operations and IR gates "
                 "passed\n";
  } catch (const std::exception &e) {
    std::cerr << e.what() << '\n';
    return 1;
  }
}
