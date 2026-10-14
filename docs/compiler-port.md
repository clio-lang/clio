# Compiler port: syntax baseline

The first milestone ports Clio syntax directly to strict TypeScript and Chevrotain. It preserves the language while replacing the implementation. Language redesign and optimization come after compatibility, rather than becoming prerequisites for the port.

## Reference and provenance

The baseline is committed Clio `75c7c09e962ef15506ff9bc7cf856aad727436c5` (v0.12.0, 2021-10-11), specifically `packages/core/tests/clio.test.js` and its six example files. This is the available committed reference, not an assertion that it is the abandoned 2018 version.

`tests/fixtures/clio/corpus.json` preserves 177 accepted cases with their original expected JavaScript, 12 rejected cases with their original expected errors, and the names of three deferred project-level tests. The old compiler is not executed by the new test suite. Saved JavaScript expectations now support differential execution tests for selected forms. See the [JavaScript target](javascript-target.md) and [31-fixture project-context audit](compatibility-audit.md); not every saved output has behavioral coverage.

Regenerate from a trusted Clio checkout, without importing its working-tree edits:

```sh
bun scripts/import-clio-fixtures.ts /path/to/clio
bun run format
```

The importer evaluates upstream test declarations in a limited context; use it only with trusted repositories and revisions. The default is pinned to the full commit hash above.

The local Clio checkout also contains unfinished lexer/grouping, decorator, hashmap/precedence, transport-import, and parser-experiment changes. These are separate follow-up evidence, not the baseline. The retired `/Users/pouya/Projects/kalandra` implementation is excluded entirely.

## Implemented pipeline

In-memory source → Chevrotain tokens → indentation/adjacency processing → Chevrotain CST → Kalandra AST → structural syntax validation.

The public `parse({ path, text })` API returns diagnostics and, on success, an independent AST. It has no filesystem or host dependencies. `tokenize` additionally exposes tokens and comments for tooling. AST nodes and diagnostics use half-open UTF-16 source offsets, with original comments and raw literal spellings retained. Recovered CSTs are not exposed as successful ASTs.

```sh
bun run cli parse /path/to/source.kalandra
```

The command prints the AST as JSON. Syntax failures produce diagnostics on stderr and a nonzero exit status. The CLI requires `.kalandra` source files. In-memory parser tests retain original historical filenames as diagnostic metadata. It neither resolves imports nor checks types nor emits JavaScript.

## Grammar inventory

| Family           | Ported syntax and representation                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Lexical/layout   | Numbers, double-quoted strings, identifiers, parameters, comments, indentation, CRLF, blank lines, arithmetic and pipe continuations |
| Expressions      | Grouping, arithmetic, right-associative powers, chained comparisons, `not`, `and`, `or`, membership                                  |
| Application      | Whitespace arguments, empty group for zero-argument calls, member and method references, `@` quick-function parameters               |
| Collections      | Arrays, sets, hashmaps, nested/indented hashmaps, ranges with omitted endpoints and steps, adjacent slices                           |
| Flow             | Pipes, mapped pipes, flow assignments, parallel references, `await`, `[await]`                                                       |
| Declarations     | Functions with inline or block bodies, nested functions, conditionals, ordinary and typed assignments                                |
| Modules/types    | Imports and aliases including wildcard imports, exports, type inheritance and fields, list declarations                              |
| Metadata/strings | Ordered decorators, tagged formatted strings, interpolation and quick-function parameters within interpolation                       |

Quick functions, empty call groups, and chained comparisons are lowered and tested. Project builds execute a constrained subset of parallel references through managed task modules; typed module captures and nested scheduling are supported, while arbitrary function-local parallel targets remain pending. Parsing an import scheme does not implement that transport.

## Compatibility evidence and boundaries

- All 177 positive reference fixtures parse and produce ASTs with valid source bounds.
- Six syntax/lexical rejection fixtures fail. The other six rejection fixtures remain syntactically valid and now fail the separate semantic-analysis pass.
- Three project tests (module resolution and compilation-cache behavior) remain deferred.
- Additional structural assertions cover grouping, calls, precedence, block boundaries, map nesting, imports, decorators, flow, interpolation, comments, and source locations.
- Malformed-source checks and deterministic bounded fuzz tests exercise diagnostics and repeated parser use.
- The [browser verification harness](browser-verification.md) executes the compiler and generated JavaScript in Chromium and a module worker. The [browser runtime adapter](browser-runtime.md) also executes managed typed parallel programs, including nested tasks and cancellation.

Acceptance of the old corpus is syntax coverage, not proof of complete language or execution compatibility. The AST explicitly groups `%` with multiplication and `and` before `or`, following the JavaScript operator behavior of the old emitter. Future emission tests must verify behavior, not require identical formatting of generated JavaScript.

Existing whitespace-sensitive keyword recognition, adjacent slices, and the same-indent nested-function body in the old fixture are retained. Richer quoted expressions inside interpolation, full trivia attachment for formatting, adversarial nesting limits, incremental parsing, and editor-oriented diagnostic wording are not covered by this milestone.

## Semantic milestone and next work

Single-file resolution and type checking are now implemented, including the six original type rejection cases. See [semantic analysis](semantic-analysis.md) for the API, scope/type behavior, evidence, and limitations.

An [executable vertical slice](javascript-target.md) now lowers through a typed intermediate representation to Babel ESM and source maps. Expand until the saved JavaScript expectations and runtime behavior are accounted for. Inventory the old runtime and unfinished changes before selecting any intentional divergence.
