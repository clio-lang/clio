# Exact-commit local Git snapshots

The first N3-B slice adds a snapshot API for pinned local Git repositories. It is
an installer foundation, not a public `kalandra install` command, dependency
manifest resolver, complete project activation or lockfile implementation.
Existing compiler/checker/editor builds do not invoke it or fetch dependencies.

## API and identity

`installLocalGitSnapshot(cache, request, limits)` imports a library into an
existing cache directory. `GitSnapshotRequest` contains a canonical absolute local
worktree or bare repository path and a full lowercase 40-digit SHA-1 **commit** ID.
Branches, abbreviated IDs, annotated tag objects, tree/blob IDs, linked worktrees,
alternates, partial clones and remote transports are not supported by this slice.
SHA-256-format Git repositories require later work.

The cache key is SHA-256 over length-delimited, versioned repository/commit
identity. One published directory contains:

```text
<cache>/<key>/
  snapshot.toml
  source/
    kalandra.toml
    ...tracked files...
```

The returned `NativeGitSnapshot` includes its resolved identity, directory,
source digest and parsed `NativePackage`. The library can construct a node for
the [scoped module loader](scoped-package-resolution.md). Two aliases of one node
share nominal declarations; different commits or repositories remain distinct.
Metadata package name/version never selects or merges resolved identities.

`loadLocalGitSnapshot` verifies and loads an existing snapshot without invoking
Git or accessing the original repository. Its request retains the original
normalized path string even when that repository is unavailable. Content hashes
use relative source paths, so changing the cache location does not change source
integrity. This does not make local repository identities portable across machines.

## Object import and materialization

The importer copies bounded loose objects or pack/index/reverse-index/bitmap files
into a private bare object database. It never reads the source repository's config,
refs, hooks, worktree files, replacement refs or attributes configuration. Only
object storage is copied; alternates and promisor markers are rejected. Linked
worktree indirection and symlinks in object storage are rejected.

A fixed `/usr/bin/git` executes read-only plumbing against that private database.
Each process receives an explicit environment with inherited Git settings removed,
system/global configuration disabled, no interactive credentials, no lazy fetch,
no protocols, no hooks, no filesystem monitor and no pager. Arguments are passed
directly to `execve`, without a shell. The repository's source programs are never
executed. System Git itself remains an external trusted tool.

The requested object must be a commit. `git fsck --strict` validates the copied
objects, and `ls-tree -r -z` plus `cat-file blob` materialize raw tracked contents.
No checkout, archive filters, export-ignore/export-subst transformations, clean or
smudge filters, submodule update or package build script runs. Regular executable
files become ordinary non-executable source files. Symlinks, gitlinks/submodules,
unsafe paths and file/directory aliases on the destination filesystem are rejected.
No repository metadata is included in the published source tree.

The manifest must describe a [native library](native-library-manifests.md). Its
metadata and entry paths are validated before publication; the importer does not
type-check the complete application or infer transitive dependency edges.

## Integrity and publication

A versioned SHA-256 digest covers sorted relative file/directory paths and file
contents, with length delimiters. Empty directories and added files affect the
digest; permissions, timestamps and ownership do not. The snapshot metadata has
an exact schema containing format, repository, commit and digest. Loading rejects
source edits, unexpected metadata entries, symlinks and unsupported filesystem
entries. Ordinary reinstallation verifies an existing snapshot and rejects
corruption rather than silently replacing or repairing it.

Import uses private sibling staging. Darwin's exclusive rename publishes only a
complete source/metadata directory and never replaces an existing path. Competing
imports of the same identity verify that the winner has the same digest. Normal
failures clean staging and preserve already published snapshots. Process death
can leave unused staging directories; there is no garbage collector yet. Files
are closed before rename, but fsync/power-loss durability is not promised.

This is snapshot-level publication. Project-wide graph validation, an installation
guard, manifest-change detection and lock/index activation remain separate work.
The cache is writable by its owner: digest verification detects accidental edits,
not coordinated modification of both source and integrity metadata. It is not an
operating-system sandbox or a defense against hostile concurrent filesystem edits.
Build-time source/metadata capture and output protection for managed graphs must be
integrated before exposing project installation.

## Bounds and qualification

Defaults bound copied object-store entries to 8192 and copied bytes to 128 MiB;
materialized source files/directories to 4096 and contents to 64 MiB; Git listings
to 1 MiB; and each Git process to 30 seconds. Output capture is bounded through a
pipe, and rejected or timed-out children are killed/reaped. Callers can lower
these limits. These are per-snapshot/per-command bounds, not an overall graph
installation deadline or a hard child-process memory limit. Untrusted remote
transport qualification must revisit decompression and memory budgets.

Acceptance covers loose and packed bare stores, exact commit identity, raw blob
semantics, unsafe config/environment isolation, invalid revisions/trees/manifests,
corrupt objects, alternates, size/count/capture limits, nonzero-timeout validation,
source/metadata edits, extra files/directories, symlink rejection, no replacement,
staging cleanup, competing processes and loading after the original repository is
removed. Actual timeout expiry and resource exhaustion are not fault-injected.
Path-alias acceptance is qualified on this macOS filesystem.

A manifest-backed graph uses geometry v2 directly and geometry v1 through a
telemetry worker, with all three libraries imported as snapshots. It produces
`[12, 11]` in debug, optimized, ASan/UBSan and TSan programs with one/four workers.
The snapshot importer and graph checking also run under ASan/UBSan. See the
[qualification record](../../native/metal-proof/evidence/native-git-snapshots-2026-10-20.json).

Next: exact dependency declarations and complete managed graph activation, then
CLI/checker/Metal consumption and managed output protection. Remote transport,
mutable Git refs, public locks, frozen/offline install modes, installed tools and
editor onboarding remain in the [package workflow](native-packages.md).
