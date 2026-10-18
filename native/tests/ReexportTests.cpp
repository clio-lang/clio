#include "kalandra/Backend.h"
#include "kalandra/Continuation.h"
#include <filesystem>
#include <fstream>
#include <iostream>
#include <stdexcept>
using namespace kalandra;
namespace fs = std::filesystem;
static fs::path root;
static void require(bool ok, const std::string &message) {
  if (!ok)
    throw std::runtime_error(message);
}
static void write(const std::string &file, const std::string &text) {
  std::ofstream out(root / file);
  out << text;
  out.close();
  require(bool(out), "write failed");
}
static CheckResult analyze(const std::string &text, SemanticLimits limits = {}) {
  write("main.kalandra", text);
  auto loaded = loadModules((root / "main.kalandra").string());
  require(bool(loaded), "loader failed");
  return check(std::move(*loaded), limits);
}
int main(int argc, char **argv) {
  if (argc != 2)
    return 2;
  try {
    root = fs::absolute(argv[1]);
    fs::create_directories(root);
    write("core.kalandra", "export type Row:\n  names:[String]\n  value:int64\ntype Secret:\n  "
                           "flag:Bool\nfn helper(n:int64)->int64:\n  n+1\nexport fn make()->Row:\n "
                           " Row {names:[\"é\"],value:2}\nexport fn step(row:Row)->Row:\n  row "
                           "with {value:helper(row.value)}\n");
    write("facade.kalandra",
          "export from \"./core.kalandra\" import Row as Item, make as create, step as advance\n");
    write("public.kalandra",
          "export from \"./facade.kalandra\" import Item as Entry, create, advance\n");
    write("private.kalandra", "from \"./core.kalandra\" import Row as Item, make\n");
    write("other.kalandra", "export type Row:\n  names:[String]\n  value:int64\n");
    const std::string imports = "from \"./public.kalandra\" import Entry, create, advance\nfrom "
                                "\"./core.kalandra\" import Row\n";
    auto good = analyze(
        imports + "fn local(value:Entry)->Row:\n  advance(value)\nfn main()->int64 ! TaskError:\n  "
                  "changed=try parallel:\n    work=spawn local(create())\n    first=try await "
                  "work\n    again=try await work\n    again\n  changed.value\n");
    if (!good.ok())
      for (const auto &d : good.diagnostics)
        std::cerr << renderDiagnostic(*good.source, d);
    require(good.ok() && good.module->records.size() == 2 && good.module->functions.size() == 5,
            "reexports changed nominal/function identity");
    require(bool(continuation::plan(*good.module)), "reexport planning failed");
#ifndef KALANDRA_REEXPORT_FRONTEND_ONLY
    auto lowered = lowerNative(*good.module);
    require(bool(lowered), lowered ? "" : lowered.error());
#endif
    auto constructors =
        analyze("from \"./public.kalandra\" import Entry\nexport type Box:\n  row:Entry\nfn "
                "main()->[String]:\n  Box {row:Entry {names:[\"kept\"],value:4}}.row.names\n");
    require(constructors.ok(), "reexported constructors/fields rejected");
    for (const auto &source :
         {"from \"./facade.kalandra\" import Row\nfn main():\n  0\n",
          "from \"./private.kalandra\" import Item\nfn main():\n  0\n",
          "from \"./private.kalandra\" import make\nfn main():\n  0\n",
          "export from \"./core.kalandra\" import Secret\nfn main():\n  0\n",
          "export from \"./core.kalandra\" import helper\nfn main():\n  0\n",
          "export from \"./core.kalandra\" import missing\nfn main():\n  0\n",
          "export from \"./core.kalandra\" import Row, Row\nfn main():\n  0\n",
          "export from \"./core.kalandra\" import make, make\nfn main():\n  0\n",
          "export from \"./core.kalandra\" import Row as Name, make as Name\nfn main():\n  0\n",
          "export from \"./core.kalandra\" import make as Name, Row as Name\nfn main():\n  0\n",
          "export from \"./core.kalandra\" import Row\ntype Row:\n  value:int\nfn main():\n  0\n",
          "export from \"./core.kalandra\" import make\nfn make():\n  0\nfn main():\n  0\n",
          "export from \"./core.kalandra\" import Row as int64\nfn main():\n  0\n",
          "export from \"./core.kalandra\" import make as Bool\nfn main():\n  0\n",
          "from \"./public.kalandra\" import Entry, create\nfrom \"./other.kalandra\" import "
          "Row\nfn accept(value:Row)->Row:\n  value\nfn main():\n  accept(create()).value\n"})
      require(!analyze(source).ok(), "invalid/private/colliding reexport admitted");
    auto local = analyze("type Box:\n  row:Entry\nexport from \"./public.kalandra\" import Entry, "
                         "create, advance\nfn main():\n  Box {row:advance(create())}.row.value\n");
    require(local.ok(), "local reexport use or order-independent field lookup failed");
    write("entry.kalandra", "export fn main():\n  7\n");
    write("entry-public.kalandra", "export from \"./entry.kalandra\" import main\n");
    auto noEntry = analyze("from \"./entry-public.kalandra\" import main\n");
    require(noEntry.ok(), "reexport-only entry fixture rejected");
#ifndef KALANDRA_REEXPORT_FRONTEND_ONLY
    require(!lowerNative(*noEntry.module), "reexported dependency main became program entry");
#endif
    auto placed = loadModules((root / "main.kalandra").string());
    require(bool(placed) && !check(std::move(*placed), {}, {.placement = true}).ok(),
            "reexports enabled GPU modules silently");
    // A diamond through two public facades still ends at one original declaration.
    write("second.kalandra",
          "export from \"./core.kalandra\" import Row as Other, make as build\n");
    auto diamond =
        analyze("from \"./second.kalandra\" import Other, build\nfrom \"./public.kalandra\" import "
                "Entry\nfn same(row:Other)->Entry:\n  row\nfn main():\n  same(build()).value\n");
    require(diamond.ok() && diamond.module->records.size() == 2, "diamond cloned original type");
    write("cycle.kalandra", "export from \"./main.kalandra\" import main\n");
    require(!analyze("export from \"./cycle.kalandra\" import main\n").ok(),
            "reexport cycle admitted");
    for (const auto &text : {"export from \"./core.kalandra\" import\n",
                             "export from \"./core.kalandra\" import make as\n",
                             "export from \"./core.kalandra\" import make,\n"})
      require(!parse(std::make_shared<SourceFile>("bad.kalandra", text)).ok(),
              "malformed reexport parsed");
    auto parsed = parse(std::make_shared<SourceFile>(
        "memory.kalandra", "export from \"./core.kalandra\" import Row\n"));
    require(parsed.ok() && parsed.module.imports[0].exported, "export import flag lost");
    require(!check(std::move(parsed)).ok(), "unloaded reexport admitted");
    // Even a forged cyclic graph must stop rather than recurse indefinitely.
    auto forged = parse(std::make_shared<SourceFile>(
        "cycle.kalandra", "export from \"./self.kalandra\" import X\nfn main():\n  0\n"));
    forged.module.imports[0].target = 0;
    require(!check(std::move(forged)).ok(), "forged reexport cycle admitted");
    std::cout << "reexports: functions/types/aliases, nominal identity, local helper scope, "
                 "collisions, privacy, diamonds and bounded cycles passed\n";
  } catch (const std::exception &e) {
    std::cerr << e.what() << '\n';
    return 1;
  }
}
