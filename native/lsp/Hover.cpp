#include "Hover.h"
#include "SemanticQuery.h"
namespace kalandra::lsp {
namespace {
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
} // namespace
std::optional<HoverInfo> hoverInfo(ParseResult syntax, std::string_view path, std::size_t offset,
                                   CheckOptions options) {
  auto selected = semanticToken(std::move(syntax), path, offset, options);
  if (!selected)
    return {};
  TypePrinter printer{selected->module};
  const auto word = selected->token.source->slice(selected->token.span);
  std::string text;
  if (selected->function)
    text = printer.function(selected->module.functions[*selected->function], word);
  else if (selected->record) {
    const auto &record = selected->module.records[*selected->record];
    text = std::string(record.error              ? "error "
                       : record.variants.empty() ? "type "
                                                 : "enum ") +
           std::string(word);
  } else if (selected->type) {
    text = printer.type(*selected->type);
    if (!word.starts_with('"'))
      text = std::string(word) + ": " + text;
  }
  if (!printer.valid || text.empty() || text.size() > 16384)
    return {};
  return HoverInfo{std::move(text), selected->token.source, selected->token.span};
}
} // namespace kalandra::lsp
