# Port completion and revival release

This is the active priority order agreed with the project owner:

1. Finish verified missing implementation to reach the working capabilities of pinned Clio.
2. Finish the Tiramisu documentation and website, apply small polish, and prepare the revival release.
3. Publish Kalandra at the chosen distribution destinations and kalandra.dev, then announce the revival.
4. Address deferred language flaws and develop new capabilities after the revival release.

The project owner has secured the `kalandra` npm organization; release packages will use the `@kalandra` scope. Package publication and access configuration remain release work.

No Clio migration layer is required. Bun, Chevrotain, native ESM, Sia 2 with float64 Number, strict serialization boundaries and `.kalandra` source files remain accepted changes. Historical defects do not authorize redesign during this phase. Publication and announcement content/destinations will be prepared for review during the release phase, not inferred now.

## Implementation queue

| ID        | Status                                  | Capability and evidence                                                                                                                                                                                                                                                                                            | Acceptance requirement                                                                                                                                                                                                                                              |
| --------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PORT-001  | Implemented                             | Decorated direct self-tail calls. The restored pinned compiler compiled and executed synchronous, checked, custom-decorated and async probes at 100,000 iterations. Its custom wrapper ran once. Kalandra previously used recursive calls.                                                                         | Match `5000050000`, wrapper count 1, metadata and async completion; keep non-tail and shadowed calls ordinary. Differential tests and isolated built CLI check.                                                                                                     |
| PORT-002  | Implemented                             | Local `emitter()` and its listener operations. The restored pinned compiler and original EventEmitter runtime executed `on`, `emit`, `off`, `emit`, producing `[7]`. Kalandra now implements local listener behavior; source and bundled CLI checks run events inside managed workers.                             | Port local listener behavior with differential tests for ordering, removal, regex listeners, `emitUnless`, returns and failure behavior. Keep emitter objects outside Sia boundaries; investigate distributed event support separately.                             |
| PORT-003  | Classified for probed scope             | Original TCP evidence covers service chaining, local use of remote handles, startup-created function-local targets and live event channels. Runtime-created local targets and function transfers timed out; duplicate closure registrations collide.                                                               | PORT-003a/b/c complete within their verified scopes. Live emitter/function serialization remains excluded. Do not infer broader RPC parity from these probes.                                                                                                       |
| PORT-003a | Implemented                             | A compiled old relay service imports and calls another service: input `5` returns `6`; a nested parallel call returns `7` for input `6`. Kalandra now emits outbound contract metadata and hosts services with explicit endpoint bindings.                                                                         | Add explicit service-host endpoint bindings and checked outbound routing, retaining authentication, strict schemas, cancellation, bounded nesting and cleanup. Verify a real separate-process service chain with source and bundled CLI.                            |
| PORT-003b | Implemented for verified local scope    | Remote handles used locally through an alias, local helper parameter or local helper return each produce `6` in old Clio. Kalandra supports aliases and private direct-call helpers with one checked remote identity per parameter, including synchronous helper returns. No function crosses Sia in these probes. | Preserve checked remote signatures through local handle use. Start with immutable aliases, then locally passed/returned handles where calls can remain strictly checked. Reject unknown argument/result types and every function-valued serialized argument/result. |
| PORT-003c | Implemented for verified startup scope  | A function-local closure created during module initialization, before worker connection, runs in original RPC and produces `6`. Kalandra now extracts its code and typed captures. Two old instances collide on the same old registration path and return `8` through the first handle.                            | Port the demonstrated statically initialized typed target/capture case under the managed startup model. Keep ambiguous multiple-instance identity diagnostic pending LC-008; do not invent dynamic closure transfer or claim that request-created targets worked.   |
| PORT-004  | Classified; no demonstrated gap         | All three original deferred project/cache fixtures pass with diagnostic path normalization. Fresh self/mutual cycles overflow the pinned compiler stack.                                                                                                                                                           | Kalandra already diagnoses missing modules/cycles and rebuilds dependency outputs. A CLI regression verifies repeat builds, deleted-output recovery and edited dependency execution. Persistent cache/mtime parity is not required.                                 |
| PORT-005  | Inventory complete; follow-ups admitted | [CLI audit](cli-capability-audit.md): selected original build/docs/highlight/dependency-list bodies executed; full template/network/launcher flows remain unverified.                                                                                                                                              | Complete PORT-005a/b/c, then scaffold during release preparation. Command names and old package layouts need not match.                                                                                                                                             |
| PORT-005a | Implemented                             | Original build copies nested resources; manifest-backed Kalandra builds now copy ordinary source-root assets, with ownership-aware deletion cleanup.                                                                                                                                                               | Preserve nested asset bytes, validate collisions/containment, cover repeated builds and watch behavior.                                                                                                                                                             |
| PORT-005b | Implemented                             | Original docs lists and displays source function descriptions with scripted terminal prompts.                                                                                                                                                                                                                      | Provide static source documentation access without executing the program; keep Tiramisu for the language site/docs.                                                                                                                                                 |
| PORT-005c | Implemented                             | Original highlighter emits ANSI source text faithfully in the probe.                                                                                                                                                                                                                                               | Provide lexer-based terminal highlighting; preserve original text and report input errors.                                                                                                                                                                          |

