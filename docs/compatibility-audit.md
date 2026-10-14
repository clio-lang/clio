# Compatibility audit: the 31 single-file exclusions

This audit checks the 177 positive fixtures pinned to Clio commit `75c7c09e962ef15506ff9bc7cf856aad727436c5`. Exactly 146 produce JavaScript in single-file compilation; the other 31 are accounted for below. This is an audit of those 31, not a claim that every behavior in the language is ported.

## Findings

| Classification                                                |  Count | Evidence                                                                                       |
| ------------------------------------------------------------- | -----: | ---------------------------------------------------------------------------------------------- |
| Parallel forms executable with supplied typed context         |     12 | Real managed Bun worker execution                                                              |
| Import forms executable with supplied local/installed modules |      6 | Project builds and managed entry execution; five retain their original bare package specifiers |
| Rejected under the agreed strict worker boundary              |      3 | Typed consumers expose unresolved promises; KAL3106                                            |
| Await-all forms that compile but fail at runtime              |      2 | TypeError in Kalandra and in saved Clio JavaScript with promise-returning parallel stubs       |
| Deferred membership semantics                                 |      4 | KAL4001; missing upstream runtime helper; LD-002                                               |
| Remote imports without a transport implementation             |      4 | KAL4103 for ws: imports                                                                        |
| **Total**                                                     | **31** | Every excluded fixture has a manifest entry and test                                           |

**None of the 31 is an unchanged, self-contained working project.** Raw project probes intentionally provide only the fixture itself and verify its current diagnostic. The successful executions supply omitted definitions, modules, signatures and entry calls. They establish support for the syntax/operation, not source-compatible execution of an incomplete old snippet.

