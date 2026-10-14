# Single-file semantic analysis

Kalandra now resolves lexical names and checks known types on its own AST. The implementation is portable TypeScript and does not depend on Chevrotain, Babel, filesystem APIs, or a runtime host.

## Use

```sh
bun run cli check /path/to/source.kalandra
bun run cli check /path/to/source.kalandra --strict
```

The first command preserves Clio's permissive handling of unresolved host names, reporting warnings and using `Any` for their types. `--strict` turns unresolved-name warnings into errors. Both modes fail on known type errors. Imports without supplied signatures produce warnings in either mode: the CLI does not load dependencies, so strict mode does not certify a complete project.

The compiler API also accepts host bindings and module signatures:

```ts
import { analyze, type SemanticType } from "@kalandra/compiler";

const number: SemanticType = { kind: "Number" };
const result = analyze(
  { path: "example.kalandra", text: "double 21" },
  {
    strictNames: true,
    globals: {
      double: {
        kind: "Callable",
        parameters: [number],
        returns: number,
        async: false,
      },
    },
  },
);
```

`analyzeProgram(program, options)` reuses an already parsed AST. Analysis does not mutate it. Syntax errors prevent semantic analysis; semantic errors still return a model for editor consumers. Check diagnostic severities before using a model for compilation.

The model contains source-node types and bindings, lexical scopes, exported symbols, imported paths, function parameters, closure captures, and async/parallel metadata. Maps use AST object identity, and scope/symbol IDs are local to that analysis run. Readonly interfaces are compile-time contracts; callers should not mutate the model.

## Ported behavior

The source reference remains Clio commit `75c7c09e962ef15506ff9bc7cf856aad727436c5`, primarily `packages/core/types.js`, `packages/core/index.js`, and `packages/core/generator/imports.js`.

- Primitive arithmetic checks preserve the six saved type-error messages: incompatible arithmetic and typed assignment.
- Untyped parameters and unavailable external signatures remain `Any`. Known ordinary assignments now retain their inferred types for subsequent checks.
- `@params` and `@returns` provide parameter and return types. Returns include the final expression, assignments, and conditional branch results. A branch without an `else` includes a possible `Void` result.
- Named records have nominal identity and typed fields. Derived constructor arguments follow Clio's own-fields-first order. Lists check known array element types; empty arrays are compatible with a typed list.
- Calls and mapped pipes check supplied arguments against known signatures. Missing and extra arguments retain JavaScript's permissive arity behavior; this is not a new mandatory-arity language rule.
- Grouped `@parameters` form quick functions, ordered by first occurrence and deduplicated. Nested quick functions have separate parameters and captures.
- Mapped ranges retain `Range` types; `[await]` collects them into arrays. Bare pipe targets retain their callee type so lowering can distinguish constructors from ordinary functions. Bracket indexing follows the committed emitter’s property-lookup behavior.
- `await`, `[await]`, mapped awaiting, and parallel references retain distinct types/effects. Nested functions do not make their enclosing function async. Parallel aliases retain asynchronous callable types when their signatures are known.
- Imports bind aliases and default names. Hosts can supply a `modules` record keyed by the exact import path, with exported names mapped to types. No network or filesystem module resolution occurs here.

Function/type names and local assignment bindings are collected per scope. Direct reads of local variables before initialization are diagnosed; closures can refer to later outer bindings. Duplicate declarations, invalid annotations, cyclic type definitions, invalid exports, and known record-field errors receive source-located diagnostics. Closure captures include outer dependencies needed by nested closures, excluding a function's own recursive reference.

These checks strengthen the old compiler's incomplete bookkeeping. They do not introduce a new syntax, mandatory typing, or a distributed execution policy.

## Coverage and limits

All 177 accepted reference fixtures remain free of semantic errors in compatibility mode, though intentionally incomplete snippets produce unresolved-name warnings. All six original type rejection cases now fail analysis. Additional tests cover scopes, recursion, typed declarations, imports, exports, quick functions, closure captures, and async/map behavior. The real analyzer is included in the browser-targeted bundle smoke test under Bun.

This is gradual, single-file analysis, not whole-program inference. In particular:

- Unannotated forward or recursive return types and later captured values may remain `Any`; there is no inference fixed point or call-site specialization. Annotations supply forward signatures, including syntactically async functions.
- Unknown values remain compatible with specific types. A successful check means no known errors were found, not that every operation was proven safe.
- Hashmaps and dynamic JavaScript members/methods lack structural signatures. General decorators are resolved but their arbitrary effects on function signatures are not modeled.
- Lists are represented structurally by element types; records use nominal identity. Generic types, overloads, subtype inference, and recursive record schemas are not implemented.
- Import signatures are host inputs. Project resolution, dependency cycles, cache behavior, and verifying those signatures against implementations remain future work.
- Closure capture and parallel metadata do not validate transferability or implement serialization, scheduling, cancellation, or remote execution.
- Diagnostics currently use the relevant AST node's span; exact parameter/declaration-name token spans and editor-oriented wording can be refined later.

## Executable target

The [first JavaScript target](javascript-target.md) now lowers the AST and semantic model through a typed intermediate representation into Babel ESM and source maps. Analysis covers more syntax than the emitter: unsupported forms produce diagnostics rather than partially runnable output. The project compiler now supplies export signatures in dependency order for acyclic local imports. Explicit JavaScript package imports accept optional export signatures and CommonJS whole-value signatures. Automatic dependency typing, cycle semantics, runtime integration, and complete language emission remain future work.
