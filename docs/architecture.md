# Architecture decisions

## Accepted foundation

- Work starts in `kalandra.dev`. Do not import the retired reactive-component Kalandra project.
- Clio is a behavioral reference and source of examples, not code to copy wholesale.
- Bun manages the workspace and runs development commands. Use Bun's native test runner with fast-check; this replaces the earlier Vitest proposal for the Bun-first setup.
- TypeScript with strict checking implements the toolchain. Compiler, runtime, and protocol contracts have no ambient Bun or Node types.
- Chevrotain implements the lexer and parser. Preserve committed Clio behavior while replacing implementation components; postpone language redesign until compatibility is established.
- Keep Kalandra's syntax tree, resolution, type checking, and typed intermediate representation independent from Chevrotain and Babel.
- Babel types and generator produce JavaScript ESM and source maps.
- Language services consume in-memory source through the shared compiler; filesystem operations belong in host adapters.
- Use `@timeleap/sia` 2.3.0 behind a protocol boundary. Compiler-derived concrete descriptors drive versioned task frames; see [Sia protocol v3](sia-protocol.md).
- Use Tiramisu Docs and SvelteKit for the website and documentation. The current scaffold produces static output.

## Intended pipeline

Source → tokens / concrete syntax tree → Kalandra syntax tree → resolution / type checking → typed intermediate representation → JavaScript syntax tree → ESM + source maps.

Tokens, CST, the independent Kalandra AST, and single-file resolution/type checking are implemented. The semantic model records types, bindings, captures, and effects. Typed lowering and Babel ESM emission are implemented for the [first executable subset](javascript-target.md); full language emission remains pending. Preserve comments and source locations for formatting and diagnostics. Compilation must work in a browser worker without filesystem access.

## Runtime and protocol

Separate worker scheduling from serialization and transport. Define supported values, request lifetime, errors, cancellation, queue limits, worker failure, and version negotiation before remote execution. Avoid automatic retries of calls that may have side effects.

Compiled task envelopes use Sia with explicit float64 Number and UTF-16 String codecs, owned buffers, and bounded decoding. Unknown or unsupported boundary types fail compilation; no dynamic fallback is generated. Routing remains independent of Sia decoder internals.

Bun is the initial development host. Exported module tasks now execute in bounded Bun subprocess workers. Busy-loop termination probes did not establish reliable worker-thread cleanup, so the first adapter uses confirmed process exit. Thread and browser support remain unverified. See [local runtime](local-runtime.md).

## Open decisions

Post-compatibility language changes; typing evolution; nested task closures; mutation; transferable values; network negotiation and additional schemas; package names and publication; production runtime support; deployment destination.

## Scope of the scaffold

The compiler exposes in-memory parse, analysis, lowering, compile, and asynchronous compileProject APIs. The project host supplies source text; the compiler itself does no filesystem IO. The CLI can print an AST, check names and known types, build local module graphs, or compile the supported subset to native ESM with source maps. See [semantic analysis](semantic-analysis.md) for gradual typing and module boundaries. Other packages expose initial contracts. Tests cover the committed Clio syntax corpus and explicit AST shapes alongside toolchain compatibility. See [compiler port](compiler-port.md) for evidence and limits. The managed program runner connects project parallel calls to bounded Bun subprocess workers. Task modules contain extracted function definitions without replaying application initialization. Explicitly typed module data is snapshotted at dispatch and reconstructed in a fresh per-task scope, including private data in transitive imported helpers. Nested tasks use per-invocation dispatch scopes and central admission; occupied workers can cooperatively execute descendants without increasing the process limit. Root deadlines, cancellation, and failures cover the whole task tree. The formatter, LSP, nested task closures, and distributed runtime remain unimplemented.
