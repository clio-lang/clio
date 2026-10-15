# Kalandra native development

The fresh compiler is written in **C++23**, with direct LLVM/MLIR C++ integration. CMake configures the build, Ninja builds it, and CTest runs the tests. Bun and Node are not dependencies of this native development path.

The `native` branch contains the fresh language design and compiler. The released JavaScript prototype and Tiramisu website are separate from this build. The handwritten lexer/parser, [semantic stage](../docs/design/semantics.md), and [native source compiler](../docs/design/native-codegen.md) support float32 arithmetic and ranked dense float32 tensors. [Local tasks](../docs/design/native-tasks.md) support parallel blocks, spawn, await, and TaskError propagation through native continuations. A bounded pool now executes independent CPU tasks concurrently; set `KALANDRA_WORKERS=1..64` to override the detected count (capped at eight by default). Generated loops cooperate with cancellation. The [CPU scaling benchmark](benchmarks/README.md) now measures warmed generated kernels and scheduling overhead; results depend strongly on task size. See the [frontend grammar and limits](../docs/design/frontend.md).

## Build and test

On the currently validated macOS ARM64 setup:

```sh
cmake --preset native
cmake --build --preset native
ctest --preset native
```

The [toolchain lock](toolchain-proof/toolchain.json) selects LLVM/MLIR/Clang 22.1.8. CMake uses its installed Homebrew keg without changing global PATH. Override the location on initial configure with `-DKALANDRA_LLVM_ROOT=/path/to/llvm-22.1.8` or the corresponding environment variable. An existing CMake cache takes precedence over an environment change.

CMake 3.28 or newer and Ninja are required; the development machine has CMake 4.4.2 and Ninja 1.13.2. Matching compiler and LLVM/MLIR library versions are checked during configuration. A compiler that cannot build the required C++23 facilities fails the build rather than selecting an older language mode. Debug and release configurations must preserve the numerical contract.

A clean configure, build, and the original five toolchain CTest tests also pass with PATH restricted to `/usr/bin:/bin`, invoking CMake/Ninja by absolute paths. This verifies that the native path does not depend on Bun/Node being discoverable.

## Implementation conventions

- Use C++23 with compiler extensions disabled. Add standard-library features only after validating them with the supported compiler and platform library.
- Prefer values, RAII, `std::unique_ptr` for unique ownership, and stable source-buffer ownership for any borrowed source spans. Raw pointers/references express documented non-owning access, not hidden ownership.
- Use `std::expected` for recoverable frontend/IO diagnostics. Treat invalid source as a reported error, not an assertion failure. Unexpected process-level allocation failure needs a separate top-level policy before the compiler accepts arbitrary inputs.
- Keep source locations, AST, resolution/type checking, and lowering separate. Build a focused lexer/parser for the fresh syntax; do not reproduce the prototype's parser ambiguities.
- Keep MLIR contexts/modules under their owning API wrappers, verify constructed IR, and preserve shape, failure, and numerical semantics through lowering.
- Keep templates and abstractions small and useful. C++ implementation complexity should not become language syntax or user-facing memory management.
- Test behavior and diagnostics through CTest. Use sanitizers for relevant native memory paths, while keeping their coverage limits explicit.

Compiler implementation ownership is separate from Kalandra's automatic memory model. Using RAII inside the compiler does not require Kalandra authors to write destructors, allocators, or lifetime annotations.

## Current targets

| Target                    | Purpose                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| `kalandrac`               | Compile the checked CPU subset through MLIR/LLVM into a native executable                 |
| `kalandra-backend`        | Native MLIR construction, verified passes, LLVM translation                               |
| `kalandra-native-runtime` | Invocation storage, checked faults, bounded task scheduler, and development entry wrapper |
| `kalandra-check`          | Symbol/type/shape checking and `--dump-ir` inspection                                     |
| `kalandra-semantics`      | Typed values, resolved calls, shape facts/guards, strict numeric metadata                 |
| `kalandra-parse`          | Handwritten lexer/parser CLI with source diagnostics (syntax only)                        |
| `kalandra-syntax`         | Source ownership, tokens, AST, lexer, recursive-descent/Pratt parser                      |
| `kalandra-mlir-check`     | C++23 tool that parses/verifies MLIR through linked native APIs                           |
| `kalandra-proof-cases`    | Independent scalar numerical reference and fixed-seed input generator                     |
| `native-toolchain-proof`  | Bufferization, ownership lowering, LLVM translation, and three native proof binaries      |

