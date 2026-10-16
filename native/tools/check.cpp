#include "kalandra/Continuation.h"
#include <algorithm>
#include <iostream>
#include <span>
#include <string_view>

int main(int argc, char **argv) {
  const std::span<char *> arguments(argv, static_cast<std::size_t>(argc));
  bool dump = false, dumpPlan = false;
  kalandra::CheckOptions options;
  const char *path = nullptr;
  const auto usage = [] {
    std::cerr << "usage: kalandra-check [--placement] [--dump-ir|--dump-plan] <source.kalandra>\n";
    return 2;
  };
  for (std::size_t i = 1; i < arguments.size(); ++i) {
    const std::string_view arg = arguments[i];
    if (!path && arg == "--dump-ir" && !dump && !dumpPlan)
      dump = true;
    else if (!path && arg == "--dump-plan" && !dumpPlan && !dump)
      dumpPlan = true;
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
  if (dumpPlan) {
    kalandra::continuation::Options planning;
    planning.preserveCalls = options.placement;
    if (options.placement) {
      auto main = std::ranges::find_if(result.module->functions,
                                       [](const auto &f) { return f.name == "main"; });
      if (main == result.module->functions.end()) {
        std::cerr << "placement continuation inspection requires main\n";
        return 1;
      }
      planning.entry = main - result.module->functions.begin();
    }
    auto planned = kalandra::continuation::plan(*result.module, planning);
    if (!planned) {
      std::cerr << planned.error() << '\n';
      return 1;
    }
    std::cout << kalandra::continuation::dump(*planned);
  } else if (dump)
    std::cout << kalandra::dumpTypedIR(*result.module);
  else
    std::cout << "Checked " << result.module->functions.size() << " functions, "
              << result.module->expressions.size() << " typed values (no code generation)\n";
}
