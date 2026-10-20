#pragma once
#include "kalandra/Semantics.h"
namespace kalandra::lsp {
struct HoverInfo {
  std::string text;
  std::shared_ptr<const SourceFile> source;
  SourceSpan span;
};
// Checked semantic information only. Failed graphs never supply partial/stale types.
[[nodiscard]] std::optional<HoverInfo> hoverInfo(ParseResult syntax, std::string_view path,
                                                 std::size_t offset, CheckOptions options = {});
} // namespace kalandra::lsp
