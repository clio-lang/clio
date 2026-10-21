#include "Completion.h"
#include "CallRecovery.h"
#include <algorithm>
#include <filesystem>
#include <type_traits>
namespace kalandra::lsp {
CompletionInfo completeNames(const std::string &path, const std::string &text, std::size_t offset,
                             const std::vector<ModulePackage> &packages,
                             std::vector<SourceOverlay> overlays, CheckOptions options,
                             const SourceGraphLoader &loader) {
  CompletionInfo result{{offset, offset}, {}, false};
  if (offset > text.size())
    return result;
  std::error_code error;
  const auto canonical = std::filesystem::weakly_canonical(path, error).string();
  if (error)
    return result;
  auto source = std::make_shared<const SourceFile>(canonical, text);
  const auto tokens = lex(source);
  std::size_t closures = 0;
  if (!tokens.diagnostics.empty()) {
    const auto repaired = trailingCallClosures(tokens, text, offset);
    if (!repaired)
      return result;
    closures = *repaired;
  }
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
  // Repair only one label/value slot inside balanced construction/pattern delimiters.
  // The parsed node and checker must still identify a valid nominal owner.
  const auto trivia = [](TokenKind kind) {
    return kind == TokenKind::Newline || kind == TokenKind::Indent || kind == TokenKind::Dedent ||
           kind == TokenKind::End;
  };
  std::vector<TokenKind> delimiters;
  std::optional<TokenKind> previous;
  std::vector<const Token *> following;
  for (const auto &token : tokens.tokens) {
    if (trivia(token.kind))
      continue;
    if (token.span.end <= result.replacement.begin) {
      previous = token.kind;
      if (token.kind == TokenKind::LeftBrace || token.kind == TokenKind::LeftParen ||
          token.kind == TokenKind::LeftBracket)
        delimiters.push_back(token.kind);
      else if (token.kind == TokenKind::RightBrace || token.kind == TokenKind::RightParen ||
               token.kind == TokenKind::RightBracket) {
        if (!delimiters.empty())
          delimiters.pop_back();
      }
    } else if (token.span.begin >= result.replacement.end && following.size() < 2)
      following.push_back(&token);
  }
  const bool labelSlot = !delimiters.empty() && delimiters.back() == TokenKind::LeftBrace &&
                         (previous == TokenKind::LeftBrace || previous == TokenKind::Comma);
  const auto boundary = [](TokenKind kind) {
    return kind == TokenKind::RightBrace || kind == TokenKind::Comma;
  };
  const bool bareLabel = labelSlot && !following.empty() && boundary(following[0]->kind);
  const bool missingValue = labelSlot && following.size() == 2 &&
                            following[0]->kind == TokenKind::Colon && boundary(following[1]->kind);
  const auto prefix = text.substr(result.replacement.begin, offset - result.replacement.begin);
  constexpr std::string_view probe = "__kalandra_completion_probe";
  // An identifier can stand in for either a constructor value or a pattern binder.
  constexpr std::string_view filler = "__kalandra_completion_binding";
  if (text.size() - (result.replacement.end - result.replacement.begin) + probe.size() +
          (bareLabel      ? filler.size() + 2
           : missingValue ? filler.size() + 1
                          : 0) +
          closures >
      SyntaxLimits{}.maxSourceBytes)
    return result;
  auto replacement = text;
  replacement.replace(result.replacement.begin, result.replacement.end - result.replacement.begin,
                      std::string(probe) + (bareLabel ? ": " + std::string(filler) : ""));
  if (missingValue) {
    const auto at =
        result.replacement.begin + probe.size() + following[0]->span.end - result.replacement.end;
    replacement.insert(at, " " + std::string(filler));
  }
  if (closures)
    replacement.insert(result.replacement.begin + probe.size(), closures, ')');
  std::erase_if(overlays, [&](const auto &entry) {
    std::error_code ec;
    return std::filesystem::weakly_canonical(entry.path, ec).string() == canonical && !ec;
  });
  overlays.push_back({canonical, std::move(replacement)});
  auto syntax = loader ? loader(path, overlays) : loadModules(path, {}, {}, packages, overlays);
  if (!syntax || !syntax->ok())
    return result;
  // Locate the probe through original-file identities so this does not depend
  // on how the module loader arranges the composed source.
  std::optional<SourceSpan> site;
  bool labelSite = false;
  const auto locate = [&](SourceSpan candidate) {
    const auto [original, local] = syntax->module.source->origin(candidate.begin);
    if (original->path() == canonical && local == result.replacement.begin &&
        syntax->module.source->slice(candidate) == probe)
      site = candidate;
  };
  for (const auto &expression : syntax->module.expressions) {
    if (const auto *name = std::get_if<NameExpr>(&expression.value))
      locate(name->name);
    else if (const auto *field = std::get_if<FieldExpr>(&expression.value))
      locate(field->field);
    else if (const auto *record = std::get_if<RecordExpr>(&expression.value)) {
      if (record->family)
        locate(record->name);
      for (const auto &field : record->fields) {
        if (site)
          break;
        locate(field.name);
        if (site) {
          labelSite = true;
          break;
        }
      }
    } else if (const auto *match = std::get_if<MatchExpr>(&expression.value))
      for (const auto &arm : match->arms) {
        if (arm.variant)
          locate(*arm.variant);
        for (const auto &field : arm.fields)
          locate(field.name);
      }
    if (site)
      break;
  }
  if (!site) {
    // Type annotations are not expressions. Walk their owned syntax explicitly,
    // including nested callable types and annotations in nested suites.
    std::vector<const TypeSyntax *> types;
    const auto statements = [&](const std::vector<Statement> &body) {
      for (const auto &statement : body)
        if (statement.annotation)
          types.push_back(&*statement.annotation);
    };
    for (const auto &function : syntax->module.functions) {
      for (const auto &parameter : function.parameters)
        types.push_back(&parameter.type);
      if (function.result)
        types.push_back(&*function.result);
      statements(function.body);
    }
    for (const auto &record : syntax->module.records) {
      for (const auto &field : record.fields)
        types.push_back(&field.type);
      for (const auto &variant : record.variants)
        for (const auto &field : variant.fields)
          types.push_back(&field.type);
    }
    for (const auto &expression : syntax->module.expressions) {
      std::visit(
          [&](const auto &value) {
            using T = std::decay_t<decltype(value)>;
            if constexpr (std::is_same_v<T, LambdaExpr>) {
              for (const auto &parameter : value.parameters)
                if (parameter.annotation)
                  types.push_back(&*parameter.annotation);
              if (value.result)
                types.push_back(&*value.result);
            }
            if constexpr (requires { value.body; })
              statements(value.body);
            if constexpr (std::is_same_v<T, ConditionalExpr>) {
              statements(value.whenTrue);
              statements(value.whenFalse);
            }
            if constexpr (std::is_same_v<T, MatchExpr>)
              for (const auto &arm : value.arms)
                statements(arm.body);
          },
          expression.value);
    }
    while (!site && !types.empty()) {
      const auto *type = types.back();
      types.pop_back();
      if (type->function) {
        for (const auto &parameter : type->function->parameters)
          types.push_back(&parameter);
        types.push_back(&type->function->result);
      } else {
        locate(type->name);
        if (type->element)
          locate(*type->element);
      }
    }
  }
  if (!site)
    return result;
  ScopeCompletion query{*site, prefix, {}, false, false};
  options.completion = &query;
  (void)check(std::move(*syntax), {}, options);
  result.appendFieldColon = labelSite && bareLabel;
  result.names = std::move(query.names);
  result.incomplete = query.truncated;
  return result;
}
} // namespace kalandra::lsp
