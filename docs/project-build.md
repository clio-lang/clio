# Project builds and JavaScript interop

Kalandra now builds acyclic graphs of local Kalandra modules. The compiler resolves dependencies, checks callers against exported types, and produces native JavaScript ESM plus source maps. Building never executes source code.

```sh
bun run cli build examples/modules/main.kalandra -o dist/examples/modules
bun dist/examples/modules/main.kalandra.mjs
```

The example prints `[0, 2, 4, 6, 8]` and `Point: 3, 4`. It imports a decorated function and a record constructor from `math.kalandra`. The compiler warns about the undeclared host global `console`.

For continuous compilation, add `--watch`; see [watch mode](watch-mode.md) for tracked inputs, error recovery, and shutdown behavior.

## Resolution and output

For `build` and `run`, the CLI searches upward from the entry file's directory for the nearest `kalandra.toml`. Its `[build].source` determines the source root, relative to the manifest directory. Discovery depends on the entry, not the current working directory. With no enclosing manifest, the entry file's directory remains the source root. Relative imports (`./`, `../`) resolve from the importer and stay within that root. Leading `/` resolves from the source root, or from an installed package's source root when used inside that package. File candidates precede folder entrypoints: `./math` tries `math.kalandra`, then `math/main.kalandra`; `./math.kalandra` tries that file, then directory entrypoints under `math.kalandra/`. A directory is not treated as a readable source file.

Bare names denote installed Kalandra packages, **never nearby files**. `import "math"` reads `.kalandra/modules/math/kalandra.toml`, uses its `[build].source` directory, and loads its entrypoint. `from "math/helpers" import double` uses the same file-before-folder search in that source directory. Package entries resolve to `<source>/main.kalandra`. Transitive package imports share the project source root's `.kalandra/modules` directory; there is no ancestor search or npm fallback.

Package manifests must declare a nonempty relative `build.source` contained within the package directory. Missing packages/manifests, invalid TOML and invalid source paths are diagnostics. No build installs dependencies, fetches modules, evaluates package code, or requires legacy `build.destination`/registration metadata. Explicit `esm:` and `cjs:` imports still select JavaScript packages as described below.

Run `bun run cli run examples/packages/main.kalandra --strict` for a bare-package import executed in a managed worker; it returns `42`. The source root must contain the installed package tree. An enclosing project manifest can now establish that source root for nested entry files.

The reference rules come from pinned Clio `packages/core/generator/imports.js` (`getImportPath`, `resolveModule`, relative/absolute resolution) and `packages/manifest/config.js` (`MODULES_PATH = ".clio/modules"` in the historical code). One legacy inconsistency is repaired: candidate lookup used the importer's `build.source`, while subsequent compilation used the package's own manifest. Kalandra uses the package's own `build.source` consistently, including different source-directory names. Directory candidates are skipped rather than attempting to compile a directory. Neither repair changes bare names into local imports.

Named imports, aliases, namespace imports, and re-exports work. Combining named imports with `* as rest` excludes the selected names from the rest object, matching Clio's saved destructuring output. Local named bindings are snapshots; whole local namespace imports use native ESM namespace objects. Source export signatures propagate to callers, including records, decorators, and async functions. Dynamic custom decorators still exceed what gradual type analysis can prove.

Each source emits a `.kalandra.mjs` file and a `.map` sidecar. Paths retain the source hierarchy. Unusual filename segments are encoded into deterministic ASCII names to avoid differences between JavaScript hosts when handling URL escapes; original filenames remain in source maps. The returned entry path, or the path printed by the CLI, identifies the generated entry module.

One `.kalandra/runtime.mjs` helper module is shared throughout a build. This preserves `Range` and `Any` identity across imports. Modules initialize once under native ESM, and top-level awaited dependencies finish before their importers. This replaces the old Clio runtime-factory boundary; old generated `.clio.js` files are not interoperable with this output.

Install declared Git dependencies with `kalandra install`; see [dependency installation](dependency-installation.md) for the manifest format, versioned import names, and commit locking. Builds themselves never fetch dependencies.

## Project manifests

For a project with `kalandra.toml`, `src/nested/main.kalandra`, and `src/value.kalandra`:

```toml
[build]
source = "src"
```

Both `kalandra build src/nested/main.kalandra -o out` from the project directory and `kalandra build main.kalandra -o ../../out` from `src/nested` use the same source root. `/value` resolves to `src/value.kalandra`; `../value` works from the nested entry; installed packages live in `src/.kalandra/modules`. Output retains the source-relative hierarchy (`out/nested/main.kalandra.mjs`). Use `bun run cli` in place of `kalandra` when invoking the CLI from this development workspace.

