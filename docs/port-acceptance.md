# Port acceptance — 2026-10-13

The verified implementation scope in PORT-001–005 has passed the final acceptance sweep. No admitted implementation task remains open in that queue. The next phase is offline new-project scaffolding, Tiramisu documentation/website completion, small polish and packaging under the secured `@kalandra` npm organization.

This is a scoped engineering milestone, not a claim that every old Clio application, transport or historical launcher works. It does not establish production hosting or published-installation readiness. The [machine-readable record](verification/port-acceptance-2026-10-13.json) preserves the browser reports, commands, environment and source fingerprint. The working tree was tested directly; there is no release commit or published artifact from this sweep.

## Results

| Check                             | Result                                                                                                                                                                                       |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run check`                   | 727 tests passed, zero failed; formatting, TypeScript/Svelte checks, package/site builds and isolated bundled CLI/LSP/worker acceptance passed.                                              |
| `bun run test:network`            | Passed through real local services/processes: contracts, strict schemas, records, captures, service chaining, failures, cancellation, recovery and shutdown.                                 |
| `bun run test:network --built`    | Same acceptance passed with isolated packaged artifacts.                                                                                                                                     |
| `bun run test:browser`            | 21/21 passed in the desktop app's Chromium browser.                                                                                                                                          |
| `bun run test:browser --built`    | 21/21 passed with the packaged browser worker adapter. The compiler/test harness is still freshly bundled by this script.                                                                    |
| `bun run test:playground`         | 16/16 passed using the built playground assets and real browser sandbox.                                                                                                                     |
| Five pinned Clio evidence scripts | All completed successfully against their recorded expectations. Historical timeouts, stack overflows and registration collisions remain expected observations, not passing old capabilities. |

The host was macOS 26.5 on arm64 with Bun 1.3.12. The browser reported Chrome 155.0.0.0; its compatibility user-agent string says Intel Mac OS X 10_15_7, which does not describe the host hardware/OS. Other Bun versions, Linux, Windows, Safari and Firefox were not verified in this sweep.

Browser checks cover native ESM, compiler execution in a module worker, generated multi-module records/captures/nested tasks, float64 and Unicode serialization, single-worker progress, schema rejection, cancellation, queue bounds, deadlines, crash recovery and cleanup. Playground checks cover all current showcased programs, diagnostics, stopping/restarting CPU-bound or parallel work, whole-run deadlines, opaque-origin/network restrictions and bounded input/output. These are behavioral checks, not a comprehensive security audit.

The original evidence scripts were rerun from the restored pinned archive: `verify-clio-baseline.ts`, `probe-clio-projects.ts`, `probe-clio-cli.ts`, `probe-clio-rpc.ts` and `probe-clio-rpc-edges.ts`. They reproduced the historical local, project, selected CLI-body and TCP results. The CLI comparison now observes Kalandra copying the resource successfully. Full old yargs/Node launchers, live template repositories and registry installs remain unverified; no old application has been newly admitted merely because its source exists.

## Scope retained for release claims

- Strict Sia boundaries are intentional: Any/dynamic JS values, function objects, promises and live emitters cannot cross as arbitrary serialized data. Number remains float64.
- LD-001–007 and LC-001–008 remain recorded language flaws/quirks. Membership, ambiguous binding/await behavior and closure identity are not silently redesigned.
- Startup-created function-local parallel targets support the verified single-instance form. Arbitrary runtime-created targets and multiple-instance identities remain outside the supported scope.
- Fresh self/mutual project cycles failed in old Clio; Kalandra retains its explicit cycle diagnostic.
- Remote calls use checked local contracts and explicit authenticated host bindings. Legacy WebSocket spelling/discovery, live event channels and arbitrary function transfer are not promised.
- Service exports whose schemas depend on constructors originating in another remote contract remain unsupported. This is distinct from service chaining and locally declared record support; no working historical probe in the admitted queue requires that cross-deployment type workflow.
- Pure typed service startup captures are supported; effectful initialization and persistent shared service state remain deferred.
- Source docs inspect top-level declarations only; highlighting is lexical. Asset copying is manifest-backed and has explicit exclusions. The individual guides document these limits.

## Remaining release work

1. Add an offline new-project command and verify the generated project with source and bundled CLI.
2. Complete and reconcile Tiramisu docs/site content, including capability limits and fresh-start onboarding; apply small polish.
3. Prepare `@kalandra` packages, versioning, licenses/notices and reproducible installation checks outside the monorepo. Verify a packed/published installation separately from the bundled-copy checks above.
4. Prepare and verify kalandra.dev deployment, including any relevant TLS/proxy setup. Public hosting was not tested by loopback HTTP acceptance.
5. Prepare release notes and announcement text for the agreed publication step. Nothing was published or announced during this sweep.

After the revival release, continue language-design decisions and new capabilities. Additional historical evidence can reopen a scoped parity task; the 146/177 single-file emission count must not be presented as a completion percentage.

## Subsequent release preparation

Offline scaffolding is now implemented and covered by source/bundled CLI acceptance; see [new project](new-project.md). The dated sweep and fingerprint above remain the original 2026-10-13 port milestone. Subsequent scaffolding validation is recorded in [port completion](port-completion.md#offline-project-scaffolding); it does not retroactively change that snapshot.
