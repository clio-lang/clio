#include "SemanticQuery.h"
#include <algorithm>
#include <map>
namespace kalandra::lsp {
namespace {
using SpanKey = std::pair<std::size_t, std::size_t>;
std::shared_ptr<const SourceFile> originalSource(std::shared_ptr<const SourceFile> source,
                                                 std::string_view path, unsigned depth = 0) {
  if (!source || depth > 32)
    return {};
  if (source->parts().empty())
    return source->path() == path ? source : nullptr;
  for (const auto &part : source->parts())
    if (auto original = originalSource(part.source, path, depth + 1))
      return original;
  return {};
}
} // namespace
std::optional<SourceLocation> sourceLocation(std::shared_ptr<const SourceFile> source,
                                             SourceSpan span) {
  if (!source || span.end <= span.begin || span.end > source->text().size())
    return {};
  const auto [file, begin] = source->origin(span.begin);
  const auto [endFile, end] = source->origin(span.end);
  if (file != endFile || end <= begin)
    return {};
  auto original = originalSource(source, file->path());
  if (!original)
    return {};
  return SourceLocation{std::move(original), {begin, end}};
}
std::optional<SemanticToken> semanticToken(ParseResult syntax, std::string_view path,
                                           std::size_t offset, CheckOptions options) {
  if (!syntax.ok() || !syntax.module.source)
    return {};
  auto original = originalSource(syntax.module.source, path);
  if (!original || offset >= original->text().size())
    return {};
  auto tokens = lex(original);
  const auto token = std::ranges::find_if(tokens.tokens, [&](const auto &token) {
    return token.span.begin <= offset && offset < token.span.end;
  });
  if (token == tokens.tokens.end() ||
      (token->kind != TokenKind::Identifier && token->kind != TokenKind::String &&
       token->kind != TokenKind::Number))
    return {};
  const auto word = original->slice(token->span);
  std::map<SpanKey, SourceSpan> callees;
  for (const auto &expression : syntax.module.expressions) {
    if (const auto *call = std::get_if<CallExpr>(&expression.value))
      callees.emplace(SpanKey{expression.span.begin, expression.span.end},
                      syntax.module.expressions[call->callee].span);
    if (const auto *pipeline = std::get_if<BinaryExpr>(&expression.value);
        pipeline && pipeline->operation == TokenKind::Arrow) {
      const auto &right = syntax.module.expressions[pipeline->right];
      if (std::holds_alternative<NameExpr>(right.value))
        callees.emplace(SpanKey{expression.span.begin, expression.span.end}, right.span);
      else if (const auto *call = std::get_if<CallExpr>(&right.value))
        callees.emplace(SpanKey{expression.span.begin, expression.span.end},
                        syntax.module.expressions[call->callee].span);
    }
  }
  auto checked = check(std::move(syntax), {}, options);
  if (!checked.ok())
    return {};
  SemanticToken selected{std::move(*checked.module), {original, token->span}, {}, {}, {}, {}};
  const auto &module = selected.module;
  const auto exact = [&](SourceSpan span) {
    auto mapped = sourceLocation(module.source, span);
    return mapped && mapped->source->path() == path && mapped->span.begin == token->span.begin &&
           mapped->span.end == token->span.end;
  };
  for (const auto &symbol : module.symbols)
    if (symbol.name == word && exact(symbol.declaration)) {
      selected.type = symbol.type;
      selected.declaration = symbol.definition.value_or(symbol.declaration);
      return selected;
    }
  for (FunctionId i = 0; i < module.functions.size(); ++i)
    if (!module.functions[i].anonymous && exact(module.functions[i].declaration)) {
      selected.function = i;
      selected.declaration = module.functions[i].declaration;
      return selected;
    }
  for (std::size_t i = 0; i < module.records.size(); ++i) {
    const auto &record = module.records[i];
    if (exact(record.declaration)) {
      selected.record = i;
      selected.declaration = record.declaration;
      return selected;
    }
    for (const auto &field : record.fields)
      if (exact(field.declaration)) {
        selected.type = field.type;
        selected.declaration = field.declaration;
        return selected;
      }
  }
  for (const auto &expression : module.expressions) {
    if (exact(expression.span)) {
      selected.type = expression.type;
      if (const auto *symbol = std::get_if<SymbolRead>(&expression.operation)) {
        const auto &binding = module.symbols[symbol->symbol];
        if (binding.name != word)
          continue;
        selected.declaration = binding.definition.value_or(binding.declaration);
      } else if (const auto *reference = std::get_if<FunctionReference>(&expression.operation)) {
        selected.function = reference->function;
        if (!module.functions[reference->function].anonymous)
          selected.declaration = module.functions[reference->function].declaration;
      } else if (const auto *field = std::get_if<RecordFieldRead>(&expression.operation)) {
        const auto &receiver = module.expressions[field->input].type;
        if (receiver.record)
          selected.declaration = module.records[*receiver.record].fields[field->field].declaration;
      }
      return selected;
    }
    if (const auto *field = std::get_if<RecordFieldRead>(&expression.operation)) {
      auto mapped = sourceLocation(module.source, expression.span);
      if (mapped && mapped->source->path() == path && mapped->span.end == token->span.end &&
          mapped->span.begin <= token->span.begin) {
        const auto &receiver = module.expressions[field->input].type;
        if (receiver.record && *receiver.record < module.records.size() &&
            module.records[*receiver.record].fields[field->field].name == word) {
          selected.type = expression.type;
          selected.declaration = module.records[*receiver.record].fields[field->field].declaration;
          return selected;
        }
      }
    }
    if (const auto *call = std::get_if<FunctionCall>(&expression.operation)) {
      const auto found = callees.find({expression.span.begin, expression.span.end});
      if (found != callees.end() && exact(found->second)) {
        selected.function = call->function;
        if (!module.functions[call->function].anonymous)
          selected.declaration = module.functions[call->function].declaration;
        return selected;
      }
    }
  }
  return {};
}
std::optional<SourceLocation> definition(ParseResult syntax, std::string_view path,
                                         std::size_t offset, CheckOptions options) {
  auto selected = semanticToken(std::move(syntax), path, offset, options);
  if (!selected || !selected->declaration)
    return {};
  auto location = sourceLocation(selected->module.source, *selected->declaration);
  if (!location)
    return {};
  // Do not publish generated lambda bodies or compiler-internal spans as definitions.
  auto tokens = lex(location->source);
  const auto named = std::ranges::any_of(tokens.tokens, [&](const auto &token) {
    return token.kind == TokenKind::Identifier && token.span.begin == location->span.begin &&
           token.span.end == location->span.end;
  });
  return named ? location : std::nullopt;
}
} // namespace kalandra::lsp