This queue is not a claim that only one feature remains. PORT-003–005 must be investigated or explicitly classified before declaring parity. PORT-001 and PORT-002 are complete. PORT-003a service chaining is implemented and verified through source and bundled CLI. PORT-003b now covers the verified alias and private local-helper cases. PORT-003c is implemented for the verified single-instance startup case. PORT-004 is classified with no demonstrated missing implementation. PORT-005 now admits resource copying, source documentation access and terminal highlighting. PORT-005a is implemented. PORT-005b is implemented. PORT-005c is implemented. The [final acceptance sweep](port-acceptance.md) passed on 2026-10-13. Offline scaffolding is now implemented. Next is Tiramisu docs/site completion and release packaging; further work follows this queue, not an open-ended remote-feature roadmap.

## Items excluded from missing implementation

- **Deferred flaws:** LD-001–007 and LC-001–008 in the [language design backlog](language-design-backlog.md). Membership has no supplied old helper; declaration propagation and await/check quirks are not opportunities to invent new semantics now.
- **Already implemented:** browser module workers, explicit JavaScript package declarations, project-root resolution, typed captures, nested scheduling, remote record constructors/inheritance, and remote array maps. Older notes claiming these are missing are stale.
- **Not established old capabilities:** optimizing explicitly awaited self-calls, mutual recursion or every indirect call. The pinned `checkRecursive` recognizes direct call nodes, not an `awaited` wrapper. These are not automatic parity blockers.
- **Agreed stricter boundaries:** unknown/Any, arbitrary JavaScript objects, functions and live emitters cannot be serialized just because old Sia accepted dynamic data.
- **After-release additions unless evidence changes their classification:** narrower integer types, new language semantics, advanced editor indexing, protocol negotiation and additional hosting capabilities. A demonstrably working old data capability must first be assessed as parity work rather than silently put here.

The [31-fixture audit](compatibility-audit.md) remains a syntax/context inventory. Its 146/177 emission count is not a completion percentage. Fresh [workflow acceptance](workflow-acceptance.md) establishes composition in Kalandra, not old-program compatibility.

## Historical execution evidence — 2026-10-13

A clean archive of commit `75c7c09e962ef15506ff9bc7cf856aad727436c5` was extracted outside both projects. The dirty Clio checkout was read only. No compiler or runtime source repairs were made. The probe ran on Bun 1.3.12 on macOS, using restored dependency versions, not a reconstructed historical Node installation.

Direct dependencies are recorded in `tests/fixtures/clio/port-probes/toolchain.package.json`; the restored transitive resolution is in `toolchain.bun.lock`. These pin bean-parser 2.1.0, chalk 4.1.2, clio-highlight 1.4.0, clio-manifest 0.9.0, source-map 0.7.3 and @iarna/toml 2.2.5. TOML was supplied because the old manifest package imports it without installing it through the selected dependency set. Installation scripts were disabled.

