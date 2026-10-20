#pragma once
#include "kalandra/Syntax.h"
namespace kalandra {
struct NativeProject {
  std::string manifest;
  std::string entry;
  std::vector<ModulePackage> packages;
};
struct ProjectLimits {
  std::size_t maxBytes = 256 * 1024;
  std::size_t maxPackages = 128;
};
// Explicit native manifests only; no ancestor discovery, installation or network work.
[[nodiscard]] std::expected<NativeProject, std::string>
loadNativeProject(std::string path, ProjectLimits limits = {});
// Create an offline starter in a new directory. Never merges into or replaces
// an existing file/directory/symlink; the parent directory must already exist.
[[nodiscard]] std::expected<void, std::string> createNativeProject(std::string path);
} // namespace kalandra
