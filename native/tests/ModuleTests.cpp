#include "kalandra/Backend.h"
#include "kalandra/Continuation.h"
#include <filesystem>
#include <fstream>
#include <iostream>
#include <stdexcept>
using namespace kalandra;
namespace fs = std::filesystem;
static void require(bool ok, const std::string &message) {
  if (!ok)
    throw std::runtime_error(message);
}
static fs::path root;
static void write(const std::string &name, const std::string &text) {
  fs::create_directories((root / name).parent_path());
  std::ofstream stream(root / name);
  stream << text;
  stream.close();
  require(bool(stream), "cannot write test source");
}
static CheckResult analyze(const std::string &name = "main.kalandra", SyntaxLimits syntax = {},
                           ModuleLimits modules = {}) {
  auto loaded = loadModules((root / name).string(), syntax, modules);
  require(bool(loaded), "module loader failed without diagnostics");
  return check(std::move(*loaded));
}
static void reject(const std::string &code, const std::string &file = "main.kalandra") {
  auto result = analyze(file);
  require(!result.ok(), "invalid module graph admitted");
  bool found = false;
  for (const auto &diagnostic : result.diagnostics)
    found |= diagnostic.code == code;
  require(found, "expected module diagnostic " + code);
}
int main(int argc, char **argv) {
  if (argc != 2)
    return 2;
  root = fs::absolute(argv[1]);
  try {
    write("lib/numbers.kalandra",
          "fn helper(value:int):\n  value*2\nexport fn double(value:int):\n  helper(value)\n");
    write("lib/math.kalandra", "from \"./numbers.kalandra\" import double as twice\n"
                               "fn helper(value:int):\n  value+1\nexport fn total(value:int):\n  "
                               "twice(value)+helper(value)\n");
    write("main.kalandra",
          "from \"./lib/math.kalandra\" import total\n"
          "from \"./lib/numbers.kalandra\" import double as twice, double as other\n"
          "fn helper(value:int):\n  value+100\nfn main():\n"
          "  values=map([1,2],twice)\n"
          "  captured=map(values,fn(x):other(x)+total(x))\n"
          "  captured[0]+captured[1]+helper(3)\n");
    auto loaded = loadModules((root / "main.kalandra").string());
    require(bool(loaded) && loaded->ok() && loaded->module.source->parts().size() == 3 &&
                loaded->module.functions.size() == 6,
            "shared dependency was duplicated");
    auto typed = analyze();
    require(typed.ok(), "valid module graph failed checking");
    require(bool(continuation::plan(*typed.module)),
            "imported callbacks failed continuation planning");
#ifndef KALANDRA_MODULE_FRONTEND_ONLY
    auto lowered = lowerNative(*typed.module);
    require(bool(lowered), lowered ? "" : lowered.error());
    require(lowered->mlir.find((root / "lib/numbers.kalandra").string()) != std::string::npos,
            "MLIR lost original module file location");
#endif
    // Canonical identity deduplicates symlink spellings as well as diamonds.
    std::error_code error;
    fs::remove(root / "alias.kalandra", error);
    fs::create_symlink(root / "lib/numbers.kalandra", root / "alias.kalandra");
    write("alias-main.kalandra",
          "from \"./alias.kalandra\" import double as a\n"
          "from \"./lib/numbers.kalandra\" import double as b\nfn main():\n  a(1)+b(2)\n");
    auto aliased = loadModules((root / "alias-main.kalandra").string());
    require(bool(aliased) && aliased->ok() && aliased->module.source->parts().size() == 2,
            "canonical source identity lost");
    require(check(std::move(*aliased)).ok(), "symlink aliases failed checking");
    write("nested/parent-main.kalandra",
          "from \"../lib/numbers.kalandra\" import double\nfn main():\n  double(3)\n");
    require(analyze("nested/parent-main.kalandra").ok(), "parent-relative module path failed");
    write("café.kalandra", "export fn increment(value:int):\n  value+1\n");
    write("unicode-main.kalandra",
          "from \"./café.kalandra\" import increment\nfn main():\n  increment(1)\n");
    require(analyze("unicode-main.kalandra").ok(), "UTF-8 module path failed");
    for (auto limits : {ModuleLimits{1, 32}, ModuleLimits{128, 0}}) {
      auto limited = analyze("main.kalandra", {}, limits);
      require(!limited.ok() && limited.diagnostics[0].code == "M004",
              "module graph limit bypassed");
    }
    SyntaxLimits syntax;
    syntax.maxSourceBytes = 20;
    require(!analyze("main.kalandra", syntax).ok(), "module byte limit bypassed");
    syntax = {};
    syntax.maxTokens = 140;
    for (auto file : {"main.kalandra", "lib/math.kalandra", "lib/numbers.kalandra"}) {
      auto single = loadSource((root / file).string());
      require(bool(single) && parse(*single, syntax).ok(),
              "token-limit fixture exceeds per-file limit");
    }
    require(!analyze("main.kalandra", syntax).ok(), "aggregate token limit bypassed");
    // Cached subgraphs must still respect depth through a longer diamond path.
    write("shared-leaf.kalandra", "export fn leaf():\n  1\n");
    write("shared.kalandra",
          "from \"./shared-leaf.kalandra\" import leaf\nexport fn shared():\n  leaf()\n");
    write("deep.kalandra",
          "from \"./shared.kalandra\" import shared\nexport fn deep():\n  shared()\n");
    write("deep-main.kalandra", "from \"./shared.kalandra\" import shared\nfrom "
                                "\"./deep.kalandra\" import deep\nfn main():\n  deep()\n");
    require(!analyze("deep-main.kalandra", {}, {128, 2}).ok(),
            "cached subgraph bypassed depth bound");
    write("bad-private.kalandra",
          "from \"./lib/numbers.kalandra\" import helper\nfn main():\n  helper(1)\n");
    reject("S067", "bad-private.kalandra");
    write("bad-leak.kalandra",
          "from \"./lib/numbers.kalandra\" import double\nfn main():\n  helper(1)\n");
    reject("S031", "bad-leak.kalandra");
    for (auto imports : {"double, double", "double as a, double as a", "double as int", "missing",
                         "double as main"}) {
      write("bad-binding.kalandra", "from \"./lib/numbers.kalandra\" import " +
                                        std::string(imports) + "\nfn main():\n  1\n");
      require(!analyze("bad-binding.kalandra").ok(), "invalid import binding admitted");
    }
    write("reexport.kalandra", "from \"./lib/numbers.kalandra\" import double\n");
    write("bad-reexport.kalandra",
          "from \"./reexport.kalandra\" import double\nfn main():\n  double(1)\n");
    reject("S067", "bad-reexport.kalandra");
    write("bad-type.kalandra",
          "from \"./lib/numbers.kalandra\" import double\nfn main():\n  double(float32(1))\n");
    reject("S010", "bad-type.kalandra");
    write("shape-library.kalandra",
          "export fn four(values:Tensor[int,2,2]):\n  reduceSum(values)\n");
    write("bad-shape.kalandra",
          "from \"./shape-library.kalandra\" import four\nfn main():\n  four(tensor([[1,2,3]]))\n");
    reject("S011", "bad-shape.kalandra");
    write("broken.kalandra", "export fn bad(value:int):\n  missing(value)\n");
    write("bad-diagnostic.kalandra",
          "from \"./broken.kalandra\" import bad\nfn main():\n  bad(1)\n");
    auto broken = analyze("bad-diagnostic.kalandra");
    require(!broken.ok(), "broken dependency admitted");
    auto rendered = renderDiagnostic(*broken.source, broken.diagnostics[0]);
    require(rendered.find((root / "broken.kalandra").string() + ":2:3:") != std::string::npos &&
                rendered.find("missing(value)") != std::string::npos,
            "dependency semantic diagnostic lost original file/line/excerpt");
    write("broken.kalandra", "export fn bad(value:int):\n  tensor([1,2)\n");
    auto parseFailure = analyze("bad-diagnostic.kalandra");
    require(!parseFailure.ok() &&
                renderDiagnostic(*parseFailure.source, parseFailure.diagnostics[0])
                        .find((root / "broken.kalandra").string() + ":2:") != std::string::npos,
            "dependency syntax diagnostic lost original file");
    for (auto path :
         {"numbers.kalandra", "/tmp/numbers.kalandra", "./numbers", "./bad\\t.kalandra"}) {
      write("bad-path.kalandra",
            "from \"" + std::string(path) + "\" import double\nfn main():\n  0\n");
      reject("M001", "bad-path.kalandra");
    }
    write("missing.kalandra", "from \"./absent.kalandra\" import double\nfn main():\n  0\n");
    reject("M002", "missing.kalandra");
    write("cycle-a.kalandra", "from \"./cycle-b.kalandra\" import b\nexport fn a():\n  1\n");
    write("cycle-b.kalandra", "from \"./cycle-a.kalandra\" import a\nexport fn b():\n  2\n");
    reject("M003", "cycle-a.kalandra");
    fs::remove(root / "self-alias.kalandra", error);
    fs::create_symlink(root / "self.kalandra", root / "self-alias.kalandra");
    write("self.kalandra", "from \"./self-alias.kalandra\" import main\nexport fn main():\n  1\n");
    reject("M003", "self.kalandra");
    auto unresolved = check(parse(std::make_shared<SourceFile>(
        "memory.kalandra", "from \"./math.kalandra\" import double\nfn main():\n  0\n")));
    require(!unresolved.ok() && unresolved.diagnostics[0].code == "S067",
            "unresolved imports bypassed module loader");
    auto placed = loadModules((root / "main.kalandra").string());
    require(bool(placed) && !check(std::move(*placed), {}, {.placement = true}).ok(),
            "CPU module support silently enabled for placement compiler");
    write("library-main.kalandra", "export fn main():\n  7\n");
    write("no-entry.kalandra", "from \"./library-main.kalandra\" import main as importedMain\n");
    auto noEntry = analyze("no-entry.kalandra");
    require(noEntry.ok(), "import-only module rejected");
#ifndef KALANDRA_MODULE_FRONTEND_ONLY
    require(!lowerNative(*noEntry.module), "imported main became program entry");
#endif
    // Standalone exports keep existing source offsets and work without a loader.
    require(check(parse(std::make_shared<SourceFile>("standalone.kalandra",
                                                     "export fn main():\n  1\n")))
                .ok(),
            "standalone export rejected");
    for (auto source : {"from \"./x.kalandra\" import\n", "from \"./x.kalandra\" import x as\n",
                        "from \"./x.kalandra\" import x,\n", "export type Point\n  x:int\n"})
      require(!parse(std::make_shared<SourceFile>("invalid.kalandra", source)).ok(),
              "malformed import/export syntax accepted");
    std::cout << "modules: named exports/import aliases, scoped callbacks/helpers, canonical "
                 "diamond/symlink identity, graph limits, cycles, private names, exact types, "
                 "original source diagnostics, placement gate and entry isolation passed\n";
  } catch (const std::exception &error) {
    std::cerr << error.what() << '\n';
    return 1;
  }
}
