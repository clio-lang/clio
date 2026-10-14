# JavaScript package declarations

Kalandra project builds and the Bun language server can discover explicit type declarations shipped with JavaScript packages. Resolution reads JSON and never imports or executes the package. This supports the existing `esm:` and `cjs:` import forms; it does not interpret TypeScript `.d.ts` files or infer types from JavaScript.

A package opts in through its package.json:

```json
{
  "name": "example-library",
  "exports": "./index.js",
  "kalandra": { "types": "./kalandra.types.json" }
}
```

The declaration file must be JSON inside the package directory. Discovery follows the resolved JavaScript entry's ancestor package.json with a matching package name, including scoped names and exported subpaths. Bun performs runtime-file resolution; this step does not introduce a separate conditional-exports resolver. Builtins such as `node:path` retain their existing behavior without discovered declarations.

```json
{
  "version": 1,
  "modules": {
    "esm:.": {
      "exports": {
        "double": {
          "kind": "Callable",
          "parameters": ["Number"],
          "returns": "Number",
          "async": false
        }
      }
    },
    "esm:./labels": {
      "exports": { "label": "String" }
    },
    "cjs:.": {
      "exports": {},
      "value": {
        "kind": "Callable",
        "parameters": ["Number"],
        "returns": "Number",
        "async": false
      }
    }
  }
}
```

Module keys distinguish the import mode and package subpath: `esm:.` describes `esm:example-library`; `esm:./labels` describes `esm:example-library/labels`. Each entry requires an `exports` object. ESM default imports use its `default` property. CommonJS `value` describes the whole `module.exports`, allowing callable modules; named destructuring uses `exports`. Only CommonJS entries accept `value`.

## Supported types

Primitive types are JSON strings: `Any`, `Number`, `String`, `Boolean`, `Null`, `Void`, `Object`, and `Function`. More precise types use these objects:

- `{ "kind": "Array", "element": "Number" }`, with `Set`, `Range`, and `Promise` following the same shape.
- `{ "kind": "Union", "members": ["Number", "String"] }`, with at least two members.
- `{ "kind": "Callable", "parameters": ["Number"], "returns": "Number", "async": false }`.

For an async callable, `returns` describes its resolved result and `async` is true. A synchronous function returning a promise can instead declare `returns` as a `Promise` type. Fields are required as shown; unknown fields and unknown type names are errors. Files are limited to 1 MiB of text, 4,096 type nodes and 32 nesting levels. Version 1 does not support records/classes, nominal type identity, constructors, generics, overloads, optional/rest parameters, or declaration imports.

Declarations are author-supplied contracts, not proof that JavaScript implementations obey them. They enable call checking, export checks, hover and member completion. A missing declaration for an import keeps the existing gradual `Any` behavior and warning. An advertised file that is absent or malformed produces `KAL4104` at the import instead of silently reverting to `Any`.

## Parallel boundaries

Concrete declared results can be passed to typed local parallel functions. `Any`, arbitrary objects and unresolved promises remain rejected at Sia boundaries. Declarations do not make imported JavaScript functions eligible as direct parallel targets or create nominal record codecs. Runtime encoding continues to validate values against the compiler's schema, so an incorrect declaration cannot authorize a dynamic serialization fallback.

## Compiler and editor integration

`ProjectHost.resolveExternal` may return its existing string/null result or `{ specifier, exports?, value? }` containing semantic types. Explicit `AnalysisOptions.modules` and `moduleValues` entries take precedence over discovered signatures for that import. Resolutions are per importing module, so different installed versions do not share a global signature table. The portable compiler still performs no filesystem access. CLI single-file `check` and `compile` retain their existing supplied-signature behavior; discovery applies to project `build`, `run`, and the Bun file language server.

The project result captures external resolutions for editor rename validation. Renaming a local explicit alias preserves its external export contract and does not edit the declaration file. JSON buffers supplied to the language server are configuration overlays, not Clio source files; unsaved package.json and declaration edits participate in analysis. Declaration overlays also match Bun's canonical package paths when filesystem aliases differ. Save and client watched-file notifications refresh diagnostics. As before, the server does not install its own watchers.

Graphs that resolve JavaScript packages are freshly analyzed for references and rename, including metadata reads, rather than reused from the session cache. This intentionally avoids stale package metadata, including newly added declarations or changed package resolution. Clio-only graphs keep their existing validated cache. More granular metadata caching can follow measured performance needs.

## Provenance and verification

Pinned Clio's `packages/core/generator/imports.js` (`75c7c09e962ef15506ff9bc7cf856aad727436c5`) emits JavaScript imports without discovering export signatures. The versioned declaration format is an explicit extension of Kalandra's existing host-supplied `modules` and `moduleValues` contracts, not a historical Clio declaration syntax.

Tests cover ESM exports and subpaths, callable CommonJS values, malformed declarations, non-execution during build, disk and unsaved declaration edits, alias rename replay, and strict rejection of `Any`/promise parallel arguments. The isolated built CLI checks declared calls and runs a concrete result through a managed Bun worker. Source and bundled LSP checks exercise hover, rename and diagnostics after declaration changes.
