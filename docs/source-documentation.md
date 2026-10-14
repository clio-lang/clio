# Inspect source documentation

```sh
bun run cli docs examples/modules/math.kalandra
bun run cli docs examples/modules/math.kalandra --json
```

Use `docs <file.kalandra> <function>` to select one function by its exact name. The command lists top-level function declarations, including private functions, in source order. Each entry shows parameter names, declared decorators (including `@params` and `@returns`), export status and literal builtin `@describe` text.

This inspects source, not runtime objects. Imports are not loaded, decorators and function bodies are not executed, and no compiled files or caches are written. Missing dependencies do not block inspection. Syntax errors and unknown/ambiguous function names fail with a nonzero exit code. Type errors do not prevent browsing declarations; use `check` or `build` to validate the program. Displayed annotations are not inferred or validated signatures.

Computed descriptions are marked unavailable statically. A locally shadowed `describe` decorator is not builtin documentation. Repeated builtin descriptions use the outermost declaration, matching decorator application order. Custom decorators may change runtime metadata, so this command does not promise the description of an evaluated function.

Nested functions, imported/re-exported functions, and bindings that hold function values are outside this listing. A separately exported local function is marked exported. Files without top-level functions succeed with an empty listing.

`--json` produces an object with `version: 1`, an absolute `file` path and a `functions` array. Entries contain `name`, `exported`, `parameters`, source `decorators`, `description`, `descriptionStatus` (`literal`, `dynamic` or `none`), and a half-open UTF-16 `span`. Failed requests write diagnostics to stderr and no JSON to stdout.

Tools can call the portable compiler's `sourceDocumentation({ path, text })` API for the same declaration data and parser diagnostics. The Tiramisu language documentation and website remain separate from this source-inspection command.
