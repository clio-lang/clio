# Native library manifests

A native format-1 manifest can declare a public library entry with `[package]`:

```toml
format = 1

[package]
name = "geometry"
version = "0.2.0"
entry = "src/public.k"
```

The entry is an ordinary `.k` module using explicit exports and re-exports.
`name` follows the existing case-sensitive ASCII package-name rules: a letter or
underscore first, then letters, digits, underscores or hyphens. `version` is a
SemVer string, including optional prerelease and build identifiers. Numeric core
and prerelease components cannot have leading zeroes; numeric build identifiers
can. Version components are validated as text without an arbitrary machine-integer
size limit. Metadata versions do not select Git commits or merge package identities.

## Libraries with example applications

A library can also supply an application entry:

```toml
format = 1

[package]
name = "geometry"
version = "0.2.0"
entry = "src/public.k"

[project]
entry = "examples/main.k"
```

The compiler and checker select `[project].entry` for `--project` invocations.
A manifest containing only `[package]` cannot accidentally become an executable;
it reports that a project entry is required. Library loading selects the public
`[package].entry` and retains the optional example entry separately. Both tables
are validated when present: a valid application does not hide invalid library
metadata.

A declared public entry is protected from output replacement when building the
example, even if the example never imports it. CPU executable/LLVM/MLIR outputs
and Metal source-emission outputs reject source or manifest aliases through
symlinks and hard links before publishing files.

## Paths, local mappings and validation

Library paths resolve from the canonical manifest directory, including when the
manifest itself is reached through a symlink. Public entries and optional
`[packages]` local-file mappings must remain within that directory. Existing
symlink escapes are rejected using canonical containment checks. Missing source
files are permitted during metadata loading; `.k` contents are not read until
the module loader visits them. The example application's entry keeps the existing
project path rules. Application-only manifests retain their existing explicit
parent-relative source and local-mapping behavior.

`[packages]` maps names to local `.k` paths; it is distinct from the proposed
`[dependencies]` Git table. Unknown fields, wrong types, invalid names/versions,
retired extensions and escaping library paths are errors. Diagnostics locate
invalid fields in the original TOML file. The existing 256 KiB manifest and 128
local-mapping limits apply; API callers can lower them. Reads are fresh, with no
manifest cache, source execution, dependency installation or network access.

## Scoped compiler integration

`loadNativePackage` returns canonical manifest information, name/version, public
entry, optional application entry and local mappings. `NativePackage::node`
constructs an explicit `PackageNode` for the
[scoped offline loader](scoped-package-resolution.md). The resolver must supply
its resolved identity and dependency edges. Graph validation still rejects alias
collisions, duplicate identities, dependency cycles and out-of-bounds targets.
Each node's local mappings remain private to its owner.

Acceptance now constructs the geometry-v1 / geometry-v2 / telemetry graph from
real library manifests. A workspace calls geometry v2 directly and geometry v1
through a telemetry worker, producing `[12, 11]` in debug, optimized and sanitizer
configurations. This qualifies the metadata-to-scoped-loader path; it does not
claim automatic dependency discovery through CLI mappings.

Managed graph construction for CLI/editor builds, `[dependencies]`, Git snapshots,
installation, integrity metadata and lockfiles remain in the
[native package workflow](native-packages.md). The CLI's existing `--package` and
`[packages]` mappings retain their global local-file behavior until managed
resolution is connected. No version solver or public native ABI is introduced.

The [qualification record](../../native/metal-proof/evidence/native-library-manifests-2026-10-20.json)
records the selected checks. Metal qualification here covers source emission and
output protection, not new GPU execution or scoped managed Metal dependencies.
