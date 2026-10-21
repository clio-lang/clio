#include "Signature.h"
#include <algorithm>
#include <filesystem>
namespace kalandra::lsp {
std::optional<SignatureInfo> signatureAt(const std::string &path, const std::string &text,
                                         std::size_t offset,
                                         const std::vector<ModulePackage> &packages,
                                         std::vector<SourceOverlay> overlays, CheckOptions options,
                                         const SourceGraphLoader &loader) {
  if (offset > text.size())
    return {};
  std::error_code error;
  const auto canonical = std::filesystem::weakly_canonical(path, error).string();
  if (error)
    return {};
  std::erase_if(overlays, [&](const auto &overlay) {
    std::error_code ec;
    return std::filesystem::weakly_canonical(overlay.path, ec).string() == canonical && !ec;
  });
  overlays.push_back({canonical, text});
  const auto load = [&]() {
    return loader ? loader(path, overlays) : loadModules(path, {}, {}, packages, overlays);
  };
  auto syntax = load();
  if (syntax && syntax->ok())
    return signatureInfo(std::move(*syntax), canonical, offset, options);
  // Recovery is restricted to the end of the buffer. No later source is hidden.
  const auto whitespace = [](char c) { return c == ' ' || c == '\n' || c == '\r'; };
  if (!std::ranges::all_of(std::string_view(text).substr(offset), whitespace))
    return {};
  auto source = std::make_shared<const SourceFile>(canonical, text);
  const auto tokens = lex(source);
  if (tokens.diagnostics.empty() ||
      !std::ranges::all_of(tokens.diagnostics, [](const auto &d) { return d.code == "L005"; }))
    return {};
  std::vector<TokenKind> delimiters;
  for (const auto &token : tokens.tokens) {
    if (token.kind == TokenKind::LeftParen || token.kind == TokenKind::LeftBracket ||
        token.kind == TokenKind::LeftBrace)
      delimiters.push_back(token.kind);
    else if (token.kind == TokenKind::RightParen || token.kind == TokenKind::RightBracket ||
             token.kind == TokenKind::RightBrace) {
      if (delimiters.empty())
        return {};
      delimiters.pop_back(); // Mismatches already fail the lexer gate above.
    }
  }
  if (delimiters.empty() || delimiters.size() > 8 ||
      !std::ranges::all_of(delimiters, [](auto kind) { return kind == TokenKind::LeftParen; }) ||
      text.size() > SyntaxLimits{}.maxSourceBytes - delimiters.size())
    return {};
  auto replacement = text;
  replacement.insert(offset, delimiters.size(), ')');
  overlays.back().text = std::move(replacement);
  syntax = load();
  if (!syntax || !syntax->ok())
    return {};
  return signatureInfo(std::move(*syntax), canonical, offset, options);
}
} // namespace kalandra::lsp
