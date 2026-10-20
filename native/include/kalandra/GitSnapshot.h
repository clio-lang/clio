#pragma once
#include "kalandra/Project.h"
namespace kalandra {
struct GitSnapshotRequest {
  // Initial transport: canonical absolute local worktree/bare repository path.
  std::string repository;
  std::string commit;
};
struct GitSnapshotLimits {
  std::size_t maxObjectFiles = 8192;
  std::size_t maxObjectBytes = 128 * 1024 * 1024;
  std::size_t maxSourceEntries = 4096;
  std::size_t maxSourceBytes = 64 * 1024 * 1024;
  std::size_t maxListingBytes = 1024 * 1024;
  unsigned processSeconds = 30;
};
struct NativeGitSnapshot {
  std::string identity;
  std::string directory;
  std::string digest;
  NativePackage library;
};
// Snapshot-level foundation, not a project installer or lockfile API. The cache
// directory must exist. Never checks out a worktree or executes source programs.
[[nodiscard]] std::expected<NativeGitSnapshot, std::string>
installLocalGitSnapshot(std::string cache, GitSnapshotRequest request,
                        GitSnapshotLimits limits = {});
// Offline verification: no Git invocation and no access to the original repository.
// Verification detects edits; it does not authenticate a cache against its owner.
[[nodiscard]] std::expected<NativeGitSnapshot, std::string>
loadLocalGitSnapshot(std::string cache, GitSnapshotRequest request, GitSnapshotLimits limits = {});
} // namespace kalandra
