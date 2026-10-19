# Function-containing parameters across CPU workers

Implemented native subset — 2026-10-20. Statically named CPU functions can forward and return function-containing parameters, including records, ordinary enums, function arrays and record arrays. Returned closures may capture these parameters. This extends [aggregate worker transport](native-worker-callable-aggregates.md).

```kalandra
fn double(value: int) -> int:
  value * 2

fn apply(value: int, transform: fn(int) -> int) -> int:
  transform(value)

fn forward(transform: fn(int) -> int) -> int ! TaskError:
  try parallel:
    try await spawn apply(21, transform)

fn main() -> int ! TaskError:
  try parallel:
    try await spawn forward(double)
```

The result is `42`. The outer worker receives `double` and forwards it to a child worker. A worker can also return a function parameter unchanged, or return a closure capturing an incoming function array. The existing checked copying and retained ownership apply at every boundary; callers need no transport annotations.

## What the compiler proves

The compiler builds a whole-module source graph. Every direct call supplies sources for the callee's parameters. A closure construction supplies sources for its lifted capture parameters. Proof follows those sources through immutable aliases, constructors, branches, direct results and existing aggregate projections. Recursive direct-call edges reuse visited expression identities, subject to the existing analysis work budget. A parameter without a source is rejected at a function transport boundary.

All sources must pass the existing synchronous CPU capture checks. A safe caller does not excuse an unproven source at another call site. This is deliberately conservative and context-insensitive: a local-only use of a factory with an unproven argument can also prevent transporting that factory's result elsewhere. The analysis does not specialize functions for each caller or assume that a branch will never execute.

Explicit parameters of a function that is also used as a function value or named map callback remain unproven for transport. Such parameters may receive values through indirect calls or map callbacks, which the direct-call source graph does not yet model. This restriction also applies if an alias is created but never called. Likewise, results produced by an indirect factory invocation remain staged. Ordinary synchronous higher-order calls retain their existing support; the restriction concerns proving the values that subsequently cross worker boundaries.

Function parameters whose callbacks declare expected errors work when their error payloads use the existing supported data types. Function-containing expected-error payloads, indirect spawn, spawned collection/map boundaries containing functions, GPU callbacks and distributed execution remain separate work.

## Qualification

The final focused selection passed **61/61 CTest checks**. This is not the full project suite. The execution catalog covers scalar function forwarding, nested coordinators, returned functions, captured function arrays, records, enums, record arrays, aliases, recursive direct helpers, cached outcomes, retained data after producer completion, and forwarded callback errors. It runs in debug, optimized, ASan/UBSan and separate ThreadSanitizer modes, with worker counts 1, 2 and 4 and allocation-failure probes.

Rejection checks cover mixed proven/unproven callers, aggregate sources, explicit parameters of aliased functions and named map callbacks, source-less recursive provenance, and unsupported data hidden in a captured record. Rejected programs must preserve existing executable, LLVM and MLIR outputs. See the [qualification record](../../native/metal-proof/evidence/cpu-worker-parameters-2026-10-20.json) for the final selected checks and results.