The nearest manifest wins, including nested projects. Invalid TOML, missing/empty/non-string `build.source`, absolute or escaping source directories, and entries outside the configured source root fail before output is written. An invalid nearest manifest does not fall back to a parent. `source = "."` is supported. Paths are checked lexically; symlinks are not a filesystem sandbox.

`build` still requires `-o`, resolved from the working directory; legacy `build.destination` is not used. `run` still builds into a temporary directory. The project manifest is protected by the output collision checks. This step does not install packages, discover an implicit entry file, change single-file `parse`/`check`/`compile`, or install filesystem watchers. The language server shares these manifest rules, with unsaved configuration overlays and its existing workspace-root fallback when no manifest exists; see [language-server behavior](language-server.md). The portable compiler still receives its root through its host; filesystem discovery belongs to the Bun hosts.

## JavaScript packages

```kalandra
import "cjs:express"
from "esm:some-package" import value as importedValue
from "esm:node:path" import basename
```

The dependency-free host-builtin example can be built with `bun run cli build examples/package-imports.kalandra -o dist/examples/interop` and run with `bun dist/examples/interop/package-imports.kalandra.mjs`; it prints `kalandra.mjs`.

Use installed dependencies or host builtins. Scoped packages and exported package subpaths are supported. Prefixes preserve the saved Clio behavior:

| Import                                                   | Runtime meaning                                                                   |
| -------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `import "esm:pkg"`                                       | The package's default export                                                      |
| `from "esm:pkg" import name`                             | A native, live ESM named binding                                                  |
| `from "esm:pkg" import * as ns`                          | The complete ESM namespace, even when combined with named imports                 |
| `import "cjs:pkg"` or `from "cjs:pkg" import * as value` | The native default import, normally `module.exports`                              |
| `from "cjs:pkg" import name * as rest`                   | Snapshot properties of the default value, with selected keys excluded from `rest` |

The `cjs:` prefix retains the old compiler's native default-import lowering; it does not call `require` or force a package's `require` export condition. Actual interop follows the JavaScript host. Relative JavaScript files and URLs are not accepted under these package prefixes yet.

Single-file `compile` leaves package specifiers in its output; the consuming JavaScript host or bundler resolves them. `build` uses Bun's non-executing resolver from each source file's directory. Missing packages stop the build before output is written. Installed packages are referenced by absolute file URLs, so output can run outside the source directory on the same machine; it is not a relocatable deployment bundle. Host builtins retain their `node:` specifiers. Browser consumers must use browser-compatible dependencies and their own resolution/bundling strategy.

Export signatures are optional and never inferred by executing dependencies. Project builds and the language server now discover [package-supplied JSON declarations](javascript-types.md) through `package.json` `kalandra.types`. `AnalysisOptions.modules` supplies exported property types; an ESM default import uses the `default` entry. `moduleValues` supplies the whole CommonJS export value, including callable types. Without signatures, imported values remain gradual `Any` with a warning; `--strict` still checks lexical names rather than claiming full dependency type safety. Missing ESM exports are checked when signatures are supplied, otherwise by the JavaScript loader.

## Portable API

```ts
import { compileProject } from "@kalandra/compiler";

const sources: Record<string, string> = {
  "main.kalandra": 'from "./math" import double\nexport answer = double 21',
  "math.kalandra": "export fn double x: x * 2",
};

const result = await compileProject(
  "main.kalandra",
  {
    async readSource(path) {
      return sources[path] ?? null;
    },
  },
  { strictNames: true },
);

// result.output exists only when the entire graph has no errors.
// result.output.entry identifies the emitted entry file.
// result.output.runner identifies the managed invocation entry.
// result.output.files maps relative output paths to code and optional maps.
// result.sources retains loaded source text for diagnostic presentation.
```

`analyzeProject(entry, host, options)` uses the same graph loading and cross-file semantic checks but returns diagnostics, sources, and semantic module metadata without output. `result.modules` maps paths to their AST, semantic model, and resolved local dependency edges for editor navigation. It stops before parallel validation, lowering and emission. The language server uses this API with unsaved-buffer overlays.

Installed-package builds additionally require a non-executing `parseKalandraManifest(text)` host hook returning the parsed TOML object. Bun CLI and LSP hosts use `Bun.TOML.parse`; portable/browser hosts supply their own parser. All manifest text is loaded through `readSource`, so missing-file and cache semantics are shared with source reads. Return null for missing paths or directories. `result.manifests` retains these inputs separately from compilable `result.sources`; manifests are protected by CLI output-collision checks and are not emitted or renamed.

The host may also provide `resolveExternal(dependency, importer)`, returning an output import specifier, `{ specifier, exports?, value? }` with semantic signatures, or `null` for missing dependencies. It receives `{ kind: "esm" | "cjs", specifier }` and the importing source path. Without that hook, the compiler preserves the bare package specifier. Resolution must not execute dependencies.

