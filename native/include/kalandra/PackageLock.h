#pragma once
#include "kalandra/Project.h"
#include <map>
namespace kalandra {
using NativePackageKey = std::pair<std::string, std::string>;
struct LockedNativePackage {
  std::string digest;
  std::string entry;
  std::vector<NativeDependency> dependencies;
};
struct NativePackageLock {
  std::string manifest;
  std::vector<NativeDependency> roots;
  std::map<NativePackageKey, LockedNativePackage> packages;
};
struct PackageLockLimits {
  std::size_t maxBytes = 1024 * 1024;
  std::size_t maxPackages = 64;
  std::size_t maxDepth = 32;
};
// Pure parsing and graph validation: never reads source files or fetches Git.
[[nodiscard]] std::expected<NativePackageLock, std::string>
parseNativePackageLock(std::string_view contents, PackageLockLimits limits = {});
[[nodiscard]] std::string serializeNativePackageLock(const NativePackageLock &);
[[nodiscard]] bool sameNativeDependencies(const std::vector<NativeDependency> &,
                                          const std::vector<NativeDependency> &);
} // namespace kalandra