The original compiler compiled each probe. Its generated factory was executed with the original decorator and emitter implementations. The only registration adapter was `(id, fn) => fn`: these probes make local calls, so they do not establish RPC behavior. All three sums returned `5000050000`, the custom decorator ran once, the description was `sum`, and listener removal left observed events `[7]`.

To reproduce from the repository root, create a temporary directory, extract `packages/core` and `packages/internals` from that commit with `git archive`, copy the saved toolchain files to `package.json` and `bun.lock`, and run `bun install --frozen-lockfile --ignore-scripts` there. Then run:

```sh
bun scripts/verify-clio-baseline.ts /path/to/restored-clio-snapshot
```

The script recompiles the saved source, checks exact generated code, executes it, and compares observed results. `tests/decorators.test.ts` runs the saved output beside Kalandra output on every test run, without downloading old dependencies. The raw `.clio` file is historical evidence only.

## Historical distributed execution evidence — 2026-10-13

`scripts/probe-clio-rpc.ts` runs the pinned compiler, internals, RPC dispatcher, workers, executors and TCP adapter unchanged. Results are saved in `tests/fixtures/clio/port-probes/rpc-results.json` and asserted on each run. This extends the local evidence above; its registration adapter registers functions on the original worker and attaches the original executor-backed `.parallel` operation.

| Probe                                                         | Observed result                                                                    | Disposition                                                                                                                                                 |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Discovered remote `add(2, 3)`                                 | `5`                                                                                | Existing checked remote calls cover this data operation.                                                                                                    |
| Three concurrent host calls                                   | `[11, 12, 13]`                                                                     | Concurrent RPC evidence; the JavaScript harness maps calls, so this is not evidence of Clio language map syntax.                                            |
| Compiled relay imports another service and awaits `add(n, 1)` | `6` for `n = 5`                                                                    | Implemented as PORT-003a with checked outbound routing.                                                                                                     |
| Compiled module-level parallel call inside that relay service | `7` for `n = 6`                                                                    | Nested routing works in this baseline; include it in service-chain acceptance.                                                                              |
| Returned emitter receives `ping(7)` and sends `pong(8)`       | `8`                                                                                | Working historical live channel, excluded by the agreed strict serialization boundary. A future typed channel design must not silently relax that boundary. |
| Same shared emitter returned twice                            | Second result is `{emitter, send}` registry entry, not an emitter; `.on` is absent | Historical identity bug, not a behavior to add to Kalandra.                                                                                                 |

Clio's source import is `tcp:127.0.0.1:PORT/base/service.clio`; the original generator inserts `//`. The first attempt used `tcp://` and failed because that produced a malformed runtime URL. Only the probe input was corrected.

All components run in one Bun process with real loopback TCP sockets and the original Sia 0.1.1 wire codec. The harness supplies module loading, executor selection, registration, deadlines and socket cleanup. It does not verify the historical CLI, multi-process startup, separate dispatchers, authentication, failure recovery or cancellation. No historical source was repaired. The additional edge probes below establish the narrower function-local target and local-handle cases; this first probe does not establish them.

For reproduction, extract `packages/core`, `packages/internals` and `packages/rpc` from the pinned commit into an isolated directory. Copy `rpc-toolchain.package.json` to `package.json` and `rpc-toolchain.bun.lock` to `bun.lock`, then run `bun install --frozen-lockfile --ignore-scripts` there. These separate pins add buffer 5.7.1, sializer 0.1.1 and the archived local internals package without changing the compiler-only baseline. The TCP probe does not need the historical WebSocket/native-addon dependencies.

```sh
bun scripts/probe-clio-rpc.ts /path/to/restored-clio-snapshot
```

The probe uses an ephemeral loopback port, a three-second timeout per operation and a fifteen-second overall deadline. It removes generated modules and closes sockets after completion or ordinary assertion failure.

## Service chaining acceptance — 2026-10-13

