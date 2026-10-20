#pragma once
#include "kalandra/Semantics.h"
namespace kalandra::lsp {
struct CompletionInfo {
  SourceSpan replacement; // Original open-buffer UTF-8 range, including any identifier suffix.
  std::vector<ScopeName> names;
  bool incomplete = false;
};
// A temporary identifier probes the checker's actual lexical frame. No source writes,
// stale module, parser recovery, auto-imports, or partial type information.
[[nodiscard]] CompletionInfo completeNames(const std::string &path, const std::string &text,
                                           std::size_t offset,
                                           const std::vector<ModulePackage> &packages = {},
                                           std::vector<SourceOverlay> overlays = {},
                                           CheckOptions options = {});
} // namespace kalandra::lsp
