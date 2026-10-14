# Complete workflow acceptance

The source of truth is [examples/workflows](../examples/workflows/README.md). These are fresh Kalandra projects. No old Clio repository is counted as a passing comparison merely because its source exists.

| Workflow            | Assertions                                                                                                                                                                                   | Verification                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Invoices            | Typed local JavaScript package installs offline; inherited constructor fields and module imports yield `[35.91, 18]`                                                                         | Source CLI test and isolated bundled CLI; explicit build followed by run             |
| Local batch         | Mapped inherited records cross nested worker boundaries; typed capture mutations stay isolated; repeated results and original input match `[12, 22, 12, 22, 10]`                             | Source CLI test and isolated bundled CLI                                             |
| Remote batch        | Separately built service and client communicate using the generated contract; local workers map remote records; server captures reset per request; repeated results match `[12, 22, 12, 22]` | Source and isolated bundled network acceptance                                       |
| Remote failure      | Deliberate failure cancels outstanding slow work; no server workers remain; subsequent batch succeeds                                                                                        | Real CLI processes and Unix process inspection                                       |
| Remote cancellation | Wait for server work to start, interrupt the client, require exit 130 and confirmed worker exits, then successfully run another batch                                                        | Real CLI processes, remote cancellation acknowledgements and Unix process inspection |
| Shutdown            | Service exits successfully and its listener is closed                                                                                                                                        | Real CLI hosting and connection attempt after shutdown                               |

The guide uses the actual files through `scripts/workflow-guide.ts`, rather than copied snippets. All acceptance runs use temporary project copies, and the bundled runs copy CLI artifacts outside the workspace. Endpoint tokens are generated per run and checked for accidental CLI output. Failure cleanup first requests graceful shutdown before its bounded fallback.

## Remaining completion checklist

- [x] Combine modules, inheritance and explicitly typed JavaScript imports in a complete program.
- [x] Combine record mapping, typed captures and nested local tasks.
- [x] Combine independent remote contracts, record mapping and server-owned captures from a local worker.
- [x] Exercise failure, cancellation, recovery and shutdown through the CLI.
- [x] Run the same programs through source and isolated bundled artifacts.
- [x] Reconcile every remaining port gap with the [compatibility audit](compatibility-audit.md) and [language design backlog](language-design-backlog.md); distinguish missing implementation from retained historical behavior and agreed strictness.
- [x] Expand browser acceptance to generated multi-module records, captures and nested scheduling; source and packaged adapters passed 21 cases each in Chromium during the [final sweep](port-acceptance.md).
- [x] Implement and verify remote service chaining with explicit host bindings.
- [ ] Future capability: service export schemas using record constructors from another remote contract. This is not an admitted historical parity blocker; keep the limitation explicit.
- [ ] Verify TLS/proxy deployment and public hosting separately.

Passing these programs establishes feature composition, not complete historical parity or production readiness. A historical program must first run successfully under the pinned Clio implementation before it is used as a parity measure. Deferred language semantics remain deferred.
