#include "Hover.h"
#include <algorithm>
#include <map>
#include <tuple>
namespace kalandra::lsp {
namespace {
using SpanKey = std::pair<std::size_t, std::size_t>;
struct TypePrinter {
  const TypedModule &module;
  std::size_t budget = 4096;
  bool valid = true;
  std::string errorName(std::optional<std::size_t> id, std::size_t depth = 0) {
    if (!id)
      return "TaskError";
    if (!budget || depth > 32 || *id >= module.records.size()) {
      valid = false;
      return {};
    }
    --budget;
    const auto &record = module.records[*id];
    if (record.taskErrorFamily)
      return "TaskError";
    if (record.errorMembers.empty())
      return record.name;
    std::string result;
    for (auto member : record.errorMembers) {
      if (!result.empty())
        result += " | ";
      result += errorName(member, depth + 1);
      if (!valid || result.size() > 16384) {
        valid = false;
        return {};
      }
    }
    return result;
  }
  std::string type(ValueType value, std::size_t depth = 0) {
    if (!budget || depth > 32) {
      valid = false;
      return {};
    }
    --budget;
    const bool task = value.task, fallible = value.fallible;
    const auto family = value.errorRecord;
    value.task = value.fallible = false;
    value.errorRecord.reset();
    std::string result;
    if (isFunctionArray(value))
      result = "[" + type(recordArrayElement(value), depth + 1) + "]";
    else if (value.builtin == BuiltinValue::Function && value.callable) {
      result = "fn(";
      for (std::size_t i = 0; i < value.callable->parameters.size(); ++i) {
        if (i)
          result += ", ";
        result += type(value.callable->parameters[i], depth + 1);
        if (!valid || result.size() > 16384) {
          valid = false;
          return {};
        }
      }
      result += ") -> " + returnedType(value.callable->result, depth + 1);
    } else if (value.builtin == BuiltinValue::Record && value.record &&
               *value.record < module.records.size() &&
               !module.records[*value.record].errorMembers.empty()) {
      result = errorName(value.record);
      if (value.array)
        result = "[" + result + "]";
    } else {
      for (auto &extent : value.shape)
        extent.identity = 0;
      result = describeType(value);
      // Dynamic extent identities are private inference details, not source types.
      for (std::size_t at = 0; (at = result.find("?d0", at)) != result.npos;)
        result.replace(at, 3, "?");
    }
    if (task)
      result = "task<" + result + ">";
    if (fallible) {
      if (value.builtin == BuiltinValue::Function)
        result = "(" + result + ")";
      result += " ! " + errorName(family);
    }
    if (result.size() > 16384) {
      valid = false;
      return {};
    }
    return result;
  }
  std::string returnedType(ValueType value, std::size_t depth) {
    const bool fallible = value.fallible;
    const auto family = value.errorRecord;
    value.fallible = false;
    value.errorRecord.reset();
    auto result = type(value, depth + 1);
    if (value.builtin == BuiltinValue::Function)
      result = "(" + result + ")";
    if (fallible)
      result += " ! " + errorName(family);
    return result;
  }
  std::string function(const TypedFunction &function, std::string_view name) {
    std::string result = "fn " + std::string(name) + "(";
    const auto count = function.parameters.size() - function.captureCount;
    for (std::size_t i = 0; i < count; ++i) {
      if (i)
        result += ", ";
      const auto &parameter = module.symbols[function.parameters[i]];
      result += parameter.name + ": " + type(parameter.type);
      if (!valid || result.size() > 16384) {
        valid = false;
        return {};
      }
    }
    result += ") -> " + returnedType(function.resultType, 0);
    if (result.size() > 16384)
      valid = false;
    return result;
  }
};
std::shared_ptr<const SourceFile> originalSource(std::shared_ptr<const SourceFile> source,
                                                 std::string_view path, unsigned depth = 0) {
  if (depth > 32)
    return {};
  if (source->parts().empty())
    return source->path() == path ? source : nullptr;
  for (const auto &part : source->parts())
    if (auto original = originalSource(part.source, path, depth + 1))
      return original;
  return {};
}
} // namespace
std::optional<HoverInfo> hoverInfo(ParseResult syntax, std::string_view path, std::size_t offset,
                                   CheckOptions options) {
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
  // Retain syntactic callee spans while the checker resolves their target identities.
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
  const auto &module = *checked.module;
  TypePrinter printer{module};
  const auto local = [&](SourceSpan span) -> std::optional<SourceSpan> {
    const auto [file, begin] = module.source->origin(span.begin);
    const auto [endFile, end] = module.source->origin(span.end);
    if (file->path() != path || endFile != file || end <= begin)
      return {};
    return SourceSpan{begin, end};
  };
  const auto exact = [&](SourceSpan span) {
    auto mapped = local(span);
    return mapped && mapped->begin == token->span.begin && mapped->end == token->span.end;
  };
  const auto result = [&](std::string text) -> std::optional<HoverInfo> {
    if (!printer.valid || text.empty() || text.size() > 16384)
      return {};
    return HoverInfo{std::move(text), original, token->span};
  };
  for (const auto &symbol : module.symbols)
    if (exact(symbol.declaration))
      return result(std::string(word) + ": " + printer.type(symbol.type));
  for (const auto &function : module.functions)
    if (!function.anonymous && exact(function.declaration))
      return result(printer.function(function, word));
  for (const auto &record : module.records) {
    if (exact(record.declaration))
      return result(std::string(record.error              ? "error "
                                : record.variants.empty() ? "type "
                                                          : "enum ") +
                    std::string(word));
    for (const auto &field : record.fields)
      if (exact(field.declaration))
        return result(std::string(word) + ": " + printer.type(field.type));
  }
  // Prefer exact value spans; field names use the resolved field's type, not its receiver.
  for (const auto &expression : module.expressions) {
    if (exact(expression.span)) {
      if (const auto *reference = std::get_if<FunctionReference>(&expression.operation))
        return result(printer.function(module.functions[reference->function], word));
      if (token->kind == TokenKind::String)
        return result(printer.type(expression.type));
      return result(std::string(word) + ": " + printer.type(expression.type));
    }
    if (const auto *field = std::get_if<RecordFieldRead>(&expression.operation)) {
      auto mapped = local(expression.span);
      if (mapped && mapped->end == token->span.end && mapped->begin <= token->span.begin) {
        const auto &receiver = module.expressions[field->input].type;
        if (receiver.record && *receiver.record < module.records.size() &&
            module.records[*receiver.record].fields[field->field].name == word)
          if (token->kind == TokenKind::String)
            return result(printer.type(expression.type));
        return result(std::string(word) + ": " + printer.type(expression.type));
      }
    }
    if (const auto *call = std::get_if<FunctionCall>(&expression.operation)) {
      const auto found = callees.find({expression.span.begin, expression.span.end});
      if (found != callees.end() && exact(found->second))
        return result(printer.function(module.functions[call->function], word));
    }
  }
  return {};
}
} // namespace kalandra::lsp