PORT-003a adds `serve --bindings endpoints.json` and `loadRemoteDeployment(path, { endpoints })`. Generated deployments name their remote import manifest. Startup validates its containment and requires all bindings, rejecting unused bindings. Tokens remain host-side; the CLI strips its inbound and named outbound token environment variables from task/bootstrap workers.

Source and isolated bundled CLI acceptance build an independent relay and client, then run direct and nested service calls against a separate downstream process. Results are `[3.25, 8.25]`. Failure recovery and SIGINT cancellation verify downstream request/worker counts and relay child-process exit before continuing; normal shutdown closes the relay listener. Unit checks cover strict argument rejection, manifest containment and service hop limits. Calls carry a host-controlled depth from 0 to 32; each outbound service hop increments it. Existing local nesting limits still apply per host. Parent cancellation waits for downstream cleanup acknowledgement; unconfirmed cleanup closes admission rather than reporting success.

## Historical RPC edge probes — 2026-10-13

`scripts/probe-clio-rpc-edges.ts` runs nine isolated subprocess cases using the same archived dependencies and original TCP components. It asserts both original generated JavaScript (ephemeral port normalized to `PORT`) and observed results against `tests/fixtures/clio/port-probes/rpc-edges.json`. Each source is saved in that fixture. No compiler, serializer or RPC source changes were made.

| Case                                                                                                         | Original result                                                                                                 | Classification                                                                        |
| ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Function-local parallel target created inside a remote request                                               | No reply within three seconds. The worker's function map contains `inner`, but the dispatcher only knows `run`. | Failed workflow in this harness, not demonstrated dynamic-target parity.              |
| Same target capturing the request's `n`                                                                      | Same timeout and missing dispatcher registration.                                                               | Same limitation; not evidence for dynamic closure transfer.                           |
| Local alias of imported remote `add`                                                                         | `6`                                                                                                             | Checked local aliases implemented in PORT-003b.                                       |
| Imported remote `add` passed to a local helper                                                               | `6`                                                                                                             | PORT-003b. Only numeric arguments/results cross TCP; the function stays local.        |
| Imported remote `add` returned from a local helper                                                           | `6`                                                                                                             | PORT-003b, under the same strict boundary.                                            |
| Imported remote function returned over RPC                                                                   | No reply within three seconds.                                                                                  | No successful function-transfer evidence; excluded by the agreed boundary regardless. |
| Executor-backed function passed as RPC argument                                                              | No reply within three seconds.                                                                                  | Same exclusion; this argument is supplied by the JavaScript harness.                  |
| Function-local closure created during module initialization before connection                                | `6`                                                                                                             | Implemented single-instance target/capture capability, PORT-003c.                     |
| Two startup-created closures from the same declaration, offsets 1 and 3; invoke the first in parallel with 5 | `8`, not `6`                                                                                                    | Historical registration identity collision, LC-008.                                   |

The startup result depends on the harness evaluating the module before calling `worker.connect()`. It establishes that the original compiled closure and RPC registration work in that ordering, not that the untouched historical CLI reliably arranges it. Original TCP launcher source creates its executor connection before asynchronously importing the module; its startup timing has not been validated here. Components still share a process but communicate over real sockets. These probes do not establish arbitrary closure lifetime, distributed mutable state, concurrent closure instances or transport-independent behavior.

Timeouts mean no reply within the bounded observation window; they are not successful results or proof of a particular serializer exception. The harness observes asynchronous exceptions only to stop and clean up a probe, never to repair or resume the historical operation. Each child has a fifteen-second emergency watchdog; the parent has a twenty-second process limit. Normal probe outcomes close sockets and remove generated modules.

Reproduce with the same RPC toolchain archive described above:

```sh
bun scripts/probe-clio-rpc-edges.ts /path/to/restored-clio-snapshot
bun scripts/audit-kalandra-rpc-edges.ts
```

The second command compiles corresponding Kalandra sources with a generated typed contract and prints current diagnostics. The dated `kalandra-rpc-edge-audit.json` records the observed KAL4202/KAL4201 gaps. It is an audit snapshot, not a test requiring these limitations to persist. The helper cases use local callable values; allowing them must still ensure that actual remote arguments and results are concrete, rather than bypassing checking through Any.

