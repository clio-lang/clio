#include "kalandra/Semantics.h"
#include <iostream>
#include <span>
#include <string_view>

int main(int argc, char **argv) {
  const std::span<char *> arguments(argv, static_cast<std::size_t>(argc));
  bool dump = false;
  kalandra::CheckOptions options;
  const char *path = nullptr;
  const auto usage = [] {
    std::cerr << "usage: kalandra-check [--placement] [--dump-ir] <source.kalandra>\n";
    return 2;
  };
  for (std::size_t i = 1; i < arguments.size(); ++i) {
    const std::string_view arg = arguments[i];
    if (!path && arg == "--dump-ir" && !dump)
      dump = true;
    else if (!path && arg == "--placement" && !options.placement)
      options.placement = true;
    else if (path || arg.starts_with("--"))
      return usage();
    else
      path = arguments[i];
  }
  if (!path)
    return usage();
  auto source = kalandra::loadSource(path);
  if (!source) {
    std::cerr << path << ": " << source.error() << '\n';
    return 1;
  }
  auto result = kalandra::check(kalandra::parse(*source), {}, options);
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
