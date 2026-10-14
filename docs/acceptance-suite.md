# Project acceptance and historical evidence

The fresh acceptance projects test Kalandra as a complete toolchain. They are newly written programs, not proof of source or behavioral compatibility with Clio. Historical applications qualify as behavioral evidence only after their original toolchain executes them successfully with recorded observable results. Kalandra has no Clio migration or project-format compatibility contract.

## Fresh project suite

Each project in `tests/fixtures/acceptance` contains a `kalandra.toml` and two source modules. Tests copy it into a temporary directory, invoke the real CLI from inside `src`, and exercise manifest discovery, strict project builds, and managed execution. The same cases run against the bundled CLI outside the workspace during `bun run test:built`.

| Project              | Combined behavior                                                                                                           | Expected outcome                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| records-and-closures | Imported records, checked function, lexical closure, mapped calls and indexed write                                         | `[9, 8]`                                                 |
| async-pipeline       | Imported async function, recursive accumulation and two mapped await-all stages                                             | `[6.5, 10.5]`                                            |
| nested-captures      | Imported parent task, nested mapped tasks, typed record capture, float64 data and mutation isolation between task snapshots | `[[4, 6], [8, 10]]`                                      |
| worker-failure       | Imported parent returns while its unawaited child fails                                                                     | Nonzero exit, child error reported, no successful result |
| dynamic-boundary     | Imported untyped identity used as a parallel target                                                                         | `KAL4202`, no build output and no execution              |
| imported-type-error  | Wrong constructor argument for an imported record                                                                           | `KAL3106`, no build output and no execution              |

The successful cases assert exact results, successful exit and empty stderr. Failure cases assert nonzero exit, the expected diagnostic or runtime message and empty stdout. Compiler failures must create no output directory. Each CLI invocation has a 15-second bound. The suite does not change language semantics; it uses explicit grouping, wrappers around checked mapped calls, and concrete parallel annotations.

Run the source suite:

```sh
bun test tests/acceptance.test.ts
```

Run one project manually from the repository:

```sh
bun run cli run tests/fixtures/acceptance/nested-captures/src/main.kalandra --strict
```

`bun run check` includes both source and built-package verification. Worker cancellation, deadline enforcement, one-worker cooperative scheduling and detailed lifecycle checks remain in the existing runtime suites; these project tests do not replace them.

## Time-bounded historical probe — 2026-10-12

Clio snapshot: `75c7c09e962ef15506ff9bc7cf856aad727436c5` (0.12.0). Example repository HEAD inspected: `a4f151187c1c7fe7a142cf72dc32d6845502bb6a`. Host: Node v26.7.0 on macOS. Neither matching historical Node/dependency versions nor the examples' intended compiler revision has been established.

The existing Clio checkout contains uncommitted implementation changes and no installed compiler dependencies. A clean `git archive` of the pinned commit was extracted into a temporary directory; the working checkout was not modified. The attempted command was:

```sh
node <clean-snapshot>/packages/cli/index.js run /Users/pouya/Projects/clio-examples/rpc/server
```

It exited 1 during CLI module loading with `ERR_MODULE_NOT_FOUND`: `clio-manifest`, imported by `packages/cli/commands/build.js`. Compilation and application execution did not begin. No dependency restoration or source repairs were attempted in this bounded probe.

| Candidate                                 | Observation                                                                                                                 | Evidence status                                 |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `clio-examples/rpc/server` and its client | Server CLI startup blocked by missing old dependencies; client imports a TCP service on localhost:4444 and was not executed | Unverified; excluded from compatibility scoring |
| `clio-examples/channel-client`            | Inspected only; imports a WebSocket service on localhost:1337 and depends on event/channel behavior                         | Unverified; excluded from compatibility scoring |

These results are environment limitations, not evidence that the examples are broken or that Kalandra is incompatible. No historical project was admitted as a passing reference in this task. No Kalandra test asserts that these applications must run.

## Admission rule for future historical comparisons

1. Identify the intended Clio revision, host runtime, dependency versions, services and input data. Preserve original sources and record any dirty files or adaptations.
2. Reproduce the application with that toolchain in isolation. Capture the command, exit status and observable output; bound long-running services and record their readiness and interaction results.
3. Only then run the equivalent workload through Kalandra. Document test-only source adaptations and explicit Sia boundary types separately from compiler defects. Matching old project layouts is not a requirement.
4. If the original cannot be reproduced within the agreed effort, leave it unverified. Do not repair it silently, manufacture a reference result or count it as a missing Kalandra feature.

Fresh remote execution and workflow acceptance are now implemented. On 2026-10-13, an isolated restored pinned compiler also successfully executed decorated-tail and local-emitter probes; see the [port-completion evidence](port-completion.md). This does not retroactively admit the unexecuted RPC applications above. Deferred language design decisions remain separate.