## Release gates

- [x] Investigate every evidence-required item in PORT-001–005 and implement every admitted missing capability within the recorded scope. See [final acceptance](port-acceptance.md).
- [x] Re-run compiler, managed runtime, source/bundled CLI, network, browser and playground acceptance; record tested environments and remaining limitations.
- [ ] Complete the Tiramisu docs/site, new-project path, small polish, packaging and reproducible installation instructions.
- [ ] Prepare release artifacts and kalandra.dev deployment; verify the published installation path.
- [ ] Publish and announce the revival with accurate supported-capability claims.
- [ ] Open the post-revival language-design and new-capability phase.

## Checked local remote aliases

The alias part of PORT-003b is implemented. Standalone immutable bindings can name an imported remote service, a namespace service member, another such alias, or an explicit parallel reference. The compiler retains the exact contract signature and route at each call and erases the identity binding from generated code; no function value is serialized. Calls work in ordinary modules, extracted worker tasks and hosted services, including nested service calls and array-map pipelines. Lexical shadowing continues to use the local binding's type.

Only side-effect-free identity initializers are erased. Synchronous checked local-helper initializers execute normally, as described below. Exported handles, function-valued wire results/arguments, collections of handles and unchecked computed initializers remain diagnostic. Unknown/dynamic remote arguments, missing arguments and unawaited inputs are still rejected. Private local helper parameters and synchronous returns are now supported within the scope below. The original dated audit snapshot above records the pre-implementation diagnostics and is intentionally retained.

Tests exercise worker alias chains, namespace and parallel forms, map schemas, lexical shadowing and invalid escapes. Source and bundled CLI network acceptance use aliases in the independent client and relay service, covering success, nested dispatch, failure and cancellation cleanup.

## Checked local helper handles

PORT-003b's demonstrated local-helper cases are implemented. Private helpers must be called directly, with every statically visible call agreeing on one remote service identity for each handle parameter. The compiler reanalyzes those parameter signatures to a bounded fixed point; it does not infer concrete data types from arbitrary callers. Data sent over Sia still needs a concrete type (`@params Function Number` is a typical helper annotation).

A private synchronous helper may return a checked remote handle directly or through another eligible helper. Calls producing those handles retain their normal evaluation and side effects. Worker tests mutate a local counter in a returning helper and verify two invocations produce two increments while only numeric arguments reach the remote dispatcher. Service-chain acceptance uses returned handles and helper parameters inside the hosted relay, retaining nested dispatch, failure and cancellation cleanup.

Exported/escaped helpers, conflicting remote identities, arbitrary decorators, asynchronous handle-producing expressions, conditional handle selection and function-valued wire arguments/results remain diagnostic. Helpers returning handles should be declared before their consumers: the existing forward-return inference can otherwise leave a result unknown. This scoped implementation matches the probed local-helper operations with the agreed concrete data annotations; it is not general callable polymorphism or function serialization. Broader forms have no working historical probe in this inventory.

## Startup-created function-local targets

PORT-003c implements the single-instance case demonstrated by the historical probe. An unexported module-level factory is called exactly once, in a module-level binding. Its body must consist of one nested function declaration followed by that function's name. Factory parameters need concrete task types, with the existing `@params` annotations; zero-parameter factories are also eligible. The factory allows only builtin `@params`; the inner function allows builtin `@params`/`@returns`, using simple type identifiers. Other factory uses, multiple instances, request-created closures and effectful factory bodies remain diagnostic when used as parallel targets.

The original closure stays in normal module execution. Factory arguments are evaluated once, left to right, into compiler-owned typed bindings. A separately extracted function uses those bindings for managed worker capture snapshots. No function object crosses Sia. This preserves ordinary closure execution and the existing per-dispatch isolation model. Source-facing editor models retain the original AST and names; generated bindings are not exposed as source symbols.

