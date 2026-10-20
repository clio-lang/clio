#include "Completion.h"
#include <algorithm>
#include <filesystem>
namespace kalandra::lsp {
CompletionInfo completeNames(const std::string &path, const std::string &text, std::size_t offset,
                             const std::vector<ModulePackage> &packages,
                             std::vector<SourceOverlay> overlays, CheckOptions options) {
  CompletionInfo result{{offset, offset}, {}, false};
  if (offset > text.size())
    return result;
  std::error_code error;
  const auto canonical = std::filesystem::weakly_canonical(path, error).string();
  if (error)
    return result;
  auto source = std::make_shared<const SourceFile>(canonical, text);
  const auto tokens = lex(source);
  if (!tokens.diagnostics.empty())
    return result;
  for (const auto &token : tokens.tokens) {
    if (token.kind == TokenKind::Identifier && token.span.begin <= offset &&
        offset <= token.span.end) {
      result.replacement = token.span;
      break;
    }
    if (token.span.begin <= offset && offset < token.span.end &&
        (token.kind == TokenKind::String || token.kind == TokenKind::Number))
      return result;
  }
  const auto prefix = text.substr(result.replacement.begin, offset - result.replacement.begin);
  constexpr std::string_view probe = "__kalandra_completion_probe";
  if (text.size() - (result.replacement.end - result.replacement.begin) + probe.size() >
      SyntaxLimits{}.maxSourceBytes)
    return result;
  auto replacement = text;
  replacement.replace(result.replacement.begin, result.replacement.end - result.replacement.begin,
                      probe);
  std::erase_if(overlays, [&](const auto &entry) {
    std::error_code ec;
    return std::filesystem::weakly_canonical(entry.path, ec).string() == canonical && !ec;
  });
  overlays.push_back({canonical, std::move(replacement)});
  auto syntax = loadModules(path, {}, {}, packages, overlays);
  if (!syntax || !syntax->ok())
    return result;
  // Locate the probe through original-file identities so this does not depend
  // on how the module loader arranges the composed source.
  std::optional<SourceSpan> site;
  for (const auto &expression : syntax->module.expressions)
    if (const auto *name = std::get_if<NameExpr>(&expression.value)) {
      const auto [original, local] = syntax->module.source->origin(name->name.begin);
      if (original->path() == canonical && local == result.replacement.begin &&
          syntax->module.source->slice(name->name) == probe) {
        site = name->name;
        break;
      }
    }
  if (!site)
    return result;
  ScopeCompletion query{*site, prefix, {}, false, false};
  options.completion = &query;
  (void)check(std::move(*syntax), {}, options);
  result.names = std::move(query.names);
  result.incomplete = query.truncated;
  return result;
}
} // namespace kalandra::lsp