The host supplies source text by root-relative POSIX path; `null` means missing and rejected reads become diagnostics. The compiler caches reads within a build, performs no filesystem IO, and does not evaluate the program. In-memory project compilation is verified in Chromium; loading a generated multi-file graph in a browser remains unverified. See [browser verification](browser-verification.md).

## Remote service artifacts

`build <entry.kalandra> -o out --service calculate=exportName` selects an exported function as a service and emits `kalandra.deployment.json` and `kalandra.client.json` alongside the compiled graph. Repeat `--service` for additional public IDs. The compiler derives concrete argument/result signatures and Sia schemas, generates task companions even without parallel callers, and assigns a deterministic SHA-256 build revision. Compilation never evaluates service modules. Explicitly typed module captures with pure initializers are supported through a server bootstrap; effectful setup and dynamic service signatures remain rejected. This option is currently unavailable with `--watch`; contract-backed remote imports are supported, and the Bun CLI can host deployments and bind clients. See [remote execution](network-execution.md) for the API, formats and limits.

## Boundaries

- `KAL4101`: invalid or missing paths and host read failures.
- `KAL4102`: import cycles, with the dependency chain. Cycles remain deliberately unsupported until type checking and initialization semantics are specified.
- `KAL4103`: unsupported import paths, including invalid external specifiers and legacy `ws:` transports.
- `KAL4104`: missing JavaScript packages or external resolver failures.
- Nested imports remain unsupported. Imports belong at module scope in this milestone.
- `KAL4201`: unsupported parallel targets or captures. Module-level functions with supported explicitly typed data captures, including named imports, re-exports, and immutable namespace members from local Kalandra modules, support parallel calls; see [local runtime](local-runtime.md).
- `KAL4202`: a parallel call lacks supported concrete argument/result types, uses an arbitrary decorator, or lets a parallel handle escape static call checking. These errors apply even without strict-name mode.
- `KAL4301`: invalid service selection, unsupported capture initialization, duplicate routes or unsupported manifest generation.
- `KAL4302`: invalid remote contract resolution/manifest or dynamic use of a remote namespace. `remote:./contract.json` imports load trusted local client contracts, check concrete call arguments and emit `kalandra.remotes.json`; host endpoint bindings are supplied separately at runtime.
- Membership and the other remaining single-file limitations still apply.

The compiler returns no partial output when any module has an error. The CLI checks all destination identities before writing, rejects source-file and output-file collisions, and leaves previous output untouched on compiler errors. Filesystem writes are not an atomic directory transaction; IO failures can leave partial output. Existing unrelated or stale files are not removed. The output is a development build, not a published package layout.

`compile` and `check` remain single-file tools; explicit JavaScript package imports are supported there. Use `build` for dependency resolution and cross-file checks. Use `run <entry.kalandra> [--strict] [-- arguments...]` to build temporarily and invoke exported `main` with managed parallel workers. Watch mode and explicit package signatures are available. Cycle support, broader declaration inference, and production TLS deployment remain pending.

## Kalandra project identity

Kalandra is a new beginning with no Clio migration contract. Source files use `.kalandra`, manifests use `kalandra.toml`, installed dependencies use `.kalandra/modules`, and the lockfile is `kalandra.lock`. There is no `.clio` source, manifest or package-directory fallback. Package entrypoints are `main.kalandra`; extensionless local imports try a file before a directory entrypoint.

Generated modules and source maps retain the source basename, for example `main.kalandra.mjs` and `main.kalandra.mjs.map`. The host manifest hook is `parseKalandraManifest`. The pinned Clio corpus remains immutable historical evidence; test adapters supply Kalandra paths explicitly. This does not promise compatibility with old projects or change the separately deferred language-design decisions.

## Build resources

With a project manifest, CLI `build` and `run` also copy regular files under `build.source` to the same relative output paths, preserving binary bytes. For example, `src/assets/logo.png` becomes `out/assets/logo.png`. The compiler API itself still emits code; resource copying belongs to the CLI. Standalone-file builds do not scan for assets.

The scan excludes `.kalandra` files, hidden entries, `node_modules`, `kalandra.toml`, `kalandra.lock` and the selected output subtree. Asset symlinks are rejected. Output symlinks at or below the destination and collisions with generated files are rejected before writing. Output cannot equal or contain the source root. Permissions and empty directories are not copied. Scans are bounded to 100,000 entries and 64 levels.

`.kalandra-assets.json` in output tracks copied resources. Successful rebuilds remove deleted source assets only when the output bytes still match the previous copy; manually edited former assets and unrelated output files remain. Keep that generated index if you want deletion tracking across builds. Compilation errors preserve prior output; filesystem write failures are not transactional. [Watch mode](watch-mode.md) also tracks asset additions, edits and deletions.
