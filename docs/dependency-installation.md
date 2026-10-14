# Installing Clio dependencies

`kalandra install [directory]` reads the nearest enclosing `kalandra.toml`, starting at the supplied directory or the working directory. Git must be available on PATH. In this development workspace, use `bun run cli install /path/to/project`.

```toml
[build]
source = "src"

[dependencies]
"https://github.com/your-team/math.git" = "v1"
```

The example URL is illustrative. This declaration installs into `src/.kalandra/modules/math@v1`. Import its public entrypoint with:

```kalandra
from "math@v1" import double

export fn main: await |double| 21
```

The package's own `kalandra.toml` supplies its source directory. Its dependencies are installed transitively into the same project-level modules directory. Shared dependencies are installed once, and dependency cycles terminate; this does not enable cyclic source imports. The compiler, CLI runner, and language server use the existing installed-package resolver without a new import syntax. Build and run do not automatically install anything.

## Refs and reproducibility

Dependency keys are Git repository locations; values are exact Git tags, branch names, or full commit SHAs. This is not a semver solver. A ref consists of letters, digits, periods, underscores and hyphens, starting with a letter or digit. Slash-containing branch names are currently unsupported. Tags take precedence over branches with the same name. The installed directory is the repository basename without `.git`, followed by `@` and the declared ref. Different repositories that would produce the same directory are rejected.

Supported locations are HTTPS and SSH URLs, SCP-style SSH locations (`git@example.com:team/math.git`), absolute local repository paths, explicit `./` or `../` paths, and file URLs. Relative local paths are resolved against the declaring project's directory; in a local dependency they are resolved against that dependency's original repository directory, not its temporary checkout. Remote packages cannot declare local repository dependencies. Legacy `hub:`/`github:` registry shortcuts, HTTP URLs and arbitrary Git remote helpers are unsupported.

A successful install writes `kalandra.lock` beside the project manifest. Its version-1 JSON records each reachable package's normalized repository location, ref, installed name and exact commit. Commit this file for reproducible fresh installs. A later install reuses those commits even if a tag or branch moves. Existing managed packages are reused without a fetch; local edits in those packages are preserved, not integrity-verified or overwritten. Thus the lock guarantees selected commits for **fresh** installs, not pristine contents in edited package directories.

This initial command has no update, force, add, remove, or pruning mode. Change a dependency's declared ref to select a different version; unused installed directories remain in place. An identity conflict with an existing package or lock entry is an error. Do not expect deleting a lockfile alone to update already installed packages.

## Installation behavior

New packages are cloned into a temporary directory, checked out at the selected commit, and validated before publication. Git metadata is removed. Each installed package receives a `.kalandra-package.json` record; an existing directory without this record is considered unmanaged and is left untouched. The project manifest is never rewritten.

Installation validates manifests and source directories, rejects symlinks and submodules in fetched Git trees, and checks the full dependency graph before moving new packages into place. An ordinary failure removes staged packages and rolls back newly published directories, preserving previous packages and the lockfile. A project-level `.kalandra-install.lock` directory excludes concurrent installers. A process crash or forced termination can leave that guard and staging files; after confirming no installer is running, remove the stale guard before retrying. Publication across several directories is not crash-atomic.

Git runs with argument arrays, disabled hooks, and without global/system Git configuration or templates. It does not prompt for credentials; SSH-agent authentication remains available. No package scripts, npm installs, submodule updates or generated code run during installation. Git operations have a two-minute timeout; graphs are limited to 1,024 unique packages.

This command installs **Clio Git dependencies only**. JavaScript dependencies under legacy `[npm.dependencies]` or `[npm.devDependencies]` are not installed or translated into a package.json. Manage JavaScript dependencies separately with Bun. Remote Clio execution transports remain separate work.

## Porting provenance and checks

The pinned Clio reference (`75c7c09e962ef15506ff9bc7cf856aad727436c5`) declares the URL-to-ref table in `packages/manifest/packageConfig.js`, fetches direct and transitive packages in `dependencies.js`, and names checkout directories `repository@tag` in `utils/fetch.js`. Its `deps get` command accepts a project directory.

Kalandra preserves that declaration format, transitive flat layout, and import names. It repairs working-directory-dependent installation paths, unbounded cycle traversal, concurrent destination collisions and shell interpolation, and adds exact-commit locking and staged publication. It does not reproduce the old installer's manifest rewriting or force deletion.

Tests create local Git repositories and exercise direct/transitive packages, cycles, shared dependencies, lock reuse after moving a tag, conflicts, malformed manifests, rollback, installation guards and symlink rejection. Both the source CLI and isolated bundled CLI install packages and execute an imported function in a managed Bun worker. Real remote hosting/authentication has not been exercised by these tests.
