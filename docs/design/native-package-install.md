# Exact local dependency installation

The native tools now support `[dependencies]`, `kalandra install --project`, and
an activated package graph for compiler/checker/Metal source builds. This initial
transport accepts **local Git repositories and exact SHA-1 commits only**. HTTPS,
SSH, mutable refs, public locks and registry/version solving remain later work.

## Declare and install

An application declares aliases independently of library metadata names:

```toml
format = 1

[project]
entry = "src/main.k"

[dependencies]
geometry = { git = "/absolute/path/to/geometry", rev = "0123456789abcdef0123456789abcdef01234567" }
```

Replace the illustrative path and ID with a canonical absolute repository path
and its full lowercase 40-digit commit ID. `git -C /absolute/path/to/geometry
rev-parse HEAD` can identify a commit. A managed library declares its own
`[dependencies]` in the same format. Tags, branches, abbreviations, remote URLs,
relative repository paths, unknown request fields and alias conflicts with
`[packages]` are rejected. The parser validates declarations without opening Git
repositories or installing anything.

```sh
kalandra install --project my-app/kalandra.toml
kalandra-check --project my-app/kalandra.toml
kalandra --project my-app/kalandra.toml -o my-app/program
```

Installation requires an application `[project]` entry; libraries are installed
transitively through their public `[package]` entries. Libraries can also supply
example applications using both tables. The source imports remain ordinary bare
aliases. Each library resolves through its own declared dependencies and private
local mappings, so different versions retain distinct nominal types. Repeated
aliases of one repository/commit share a node. Workspace `[packages]` and extra
CLI `--package` mappings belong only to the workspace owner in a managed graph;
they cannot override managed dependency aliases or leak into library scopes.

## Activation and offline builds

Generated state lives beside the manifest:

```text
.kalandra/
  install.guard
  installed.toml
  snapshots/<identity>/snapshot.toml
  snapshots/<identity>/source/...
```

Keep `.kalandra/` out of version control. `installed.toml` is a **private local
activation index**, not the planned portable `kalandra.lock`. It binds the exact
manifest bytes to selected repository/commit identities and snapshot digests.
The index has a strict versioned schema and deterministic ordering. Cache paths
are derived, not accepted from index data.

The installer obtains a nonblocking project guard, imports/verifies every declared
transitive snapshot and checks entry availability, alias scopes, dependency
cycles/depth and reachable source imports. It validates syntax/import structure,
not the complete language semantics or GPU execution capabilities. New snapshots
can be published before activation; a failed graph leaves them unused and retains
the previous index. An active graph never depends on partial snapshot staging.

The index is staged privately and atomically renamed last. Before activation,
the installer checks that the manifest and prior index still match its captured
inputs. Concurrent cooperating installers fail clearly on the held guard. A build
reads one complete index generation, verifies each selected digest and reconstructs
package scopes without Git access. Existing published snapshots are retained, so
publishing a newer generation does not remove older build inputs.

Editing the manifest, even a comment, requires explicit reinstallation. Editing
source alone does not. Compiling/checking never fetches, installs, repairs cache
files or activates a graph. Missing, stale, malformed, incomplete or corrupted
state fails before output publication. Existing snapshots can be reused during
installation even when their original repositories are unavailable; this does
not add a separate `--offline` mode. `--offline` and `--frozen` are not accepted yet.

Snapshot digests cover all source files/directories, and the activation index
anchors those digests independently of per-snapshot metadata. Extra/missing
activation records and conflicting digests are rejected. Relocating an application
with its cache works while keeping its declared repository identities unchanged;
local absolute repository declarations are not portable across machines.

## Output protection and boundaries

Project builds reserve the `.kalandra` namespace and reject output aliases to
published cache files, including metadata, guards, unused snapshots and older
generations. Direct paths, symlinks and hard links are checked for CPU executable,
LLVM/MLIR and Metal source-emission outputs. Private staging is skipped during
cache traversal because concurrent installers can remove it; output paths spelled
inside the cache remain forbidden. Existing source/manifest protection still applies.

New cache directories are private to the user. Existing directory permissions are
not rewritten. Normal failures clean activation staging. A terminated process can
leave unused staging files or snapshots; cleanup/pruning is later work. Files are
closed before rename, but fsync/power-loss durability is not promised. The guard
coordinates installers, not arbitrary hostile local edits; this is not a filesystem
sandbox or a defense against coordinated source/metadata tampering by its owner.

Defaults bound the graph to 64 unique packages, dependency depth to 32, aggregate
source entries to 32768 and source bytes to 128 MiB, and index bytes to 1 MiB.
Existing per-snapshot and compiler module/source budgets also apply. Output-alias
scanning is bounded over persistent cache entries, so accumulated old generations
can eventually require explicit cleanup. The resolver counts shared nodes once
and retains path-height checks when a cached node is reached through a longer path.

The native language server currently rejects managed dependency projects with an
explicit message instead of flattening their scopes. Use `kalandra-check --project`
for package-aware checking until editor integration is qualified. Formatting a
source file remains independent of dependency installation.

## Qualification and follow-ups

Acceptance covers public installation, shared aliases, transitive versions and
workers, JSON/stdin checking, malformed declarations, stale/corrupt state, failed
child resolution, held guards, manifest changes during staging, deterministic
activation, source/cache alias protection, offline builds and project relocation.
Generated workers run in debug, optimized, ASan/UBSan and TSan modes with one/four
workers; importer/resolver/checker paths and smaller budgets run under ASan/UBSan.
Metal acceptance covers managed numerical imports and source emission/protection
without GPU execution. The relocated CPU bundle also installs an exact dependency
and builds workers with the original repository absent.

See the [qualification record](../../native/metal-proof/evidence/native-package-install-2026-10-20.json).
Remaining work includes remote Git transport and its resource qualification,
mutable refs/public locks, explicit frozen/offline modes, broader failure and
crash qualification, installed Metal execution and package-aware editor support.
