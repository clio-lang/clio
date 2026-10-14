# Build watch mode

```sh
bun run cli build path/to/main.kalandra -o path/to/out --strict --watch
```

Watch mode builds immediately, then rebuilds when an input changes. It never executes the generated program or starts runtime workers. `--watch` is supported only by `build`, and `-o` remains required.

Each build records source reads, missing import candidates, project and installed-package manifests, JavaScript package metadata/declarations, and resolved external JavaScript entry files. Changes, deletions, or creation of previously missing inputs trigger a new build. Project-root discovery is repeated, so adding, editing or deleting an enclosing `kalandra.toml` updates import resolution. The input set is replaced after every build, including failed builds, allowing missing dependencies and syntax errors to recover without restarting watch mode.

For requested JavaScript packages, watch mode also records candidate package.json files and directory membership under their possible `node_modules` locations. This detects installation of a missing package and newly created entry files when resolution previously failed. Package directory scans skip nested `node_modules`, `.git`, and an output subtree within that package; they do not follow nested symlink directories. Reads of resolved declaration and entry files still follow their actual paths. Each candidate package scan is bounded to 100,000 entries and 64 directory levels; an unreadable or oversized watch tree stops watch mode with an error instead of silently dropping coverage.

## Scheduling and output

The current implementation polls recorded file contents and package directory membership every 200 milliseconds, plus the time needed to scan them. Content hashes avoid rebuilds caused only by timestamps. For manifest-backed projects it also scans the resource tree, hashing ordinary file bytes while excluding `.kalandra` files, hidden entries, `node_modules`, manifests/locks and the selected output subtree. Asset additions, edits and deletions trigger builds. It does not read unrelated Kalandra source files or scan all of `node_modules`. Changes made close together are usually observed in one polling pass. Large inputs or packages can increase latency and disk work.

Builds run sequentially in fresh compiler processes. That keeps JavaScript package-resolution caches from persisting across builds. Changes made while a build is running are compared against the inputs that build read and cause another build afterward. There is no overlapping compilation or cancellation of an active build.

Compilation errors print diagnostics and leave the last successful generated output untouched. Fixing the input causes a new attempt. Successful builds write the normal project outputs. This does not introduce transactional publication for filesystem write failures or forced process termination, and it does not prune old output files when modules leave the graph or the source root changes. Deleted copied assets are pruned only when their output hash still matches the previous copy; manually edited former assets remain. Output-only edits and unrelated Kalandra source files do not trigger rebuilds in the normal separate-output-directory layout.

Ctrl-C or SIGTERM stops polling, lets an active build finish, and removes the watch session's temporary report directory. A normal stop exits successfully even if the latest compilation failed. Fatal watch infrastructure errors exit nonzero. If a build is hung, graceful shutdown waits for it; forcibly terminating the process cannot guarantee complete output writes or temporary-file cleanup.

## Verification

Source and isolated bundled CLI tests exercise source edits, failed-build preservation, deletion/recreation of imports, newly referenced files, changed and invalid manifests, manifest deletion, missing JavaScript package installation, declaration edits, changed package entry resolution, and output-loop avoidance. Additional source tests cover stopping during an active build and invalid command-line combinations. Automatic program restart and OS event-based watchers remain separate work.
