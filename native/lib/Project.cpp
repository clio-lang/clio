#include "kalandra/Project.h"
#include <filesystem>
#include <fstream>
#include <sstream>
#include <toml++/toml.hpp>
static_assert(TOML_LIB_MAJOR == 3 && TOML_LIB_MINOR == 4 && TOML_LIB_PATCH == 0,
              "native manifests require toml++ 3.4.0 headers");
namespace kalandra {
std::expected<NativeProject, std::string> loadNativeProject(std::string path,
                                                            ProjectLimits limits) {
  namespace fs = std::filesystem;
  if (path.find('\0') != std::string::npos || fs::path(path).extension() != ".toml")
    return std::unexpected("native project manifests must use the .toml extension");
  std::error_code error;
  const auto manifest = fs::canonical(path, error);
  if (error)
    return std::unexpected(path + ": cannot open native project manifest");
  std::ifstream input(manifest, std::ios::binary);
  if (!input)
    return std::unexpected(path + ": cannot read native project manifest");
  std::string text;
  char buffer[4096];
  while (input.read(buffer, sizeof(buffer)) || input.gcount()) {
    if (std::size_t(input.gcount()) > limits.maxBytes - text.size())
      return std::unexpected(path + ": native project manifest exceeds configured byte limit");
    text.append(buffer, std::size_t(input.gcount()));
  }
  if (!input.eof())
    return std::unexpected(path + ": cannot read native project manifest");
  try {
    auto table = toml::parse(text, manifest.string());
    const auto fail = [&](const toml::node &node,
                          const std::string &message) -> std::expected<NativeProject, std::string> {
      const auto &at = node.source().begin;
      return std::unexpected(manifest.string() + ":" + std::to_string(at.line) + ":" +
                             std::to_string(at.column) + ": " + message);
    };
    for (const auto &[key, value] : table)
      if (key != "format" && key != "project" && key != "packages")
        return fail(value, "unknown native project field '" + std::string(key.str()) + "'");
    auto *format = table.get("format");
    if (!format || !format->is_integer() || format->value<std::int64_t>() != 1)
      return fail(format ? *format : table, "native project format must be integer 1");
    auto *project = table["project"].as_table();
    if (!project)
      return fail(table, "native project requires a [project] table");
    for (const auto &[key, value] : *project)
      if (key != "entry")
        return fail(value, "unknown project field '" + std::string(key.str()) + "'");
    auto entry = (*project)["entry"].value<std::string>();
    if (!entry)
      return fail(project->get("entry") ? *project->get("entry") : *project,
                  "project.entry must be a relative .k path");
    const auto resolve = [&](const std::string &name,
                             const std::string &value) -> std::optional<std::string> {
      const fs::path requested(value);
      if (!parseModulePackage(name + "=" + value) || requested.has_root_path() ||
          value.find('\\') != std::string::npos)
        return {};
      return (manifest.parent_path() / requested).lexically_normal().string();
    };
    auto source = resolve("entry", *entry);
    if (!source)
      return fail(*project->get("entry"),
                  "project.entry must be a relative .k path using '/' separators");
    NativeProject result{manifest.string(), std::move(*source), {}};
    if (auto *packages = table.get("packages")) {
      auto *items = packages->as_table();
      if (!items)
        return fail(*packages, "packages must be a table of names and relative .k paths");
      if (items->size() > limits.maxPackages)
        return fail(*items, "native project exceeds configured package limit");
      for (const auto &[key, node] : *items) {
        auto value = node.value<std::string>();
        auto package = value ? resolve(std::string(key.str()), *value) : std::nullopt;
        if (!package)
          return fail(
              node,
              "package entries require valid names and relative .k paths using '/' separators");
        result.packages.push_back({std::string(key.str()), std::move(*package)});
      }
    }
    return result;
  } catch (const toml::parse_error &error) {
    std::ostringstream message;
    message << error;
    return std::unexpected(message.str());
  }
}
} // namespace kalandra
