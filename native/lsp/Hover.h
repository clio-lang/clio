#pragma once
#include "kalandra/Semantics.h"
namespace kalandra::lsp {
struct HoverInfo {
  std::string text;
  std::shared_ptr<const SourceFile> source;
  SourceSpan span;
};
struct SignatureInfo {
  std::string label;
  std::vector<std::string> parameters;
  std::optional<std::size_t> activeParameter;
};
// Innermost checked parenthesized call; unfinished/invalid graphs return no signature.
[[nodiscard]] std::optional<SignatureInfo> signatureInfo(ParseResult syntax, std::string_view path,
                                                         std::size_t offset,
                                                         CheckOptions options = {});
// Checked semantic information only. Failed graphs never supply partial/stale types.
[[nodiscard]] std::optional<HoverInfo> hoverInfo(ParseResult syntax, std::string_view path,
                                                 std::size_t offset, CheckOptions options = {});
} // namespace kalandra::lsp
