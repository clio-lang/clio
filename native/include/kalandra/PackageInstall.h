#pragma once
#include "kalandra/GitSnapshot.h"
namespace kalandra {
struct PackageInstallLimits {
  std::size_t maxPackages = 64;
  std::size_t maxDepth = 32;
  std::size_t maxSourceEntries = 32768;
  std::size_t maxSourceBytes = 128 * 1024 * 1024;
  std::size_t maxIndexBytes = 1024 * 1024;
  GitSnapshotLimits snapshot = {};
};
struct InstalledNativeProject {
  std::vector<PackageNode> nodes;
};
// Explicit exact-commit installation. Publishes an index only after the
// entire declared graph and reachable source imports validate. No mutable refs.
[[nodiscard]] std::expected<void, std::string>
installNativeProject(std::string manifest, PackageInstallLimits limits = {});
// Read one activation generation and verify all selected snapshots. Never runs Git.
[[nodiscard]] std::expected<InstalledNativeProject, std::string>
loadInstalledNativeProject(const NativeProject &, PackageInstallLimits limits = {});
// Protect the reserved cache namespace and published cache file aliases, including
// old generations and unused snapshots, without modifying anything.
[[nodiscard]] std::expected<void, std::string>
protectNativePackageOutput(const NativeProject &, std::string output,
                           PackageInstallLimits limits = {});
} // namespace kalandra
