#pragma once
#include "SourceGraph.h"
#include "kalandra/Semantics.h"
namespace kalandra::lsp {
struct CompletionInfo {
  SourceSpan replacement; // Original open-buffer UTF-8 range, including any identifier suffix.
  std::vector<ScopeName> names;
  bool incomplete = false;
  bool appendFieldColon = false; // Insert a separator only for a bare construction label.
};
// Temporary identifier/field probes query checked scopes and nominal members. No source writes,
// stale module, general parser recovery, auto-imports, or partial type information.
[[nodiscard]] CompletionInfo completeNames(const std::string &path, const std::string &text,
                                           std::size_t offset,
                                           const std::vector<ModulePackage> &packages = {},
                                           std::vector<SourceOverlay> overlays = {},
                                           CheckOptions options = {},
                                           const SourceGraphLoader &loader = {});
} // namespace kalandra::lsp