`examples/startup-closure.kalandra` returns `[6, 6, 7]` through ordinary, parallel and nested calls. Tests cover imported targets, explicitly typed recursive returns, argument evaluation count, generated-name hygiene, record snapshot isolation and rejection of ambiguous cases. The bundled CLI runs the same example outside the workspace.

Hosted services can reach these targets through the existing pure startup baseline. Only the compiler-proven factory binding is omitted from bootstrap evaluation; all split argument initializers remain subject to the ordinary purity/type checks. Effectful service startup arguments still fail KAL4301. Source and bundled network acceptance invoke the startup target inside the relay service and get `6`. Multiple-instance identity remains LC-008, not a newly designed registration scheme.

## Project/cache evidence — 2026-10-13

PORT-004 is complete for the tracked cases. `scripts/probe-clio-projects.ts` verifies SHA-256 hashes of the pinned compiler JavaScript and project fixtures, then copies the historical test inputs to a disposable directory. It evaluates the original project helper and the three deferred test declarations against the restored original compiler. The harness supplies assertion functions; only the temporary-directory prefix in missing-module candidate paths is normalized. Compiler, manifest, fixture source and cache logic are unchanged. Observations and source hashes are saved in `tests/fixtures/clio/port-probes/projects.json`.

| Original deferred test           | Observed result                                                                               | Kalandra disposition                                                                                                                 |
| -------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `imports`                        | Rejects missing `./foo`, listing file and folder candidates.                                  | Existing missing-module diagnostic; no gap.                                                                                          |
| `Compiler cache`                 | Second compile leaves the entry output's mtime unchanged.                                     | Repeat builds produce the same code. Kalandra rebuilds/writes outputs; matching the old persistent cache and mtimes is not required. |
| `Recompile changed dependencies` | Deletes a dependency's generated JavaScript; the next compile restores it with a newer mtime. | CLI regression executes restored output successfully. Despite its name, the old test does not edit source.                           |

Two additional fresh probes import a module from itself, or make two modules import each other. Both fail during cold compilation with `RangeError: Maximum call stack size exceeded`. They are not upstream fixtures or evidence about every possible cycle/cache state. Kalandra retains its explicit KAL4102 dependency-chain diagnostic; general cycle support belongs to later design work, not demonstrated parity here. Each fresh probe has a five-second VM deadline.

Kalandra's CLI regression also edits the dependency source and executes the rebuilt program in a fresh Bun process, observing the updated value. It covers repeated builds and restoration of a deleted dependency artifact. Existing project tests cover missing modules and cycles. No production compiler change was necessary for this audit.

Reproduce using the isolated archive and compiler dependency pins described above:

```sh
bun scripts/probe-clio-projects.ts /path/to/restored-clio-snapshot
bun test tests/cli.test.ts tests/project.test.ts
```

This is compiler/filesystem evidence on Bun 1.3.12, not a historical CLI or Node installation test. It does not promise incremental-build performance, transitive historical cache correctness, or successful execution of the unchanged cache fixture's console entrypoint.

## Build resources — PORT-005a

Manifest-backed `build` and `run` copy ordinary regular files under `build.source` to the same relative paths in output. Standalone-file builds retain their previous graph-only behavior. `.kalandra` files, hidden entries, `node_modules`, `kalandra.toml`, `kalandra.lock` and the selected output subtree are excluded. Resource symlinks are rejected rather than followed; output symlinks at or below the output directory are rejected. The output directory cannot equal or contain the source root.

All generated and resource destinations are checked together before writes, including file/directory collisions and source-input protection. Files retain their bytes; permissions and empty directories are not copied. The output's `.kalandra-assets.json` records ownership and content hashes. A subsequent successful build removes vanished assets only if their output bytes still match the last copied version. Manually edited former assets and unrelated output files are retained. Empty directories may remain. The build is not a transactional directory replacement: filesystem failures during writes can still leave partial output.

Watch hashes resource bytes and membership independently of source graph reads. Additions, edits and deletions trigger builds; excluded sources and generated output do not trigger resource rebuilds. Compilation errors retain the last successful output. Resource changes never execute the program. Source and isolated bundled CLI acceptance cover invalid UTF-8 bytes, nested output exclusion, collisions, resource/output symlinks, watch changes and preservation of modified former assets.