Read the [toolchain proof](toolchain-proof/README.md) for evidence and limits. The sequential CPU conformance sweep and initial source task integration pass. The 39 CTest tests include debug, optimized, ASan/UBSan, and separate ThreadSanitizer variants. Native TaskError recovery (`catch`, typed matching/fields, and handler-local propagation) now also passes its compiled conformance suites. Multi-worker execution, execution leases, and CPU-loop cancellation polling now pass their concurrency suites. The [scratch reuse comparison](../benchmarks/results/native-cpu-2026-10-15-scratch.md) now records bounded matrix scratch allocation and its throughput effect. The [scheduler profile](../benchmarks/results/native-scheduler-2026-10-15.md) now separates phase timings, table-capacity controls, and optional diagnostic probes. The [idle-wakeup optimization](../benchmarks/results/native-scheduler-2026-10-15-wakeups.md) now reduces those overheads with held-lease/controller regression coverage. The [targeted-wakeup comparison](../benchmarks/results/native-scheduler-2026-10-15-targeted.md) now records separate worker/controller channels and active-phase improvements. The [runnable tracking comparison](../benchmarks/results/native-scheduler-2026-10-15-runnable.md) now records explicit ready events and a bounded deferred FIFO, with one-slot spawn/fairness/cancellation regressions. The [maintenance comparison](../benchmarks/results/native-scheduler-2026-10-15-maintenance.md) now records bounded occupancy indexes for unfinished tasks and live records/groups, with sparse-slot and deep nested-wait coverage. The [task-maintenance fast path](../benchmarks/results/native-scheduler-2026-10-15-dense.md) now skips task scans when no waiter or settlement needs progress. The [four-column SIMD comparison](../benchmarks/results/native-cpu-2026-10-15-simd.md) now records the first CPU microtile optimization, with strict per-cell arithmetic and tail/ownership coverage. The [37-shape comparison](../benchmarks/results/native-shapes-2026-10-15.md) identifies narrow dispatch and tail costs; the [two-lane follow-up](../benchmarks/results/native-shapes-2026-10-15-pairs.md) records implemented narrow dispatch and paired tails, with 717 per-cell/shared cases and extended in-loop cancellation coverage. The [cache-layout evaluation](../benchmarks/results/native-cache-2026-10-15.md) now compares larger rectangles and strict C++ prototypes with matched layout controls and a vendor-library reference; that research now informs the [MLIR 4×16/K256 port](../benchmarks/results/native-mlir-blocking-2026-10-15.md), with 3,727 per-cell/shared cases, a 506-shape actual allocation probe, and renewed cancellation/sanitizer coverage. The [CPU milestone](../docs/design/cpu-milestone.md) and [task contract](../docs/design/native-tasks.md) track the remaining gates.

C++ formatting uses the root `.clang-format` with LLVM style. For the current C++ sources:

```sh
/opt/homebrew/Cellar/llvm/22.1.8/bin/clang-format --dry-run --Werror \
  native/tools/*.cpp native/lib/*.cpp native/include/kalandra/*.h \
  native/tests/*.cpp native/toolchain-proof/cases.cpp
```

Use `kalandrac --sanitize` for generated AddressSanitizer checks plus the ASan/UBSan runtime, or `--thread-sanitize` for a separate fully instrumented ThreadSanitizer build. These options cannot be combined. The emitted LLVM functions carry the required sanitizer attributes; conformance verifies that Clang emits actual memory checks. The C++ task-core configuration defaults to one worker for deterministic tests; compiled programs use the bounded pool described above.

## Apple GPU toolchain proof

An opt-in [Metal proof](metal-proof/README.md) now runs MLIR GPU kernels through SPIR-V and SPIRV-Cross on Apple Silicon. It validates buffer bindings, explicit copies, partial workgroups, and completion. IEEE edge probes expose a strict float32 compatibility gap, so this is not yet Kalandra GPU source support. The [backend contract](../docs/design/apple-gpu.md) records the implementation gates; CPU builds do not require the optional shader tools.

## Apple device and transfer runtime

The optional [Metal runtime](metal/README.md) now provides immutable host/device buffers and upload/download tasks integrated with CPU task groups. External completion leases keep pending GPU resources alive through cancellation and resume tasks without blocking workers. Transfer tests include nested groups, exact bit preservation, resource budgets, allocation failures, and sanitizer coverage. This bridge does not yet implement source-level GPU placement or arithmetic.
