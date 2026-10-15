#include "kalandra/Semantics.h"
#include <iostream>
#include <span>
#include <string_view>

int main(int argc, char **argv) {
  const std::span<char *> arguments(argv, static_cast<std::size_t>(argc));
  const bool dump = arguments.size() == 3 && std::string_view(arguments[1]) == "--dump-ir";
  if ((!dump && arguments.size() != 2) || (arguments.size() == 3 && !dump)) {
    std::cerr << "usage: kalandra-check [--dump-ir] <source.kalandra>\n";
    return 2;
  }
  const char *path = arguments[dump ? 2 : 1];
  auto source = kalandra::loadSource(path);
  if (!source) {
    std::cerr << path << ": " << source.error() << '\n';
    return 1;
  }
  auto result = kalandra::check(kalandra::parse(*source));
  if (!result.ok()) {
    for (const auto &diagnostic : result.diagnostics)
      std::cerr << kalandra::renderDiagnostic(**source, diagnostic);
    return 1;
  }
  if (dump)
    std::cout << kalandra::dumpTypedIR(*result.module);
  else
    std::cout << "Checked " << result.module->functions.size() << " functions, "
              << result.module->expressions.size() << " typed values (no code generation)\n";
}