The test harness is explicit about adaptations. Parallel fixtures receive typed local targets and deterministic inputs. Three fixtures returning arrays of promises (#103, #105, #109) are joined by the harness _after_ their original expression. This must not be mistaken for an implicit join in the language. The Fibonacci example receives the already-agreed Number annotations and a smaller workload; its console output is checked. Import cases use test-only Kalandra path adaptations (`.clio` suffixes become `.kalandra`); extensionless specifiers are unchanged: the harness supplies installed packages under `.kalandra/modules`, with `kalandra.toml` manifests. The sixth import fixture supplies a relative local module. This measures inherited operations, not a promise to run Clio projects.

## Per-fixture results

IDs below are zero-based indices in `corpus.accepted`. Names alone are ambiguous: #112 and #114 both have the upstream name “Flow (Parallel Await Chain Maps)” but different await forms.

|  ID | Upstream fixture                    | Classification                                  | Context or blocker                                                                                          |
| --: | ----------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
|  34 | Call (Parallel)                     | Parallel: executes with context                 | Typed three-argument add and numeric globals; expression unchanged.                                         |
|  66 | Functions (Async)                   | Parallel: executes with context                 | Typed add and test parameters; invoke test from a managed entry.                                            |
|  67 | Functions (Nested Async)            | Parallel: executes with context                 | Typed add and inner parameters; preserve original same-indent body; invoke returned function.               |
|  71 | In                                  | Deferred: membership (LD-002)                   | Membership helper is absent from the pinned runtime; no semantics invented.                                 |
|  72 | In (Wrapped)                        | Deferred: membership (LD-002)                   | Membership helper is absent from the pinned runtime; no semantics invented.                                 |
|  73 | In (Hash)                           | Deferred: membership (LD-002)                   | Membership helper is absent from the pinned runtime; no semantics invented.                                 |
|  75 | Conditionals (If In)                | Deferred: membership (LD-002)                   | Membership helper is absent from the pinned runtime; no semantics invented.                                 |
| 102 | Flow (Parallel)                     | Parallel: executes with context                 | Typed double and scalar a; expression unchanged.                                                            |
| 103 | Flow (Parallel Map)                 | Parallel: executes with context                 | Typed double; harness awaits the resulting array after the fixture expression.                              |
| 104 | Flow (Parallel Chain)               | Parallel: executes with context                 | Typed double, scalar a, identity print; entry awaits its returned promise.                                  |
| 105 | Flow (Parallel Chain Map)           | Parallel: executes with context                 | Typed double, array a, identity print; harness joins the resulting array.                                   |
| 106 | Flow (Parallel Chain Maps)          | Rejected: unresolved promise at worker boundary | Second map receives Promise<Number>; KAL3106 with a typed print target.                                     |
| 107 | Flow (Parallel Await)               | Parallel: executes with context                 | Typed double and scalar a; expression unchanged.                                                            |
| 108 | Flow (Parallel Await All)           | Compiles; runtime TypeError                     | Promise.all receives the single promise returned by double.parallel.                                        |
| 109 | Flow (Parallel Await Map)           | Parallel: executes with context                 | Plain await leaves mapped promises in an array; harness explicitly joins it afterward.                      |
| 110 | Flow (Parallel Await All Map)       | Parallel: executes with context                 | Typed double and array a; expression unchanged.                                                             |
| 111 | Flow (Parallel Await Chain Map)     | Rejected: unresolved promise at worker boundary | print.parallel receives Array<Promise<Number>>; KAL3106.                                                    |
| 112 | Flow (Parallel Await Chain Maps)    | Rejected: unresolved promise at worker boundary | Second mapped worker receives Promise<Number>; KAL3106.                                                     |
| 113 | Flow (Parallel Await All Chain Map) | Compiles; runtime TypeError                     | First await-all joins the map; second applies Promise.all to one print.parallel promise.                    |
| 114 | Flow (Parallel Await Chain Maps)    | Parallel: executes with context                 | Both mapped stages use await-all; typed targets and array a.                                                |
| 140 | Import                              | Import: executes with supplied modules          | Keep test; provide installed package; probe test.xyz.                                                       |
| 141 | Import All As                       | Import: executes with supplied modules          | Keep test; provide installed package; probe foo.xyz.                                                        |
| 142 | Import All As + Destruct            | Import: executes with supplied modules          | Keep test; provide installed package; check selected alias and rest member.                                 |
| 143 | Import (Remote)                     | Unimplemented: remote transport                 | ws: import scheme remains unsupported; KAL4103.                                                             |
| 144 | Import All As (Remote)              | Unimplemented: remote transport                 | ws: wildcard import remains unsupported; KAL4103.                                                           |
| 145 | Import From (Remote)                | Unimplemented: remote transport                 | ws: named import remains unsupported; KAL4103.                                                              |
| 146 | Import As From (Remote)             | Unimplemented: remote transport                 | ws: aliased import remains unsupported; KAL4103.                                                            |
| 155 | Import (Multiple)                   | Import: executes with supplied modules          | Keep sub/test; provide installed sub package; check a, b, c.                                                |
| 156 | Import (Subdir)                     | Import: executes with supplied modules          | Adapt sub/test.clio to sub/test.kalandra; provide installed sub package; check namespace.                   |
| 160 | Import As (Indented)                | Import: executes with supplied modules          | Adapt to greetings.kalandra; provide that module; check both indented imports.                              |
| 172 | fib.parallel.clio                   | Parallel: executes with context                 | Annotate fib Number → Number; reduce inputs 39–42 to 10–13; verify logged Fibonacci values and main result. |

## Promise findings

`await` on an array leaves its promise elements unresolved. Consequently, #106, #111 and #112 attempt to pass promises into a later worker. Their typed probes are rejected; the strict Sia boundary must remain intact. Use the already-supported mapped await-all form when results must be ready before the next worker stage, as demonstrated by #114.

Conversely, #108 and #113 apply `Promise.all` directly to a single worker promise. A promise is not an iterable, even if it will eventually resolve to an array. Both the saved upstream output and current output fail with TypeError. This is recorded as LD-007; the audit does not silently change await semantics or add a new compiler diagnostic. Ordinary `await` is the existing way to obtain a single worker result.

## Fixture accounting and deferred decisions

The active release gate is the [port-completion implementation queue](port-completion.md). Unchecked semantic decisions below belong after the revival release, not to missing implementation.

- [x] Classify every single-file exclusion and fail tests if the inventory changes.
- [x] Probe unchanged fixtures through the project compiler and retain exact diagnostic-code expectations.
- [x] Execute all 18 supported contextual/migrated cases.
- [x] Verify the three strict-boundary rejections and both historical runtime failures.
- [ ] Decide and implement membership semantics (LD-002).
- [ ] Decide whether direct await-all on a promise should be diagnosed or redesigned (LD-007).
- [x] Port installed Kalandra package resolution with manifests, subpaths, file-before-folder precedence and package source roots. CLI enclosing project-root discovery now uses the nearest kalandra.toml and its build.source; explicit Git dependency installation now populates the resolver layout and locks commits; registry resolution and updates remain separate work.
- [x] Implement contract-backed remote imports through the authenticated Bun host API. The historical `ws:` fixtures remain unsupported; Kalandra uses local `remote:./contract.json` signatures and separate runtime endpoint bindings.
- [ ] Resolve the other deferred expression-binding/escape cases in LD-001 and LD-003–LD-006 separately; they are not measured by these 31 fixtures.
- [x] Keep broader capability evidence separate from this fixture count. Decorated tail calls, explicit JavaScript declarations and browser workers are now implemented; PORT-004 separately classified the three deferred project/cache fixtures and fresh failing cycle probes; the CLI inventory and its admitted utility follow-ups are tracked in the port-completion queue.

The next implementation should come from the remaining engineering backlog; the audit does not authorize resolving the deferred language decisions. There is no evidence here for describing “31 missing compiler features.”

## Reproduce and inspect

Run `bun test tests/compatibility-audit.test.ts`. The machine-readable inventory is `tests/fixtures/clio/compatibility-audit.json`; source adaptations are in `tests/helpers/compatibility-context.ts`. Original sources and saved JavaScript stay unchanged in `tests/fixtures/clio/corpus.json`.

The audit runs actual generated project artifacts with the managed Bun runner. It executes saved upstream JavaScript only for the two await-all comparisons, using controlled promise-returning stubs. It does not run the old compiler, contact a remote transport, or execute the original expensive Fibonacci workload. The 146 single-file successes are still emission/parser coverage unless independently covered by execution tests.

## Broader project acceptance

The [fresh project suite and historical admission rule](acceptance-suite.md) supplement this fixture audit. Fresh programs verify Kalandra workflows; they do not expand historical compatibility counts. No old application is counted until its original toolchain has successfully executed it.
