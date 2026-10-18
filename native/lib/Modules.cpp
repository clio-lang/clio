#include "kalandra/Syntax.h"
#include <algorithm>
#include <filesystem>
#include <functional>
#include <unordered_map>

namespace kalandra {
namespace {
bool packageName(std::string_view name) {
  const auto letter = [](char c) {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c == '_';
  };
  if (name.empty() || !letter(name.front()))
    return false;
  return std::ranges::all_of(
      name, [&](char c) { return letter(c) || (c >= '0' && c <= '9') || c == '-'; });
}
bool packageEntry(std::string_view entry) {
  return !entry.empty() && entry.find('\0') == std::string_view::npos &&
         entry.find_first_of("\r\n") == std::string_view::npos &&
         std::filesystem::path(entry).extension() == ".k";
}
} // namespace
std::expected<ModulePackage, std::string> parseModulePackage(std::string_view value) {
  const auto equal = value.find('=');
  if (equal == std::string_view::npos || !packageName(value.substr(0, equal)) ||
      !packageEntry(value.substr(equal + 1)))
    return std::unexpected(
        "package mappings require name=path.k with an ASCII identifier or hyphenated name");
  return ModulePackage{std::string(value.substr(0, equal)), std::string(value.substr(equal + 1))};
}
std::expected<ParseResult, std::string> loadModules(std::string path, SyntaxLimits syntaxLimits,
                                                    ModuleLimits moduleLimits,
                                                    std::span<const ModulePackage> packages) {
  namespace fs = std::filesystem;
  struct File {
    std::shared_ptr<const SourceFile> source;
    std::vector<std::size_t> targets;
    bool complete = false;
    std::size_t height = 0;
  };
  std::vector<File> files;
  std::unordered_map<std::string, std::size_t> known;
  std::size_t bytes = 0;
  std::optional<ParseResult> failure;
  const auto fail = [&](std::shared_ptr<const SourceFile> source, SourceSpan span, std::string code,
                        std::string message) {
    failure = ParseResult{};
    failure->module.source = std::move(source);
    failure->diagnostics.push_back({std::move(code), std::move(message), span});
  };
  auto root = std::make_shared<const SourceFile>(path, "");
  std::unordered_map<std::string, fs::path> entries;
  if (packages.size() > moduleLimits.maxFiles) {
    fail(root, {}, "M004", "package mappings exceed configured file limit");
    return std::move(*failure);
  }
  for (const auto &package : packages) {
    if (!packageName(package.name) || !packageEntry(package.entry) ||
        !entries.emplace(package.name, fs::path(package.entry)).second) {
      fail(root, {}, "M005", "invalid or duplicate local package mapping '" + package.name + "'");
      return std::move(*failure);
    }
  }
  std::function<std::optional<std::size_t>(fs::path, std::size_t, std::shared_ptr<const SourceFile>,
                                           SourceSpan)>
      visit = [&](fs::path requested, std::size_t depth, std::shared_ptr<const SourceFile> parent,
                  SourceSpan span) -> std::optional<std::size_t> {
    if (requested.extension() != ".k") {
      fail(std::move(parent), span, "M001", "source files must use the .k extension");
      return {};
    }
    std::error_code error;
    const auto canonical = fs::canonical(requested, error);
    if (error) {
      fail(std::move(parent), span, "M002", "cannot open module '" + requested.string() + "'");
      return {};
    }
    const auto key = canonical.string();
    if (auto found = known.find(key); found != known.end()) {
      if (!files[found->second].complete) {
        fail(std::move(parent), span, "M003", "module import cycle reaches '" + key + "'");
        return {};
      }
      if (depth > moduleLimits.maxDepth ||
          files[found->second].height > moduleLimits.maxDepth - depth) {
        fail(std::move(parent), span, "M004", "module graph exceeds configured import depth");
        return {};
      }
      return found->second;
    }
    if (depth > moduleLimits.maxDepth || files.size() >= moduleLimits.maxFiles ||
        bytes >= syntaxLimits.maxSourceBytes) {
      fail(std::move(parent), span, "M004",
           "module graph exceeds configured depth/file/byte limits");
      return {};
    }
    auto source = loadSource(key, syntaxLimits.maxSourceBytes - bytes - 1);
    if (!source) {
      fail(std::move(parent), span, source.error().starts_with("source exceeds") ? "M004" : "M002",
           "cannot load module '" + key + "': " + source.error());
      return {};
    }
    auto parsed = parse(*source, syntaxLimits);
    if (!parsed.ok()) {
      failure = std::move(parsed);
      return {};
    }
    bytes += (*source)->text().size() + 1;
    const auto id = files.size();
    known.emplace(key, id);
    files.push_back({*source, {}, false});
    for (const auto &import : parsed.module.imports) {
      const auto quoted = (*source)->slice(import.path);
      const std::string specifier(quoted.substr(1, quoted.size() - 2));
      fs::path requested;
      if (specifier.find_first_of("\\\r\n") != std::string::npos ||
          specifier.find('\0') != std::string::npos) {
        fail(*source, import.path, "M001", "module specifiers cannot contain escapes");
        return {};
      }
      if (specifier.starts_with("./") || specifier.starts_with("../")) {
        if (!specifier.ends_with(".k")) {
          fail(*source, import.path, "M001", "relative module paths require an explicit .k file");
          return {};
        }
        requested = canonical.parent_path() / specifier;
      } else {
        if (!packageName(specifier)) {
          fail(*source, import.path, "M001",
               "imports require a relative .k path or declared package name");
          return {};
        }
        auto entry = entries.find(specifier);
        if (entry == entries.end()) {
          fail(*source, import.path, "M005",
               "unknown local package '" + specifier + "'; supply --package name=path.k");
          return {};
        }
        requested = entry->second;
      }
      auto target = visit(requested, depth + 1, *source, import.path);
      if (!target)
        return {};
      files[id].targets.push_back(*target);
      files[id].height = std::max(files[id].height, files[*target].height + 1);
    }
    files[id].complete = true;
    return id;
  };
  if (!visit(fs::path(path), 0, root, {}))
    return std::move(*failure);
  if (files.size() == 1) {
    // Preserve the existing single-file source and byte offsets.
    return parse(files[0].source, syntaxLimits);
  }
  std::string text;
  text.reserve(bytes);
  std::vector<SourceFile::Part> parts;
  for (const auto &file : files) {
    parts.push_back({text.size(), file.source});
    text += file.source->text();
    text += '\n';
  }
  auto source = std::make_shared<const SourceFile>(files[0].source->path(), std::move(text),
                                                   std::move(parts));
  auto result = parse(source, syntaxLimits);
  if (!result.ok())
    return result;
  for (auto &function : result.module.functions)
    function.moduleIndex = source->partIndex(function.name.begin);
  std::vector<std::size_t> next(files.size());
  for (auto &import : result.module.imports) {
    import.moduleIndex = source->partIndex(import.path.begin);
    import.target = files[import.moduleIndex].targets[next[import.moduleIndex]++];
  }
  return result;
}
} // namespace kalandra
