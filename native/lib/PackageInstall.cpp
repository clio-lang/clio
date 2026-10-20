#include "kalandra/PackageInstall.h"
#include <algorithm>
#include <cerrno>
#include <fcntl.h>
#include <filesystem>
#include <fstream>
#include <functional>
#include <llvm/ADT/StringRef.h>
#include <llvm/Support/SHA256.h>
#include <map>
#include <sstream>
#include <stdexcept>
#include <sys/file.h>
#include <sys/stat.h>
#include <toml++/toml.hpp>
#include <unistd.h>
namespace kalandra {
namespace {
namespace fs = std::filesystem;
void require(bool ok, const std::string &message) {
  if (!ok)
    throw std::runtime_error(message);
}
std::string hash(std::string_view contents) {
  llvm::SHA256 hash;
  hash.update(llvm::StringRef(contents));
  std::string result;
  for (auto c : hash.final()) {
    result += "0123456789abcdef"[c >> 4];
    result += "0123456789abcdef"[c & 15];
  }
  return result;
}
bool digest(std::string_view value) {
  return value.size() == 64 && std::ranges::all_of(value, [](char c) {
           return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f');
         });
}
std::string read(const fs::path &path, std::size_t maximum) {
  require(fs::is_regular_file(fs::symlink_status(path)),
          "package metadata must be a regular file: " + path.string());
  require(fs::file_size(path) <= maximum, "package metadata exceeds configured byte limit");
  std::ifstream input(path, std::ios::binary);
  require(bool(input), "cannot read package metadata");
  std::string result;
  char buffer[8192];
  while (input.read(buffer, sizeof(buffer)) || input.gcount()) {
    require(std::size_t(input.gcount()) <= maximum - result.size(),
            "package metadata exceeds configured byte limit");
    result.append(buffer, std::size_t(input.gcount()));
  }
  require(input.eof(), "cannot read package metadata");
  return result;
}
fs::path cache(const NativeProject &project) {
  return fs::path(project.manifest).parent_path() / ".kalandra";
}
void directory(const fs::path &path, bool create) {
  if (create && !fs::exists(fs::symlink_status(path)))
    require(::mkdir(path.c_str(), 0700) == 0 || errno == EEXIST,
            "cannot create private package cache directory");
  require(fs::is_directory(fs::symlink_status(path)),
          "package cache must use real directories: " + path.string());
}
using Key = std::pair<std::string, std::string>;
struct Index {
  std::string manifest;
  std::map<Key, std::string> snapshots;
};
Index index(std::string_view contents, PackageInstallLimits limits) {
  const auto table = toml::parse(contents);
  require(table.size() == 3 && table["format"].is_integer() && table["format"].value<int>() == 1,
          "invalid installed package index format");
  auto manifest = table["manifest_digest"].value<std::string>();
  const auto *packages = table["snapshots"].as_array();
  require(manifest && digest(*manifest) && packages && packages->size() <= limits.maxPackages,
          "invalid or oversized installed package index");
  Index result{*manifest, {}};
  for (const auto &node : *packages) {
    const auto *item = node.as_table();
    require(item && item->size() == 3, "invalid installed package record");
    auto repository = (*item)["repository"].value<std::string>();
    auto commit = (*item)["commit"].value<std::string>();
    auto expected = (*item)["digest"].value<std::string>();
    require(repository && commit && expected && digest(*expected) &&
                result.snapshots.emplace(Key{*repository, *commit}, *expected).second,
            "invalid or duplicate installed package identity");
  }
  return result;
}
std::string serialize(const Index &index) {
  toml::array snapshots;
  for (const auto &[key, value] : index.snapshots)
    snapshots.push_back(
        toml::table{{"repository", key.first}, {"commit", key.second}, {"digest", value}});
  const toml::table table{
      {"format", 1}, {"manifest_digest", index.manifest}, {"snapshots", std::move(snapshots)}};
  std::ostringstream text;
  text << table;
  return text.str();
}
struct Resolved {
  InstalledNativeProject graph;
  Index selected;
};
Resolved resolve(const NativeProject &project, const Index &active, bool install,
                 PackageInstallLimits limits) {
  const auto root = cache(project);
  Resolved result{{{{"workspace",
                     fs::path(project.manifest).parent_path().string(),
                     project.entry,
                     {},
                     project.packages}}},
                  {hash(project.manifestContents), {}}};
  std::map<Key, std::size_t> known;
  std::vector<bool> complete{false};
  std::vector<std::size_t> heights{0};
  std::size_t entries = 0, bytes = 0;
  std::function<std::size_t(const NativeDependency &, std::size_t)> visit =
      [&](const NativeDependency &dependency, std::size_t depth) {
        require(depth <= limits.maxDepth, "package dependencies exceed configured depth");
        const Key key{dependency.repository, dependency.commit};
        if (auto found = known.find(key); found != known.end()) {
          require(complete[found->second],
                  "package dependency cycle reaches '" + dependency.name + "'");
          require(heights[found->second] <= limits.maxDepth - depth,
                  "package dependencies exceed configured depth");
          return found->second;
        }
        require(known.size() < limits.maxPackages,
                "package graph exceeds configured package limit");
        const auto selected = active.snapshots.find(key);
        require(install || selected != active.snapshots.end(),
                "dependency is not active; run kalandra install --project " + project.manifest);
        auto snapshot = install ? installGitSnapshot((root / "snapshots").string(),
                                                     {key.first, key.second}, limits.snapshot)
                                : loadGitSnapshot((root / "snapshots").string(),
                                                  {key.first, key.second}, limits.snapshot);
        require(bool(snapshot), snapshot ? "" : snapshot.error());
        if (selected != active.snapshots.end())
          require(snapshot->digest == selected->second,
                  "installed snapshot no longer matches its activation digest");
        for (const auto &entry :
             fs::recursive_directory_iterator(fs::path(snapshot->directory) / "source")) {
          require(entries++ < limits.maxSourceEntries,
                  "package graph exceeds configured source entry limit");
          if (entry.is_regular_file()) {
            const auto size = entry.file_size();
            require(size <= limits.maxSourceBytes - bytes,
                    "package graph exceeds configured source byte limit");
            bytes += size;
          }
        }
        require(fs::is_regular_file(fs::symlink_status(snapshot->library.entry)),
                "library public entry is missing");
        for (const auto &local : snapshot->library.packages)
          require(fs::is_regular_file(fs::symlink_status(local.entry)),
                  "library local mapping entry is missing");
        const auto id = result.graph.nodes.size();
        known.emplace(key, id);
        result.selected.snapshots.emplace(key, snapshot->digest);
        result.graph.nodes.push_back(snapshot->library.node(snapshot->identity));
        complete.push_back(false);
        heights.push_back(0);
        for (const auto &child : snapshot->library.dependencies) {
          const auto target = visit(child, depth + 1);
          result.graph.nodes[id].dependencies.push_back({child.name, target});
          heights[id] = std::max(heights[id], heights[target] + 1);
        }
        complete[id] = true;
        return id;
      };
  for (const auto &dependency : project.dependencies) {
    const auto target = visit(dependency, 1);
    result.graph.nodes[0].dependencies.push_back({dependency.name, target});
  }
  require(install || result.selected.snapshots.size() == active.snapshots.size(),
          "installed package index contains unexpected graph nodes");
  if (install) {
    // Installation checks the reachable source imports before activation. Builds
    // perform this check later, with their own root overlays and CLI mappings.
    auto parsed = loadPackageModules(result.graph.nodes, {}, {128, limits.maxDepth});
    require(bool(parsed), parsed ? "" : parsed.error());
    if (!parsed->ok())
      throw std::runtime_error(
          renderDiagnostic(*parsed->module.source, parsed->diagnostics.front()));
  }
  return result;
}
struct Guard {
  int fd = -1;
  fs::path temporary;
  ~Guard() {
    if (!temporary.empty()) {
      std::error_code ignored;
      fs::remove(temporary, ignored);
    }
    if (fd >= 0)
      ::close(fd);
  }
};
bool within(const fs::path &path, const fs::path &root) {
  const auto relative = path.lexically_relative(root);
  return !relative.empty() && !relative.has_root_path() && *relative.begin() != "..";
}
} // namespace
std::expected<void, std::string> installNativeProject(std::string manifest,
                                                      PackageInstallLimits limits) {
  try {
    auto project = loadNativeProject(std::move(manifest));
    require(bool(project), project ? "" : project.error());
    const auto root = cache(*project);
    directory(root, true);
    Guard guard;
    guard.fd =
        ::open((root / "install.guard").c_str(), O_CREAT | O_RDWR | O_NOFOLLOW | O_CLOEXEC, 0600);
    require(guard.fd >= 0, "cannot open package installation guard");
    struct stat status;
    require(::fstat(guard.fd, &status) == 0 && S_ISREG(status.st_mode) && status.st_nlink == 1,
            "package installation guard must be a private regular file");
    require(::flock(guard.fd, LOCK_EX | LOCK_NB) == 0,
            "another package installation is in progress");
    directory(root / "snapshots", true);
    const auto destination = root / "installed.toml";
    std::optional<std::string> before;
    Index active;
    if (fs::exists(fs::symlink_status(destination))) {
      before = read(destination, limits.maxIndexBytes);
      active = index(*before, limits);
    }
    auto resolved = resolve(*project, active, true, limits);
    const auto contents = serialize(resolved.selected);
    require(contents.size() <= limits.maxIndexBytes,
            "installed package index exceeds configured byte limit");
    auto name = (root / ".activate-XXXXXX").string();
    const int fd = ::mkstemp(name.data());
    require(fd >= 0, "cannot stage package activation");
    guard.temporary = name;
    std::size_t written = 0;
    while (written < contents.size()) {
      const auto count = ::write(fd, contents.data() + written, contents.size() - written);
      if (count < 0 && errno == EINTR)
        continue;
      if (count <= 0) {
        ::close(fd);
        throw std::runtime_error("cannot write package activation");
      }
      written += std::size_t(count);
    }
    require(::close(fd) == 0, "cannot close package activation");
    require(read(project->manifest, 256 * 1024) == project->manifestContents,
            "project manifest changed during installation; activation cancelled");
    if (before)
      require(read(destination, limits.maxIndexBytes) == *before,
              "package activation changed during installation");
    else
      require(!fs::exists(fs::symlink_status(destination)),
              "package activation appeared during installation");
    require(::rename(guard.temporary.c_str(), destination.c_str()) == 0,
            "cannot activate installed package graph");
    guard.temporary.clear();
    return {};
  } catch (const std::exception &error) {
    return std::unexpected(error.what());
  }
}
std::expected<InstalledNativeProject, std::string>
loadInstalledNativeProject(const NativeProject &project, PackageInstallLimits limits) {
  try {
    const auto root = cache(project);
    if (project.dependencies.empty())
      return InstalledNativeProject{{{"workspace",
                                      fs::path(project.manifest).parent_path().string(),
                                      project.entry,
                                      {},
                                      project.packages}}};
    require(fs::exists(fs::symlink_status(root)),
            "dependencies are not installed; run kalandra install --project " + project.manifest);
    directory(root, false);
    require(fs::exists(fs::symlink_status(root / "installed.toml")),
            "dependency graph is not active; run kalandra install --project " + project.manifest);
    directory(root / "snapshots", false);
    const auto active = index(read(root / "installed.toml", limits.maxIndexBytes), limits);
    require(active.manifest == hash(project.manifestContents),
            "project manifest differs from installed graph; run kalandra install --project " +
                project.manifest);
    return resolve(project, active, false, limits).graph;
  } catch (const std::exception &error) {
    return std::unexpected(error.what());
  }
}
std::expected<void, std::string> protectNativePackageOutput(const NativeProject &project,
                                                            std::string output,
                                                            PackageInstallLimits limits) {
  try {
    const auto root = cache(project);
    const auto target = fs::absolute(output).lexically_normal();
    const auto canonical = fs::weakly_canonical(target);
    require(!within(target, root) && !within(canonical, root),
            "package cache and output paths must be distinct");
    if (!fs::exists(fs::symlink_status(root)))
      return {};
    directory(root, false);
    std::size_t entries = 0;
    for (fs::recursive_directory_iterator iterator(root), end; iterator != end; ++iterator) {
      const auto &entry = *iterator;
      const auto name = entry.path().filename().string();
      if ((entry.path().parent_path() == root / "snapshots" &&
           name.starts_with(".kalandra-snapshot-")) ||
          (entry.path().parent_path() == root && name.starts_with(".activate-"))) {
        iterator.disable_recursion_pending();
        continue;
      }
      require(entries++ < limits.maxSourceEntries,
              "package cache exceeds output-protection entry limit");
      std::error_code error;
      require(!fs::equivalent(target, entry.path(), error),
              "package cache and output paths must be distinct");
    }
    return {};
  } catch (const std::exception &error) {
    return std::unexpected(error.what());
  }
}
} // namespace kalandra