## Static source documentation — PORT-005b

`kalandra docs <file.kalandra> [function] [--json]` lists top-level function declarations, their parameter names, source decorators and literal builtin `@describe` text. Private functions and separately exported local declarations are included; nested functions, imported functions, re-exports and function-valued bindings are not listed. An exact function name selects one declaration. Missing or ambiguous names fail explicitly.

The command reads the selected source file only. It neither resolves imports nor evaluates the program/decorators, and creates no build artifacts. Syntax errors fail; semantic errors do not prevent declaration inspection. Displayed annotations are source declarations, not inferred or validated signatures. Computed descriptions are marked unavailable statically; a shadowed `describe` is not treated as builtin metadata. With repeated builtin descriptions, the outermost one determines the reported description. Custom decorators can still change runtime metadata, which this command does not claim to predict.

JSON version 1 includes the absolute source path and an ordered `functions` list with name, export status, parameter names, decorator text, description/status and source spans. The portable compiler exports `sourceDocumentation` for tools. See [source documentation](source-documentation.md) for usage. Source and bundled CLI checks verify selection, JSON, literal/dynamic descriptions, ignored nested functions, invalid arguments/syntax, missing imports and absence of execution or generated files. The language website remains built with Tiramisu.

## Terminal highlighting — PORT-005c

`kalandra highlight <file.kalandra> [--color auto|always|never]` inserts ANSI colors at the existing lexer token/comment spans. It preserves gaps, indentation, Unicode, CRLF and final-newline state, without using the old regex highlighter. Keywords, strings, numeric literals, identifiers, comments and punctuation receive lexical colors; there is no semantic symbol classification.

Auto mode colors terminal stdout unless `NO_COLOR` is nonempty or `TERM=dumb`; piped output is plain source. Explicit always/never overrides auto detection. Input must be UTF-8. Read, encoding and lexer errors return nonzero, with diagnostics on stderr and no partial source on stdout. Highlighting does not parse/type-check, load dependencies, execute source, or write files. Lexically valid incomplete syntax can therefore be displayed.

Tests strip colors and compare all 177 historical fixture texts exactly; additional cases cover empty input, comments, interpolation, multiline strings, Unicode and CRLF. Source and bundled CLI checks verify modes, option errors, invalid encoding and lexer errors. See [terminal highlighting](terminal-highlighting.md). The full acceptance sweep passed; the remaining release gates require release preparation; finishing this utility is not a blanket parity claim.

## Offline project scaffolding

`kalandra new <directory>` embeds a dependency-free two-module starter, `kalandra.toml`, Bun version pin, README and ignore rules. The generated typed parallel program returns `[2, 4, 6]`. It neither clones templates nor installs dependencies, initializes Git or creates commits. Existing paths, including empty directories and symlinks, are refused. The parent directory must exist. If a later filesystem write fails, a partial project is retained and reported instead of recursively deleting user-visible files.

Source and isolated bundled CLI acceptance create a path containing spaces/Unicode, run and build the generated project, inspect docs/highlighting, check source formatting, and start/stop watch mode. Creation and ordinary commands are exercised with an empty PATH, so Git/package tools cannot be invoked. Watch uses the ordinary host environment. Existing paths remain unchanged after refused creation. The README documents both an installed CLI and the current unpublished development/built-checkout invocation; no nonexistent npm version is prescribed. See [new project](new-project.md).

## Landing page and documentation entry points

The homepage now presents a responsive language introduction, a real typed parallel example and task diagram, direct playground/guide paths, language foundations, and the Clio revival story. It explicitly identifies the development preview, unpublished npm packages and experimental remote services. Tiramisu remains the documentation framework. The docs overview, setup page, current-limits guide and repository overview have been reconciled with the completed scoped port.

Validation on 2026-10-13: TypeScript and Svelte checks (zero errors/warnings), static website build, formatting, and all ten unique homepage link destinations in generated output. In-app Chromium visual review covered desktop and 390px mobile layouts without horizontal page overflow; the primary CTA opened the Tiramisu playground, where the exact homepage program returned `[2, 4, 6]`. This is website validation, not a rerun of the dated compiler/runtime acceptance sweep. Package assembly, clean installation verification, deployment and publication remain next.

The initial landing-page styling was subsequently aligned with Tiramisu: shared theme tokens, Geist typography, borders/radii and a shared control style used by homepage actions and the docs Open control. Both light and dark themes were visually checked, along with the 390px mobile layout. A stale preview process had retained references to chunks removed by a later build; restarting the preview and reloading the client resolved the docs error. Preview must be stopped before rebuilding and restarted afterward. Fresh browser checks now cover direct docs loads, homepage-to-docs navigation, a lazy-loaded lesson and a lesson reload, with no console errors.

## Documentation route and highlighting verification

All 12 generated documentation routes were loaded directly and reached through client-side navigation in a fresh in-app Chromium session on 2026-10-13, with no browser warnings/errors. The [route-by-route report](verification/website-2026-10-13.json) records headings and code/token counts. The playground default program returned `[3, 5, 7]`. This verifies those loading/navigation paths, not every possible interaction or other browser engines.

Kalandra code blocks and the homepage example now receive build-time lexer highlighting, preserving source gaps and escaping HTML. The Vite adapter runs after Tiramisu loads its generated Svelte and before Svelte compiles it; existing Shiki languages keep their highlighting. Colors use Tiramisu's light/dark variables. The local CodeBlock keeps the Tiramisu presentation and copies rendered text so entities are decoded exactly once. Tests cover source preservation, literal entities, HTML-like strings and transformation boundaries. Browser checks verified colors in both themes and exact copied source. Website build, TypeScript/Svelte checks and guide/highlighting tests passed.

## Example-led homepage expansion

The homepage keeps its runnable pipeline/parallel/type-boundary demo and adds the existing invoice workflow with switchable source files, actual build-time JavaScript output, package interoperability, browser/Bun/experimental remote execution, CLI and language-server guidance, and six guide entry points. Invoice sources are imported from the executable project instead of copied into the page. Explicit AI messaging has been removed. Editor setup now has a destination in the Tiramisu development guide.

Validation on 2026-10-13: invoice CLI execution returned [35.91, 18] after installing its bundled local dependency offline; a fresh starter returned [2, 4, 6]. Website build and Svelte checks passed, as did the 10 guide/highlighting tests. Browser checks covered invoice file switching, the editor-support anchor, light/dark presentation and a 390px layout without horizontal page overflow. These are presentation and example checks, not additional runtime capability claims.

Homepage review follow-up: the hero now explicitly names parallel and distributed computing, workers, and remote services. The invoice walkthrough was replaced by the canonical remote-batch client source and a main → local worker → remote service diagram; experimental service limitations remain visible. JavaScript output, the JavaScript package helper, and CLI commands now use build-time Shiki highlighting with light/dark colors. Source-preservation and escaping tests cover both added languages. This supersedes the invoice-section description above; the invoice workflow remains in the guide.

## npm-first documentation and publication gates (2026-10-14)

The public Installation page at `/docs/getting-started` now defines the intended 0.13.0 user path: `bun add --global @kalandra/cli@0.13.0`, then `kalandra new`, `check`, `run`, and `build`. Source instructions live at `/docs/development`. These are release-target instructions, not a claim that registry installation already works.

Before publishing the website:

- Package `@kalandra/cli` with a `kalandra` executable that launches with Bun; configure public package files, exports, and dependency versions. Current manifests remain private and point to source.
- Validate the documented install flow using packed artifacts in a clean directory, including worker/watch assets and execution outside the checkout.
- Publish the required packages in dependency order and repeat the installation, version, scaffold, check, run, and build steps against the registry.
- Remove the pending-publication notice and reconcile unpublished-package wording in the homepage, overview, README, and revival post only after verification.
- Keep the existing Git history when preparing the revival PR at `https://github.com/kalandra-lang/kalandra`; publish Git, npm, and website as separate reviewed release steps.
