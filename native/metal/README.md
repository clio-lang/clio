# Apple device and transfer runtime

This optional native C++23/Objective-C++ library implements retained tensor storage and asynchronous CPU↔Metal transfers through the existing task scheduler. It has been exercised on an Apple M2 Max. No GPU arithmetic or `.kalandra` device-placement lowering is introduced here.

## Build

Use the existing pinned native Clang/LLVM toolchain and the system Foundation/Metal frameworks:

```sh
cmake --preset native -DKALANDRA_BUILD_METAL_RUNTIME=ON -DKALANDRA_BUILD_METAL_PROOF=OFF
cmake --build --preset native
ctest --preset native
```

The runtime does not require SPIRV-Cross, SPIRV-Tools, or the offline Metal shader compiler. Those are dependencies of the separate [shader toolchain proof](../metal-proof/README.md). Both options default to off in a fresh CPU-only configuration. Execution of the Metal tests requires access to an actual Metal device; missing device access is a test failure, not a skip or CPU fallback.

The default suite has 43 tests, including four new platform-independent external-completion suites. Enabling the transfer runtime adds four tests; enabling both Metal options gives 55 tests. The transfer tests build the bridge, scheduler, and harness in debug, optimized, ASan/UBSan, and separate TSan variants. Metal API validation is enabled. Host sanitizers do not instrument GPU/driver accesses, and no shader executes in the transfer tests.

## Private native interface

[Metal.h](Metal.h) exposes ordinary C++ values, not Objective-C objects or shader parameters:

- `Runtime::create` snapshots Metal devices sorted by registry ID and retains a command queue for each. The default index is zero unless configured; indexed/default selectors refer to that same snapshot. Missing devices and invalid defaults/indices return an explicit error.
- `hostTensor` checks rank (up to eight), nonnegative dimensions, byte-size arithmetic, and exact supplied byte length, then copies into an immutable host backing. A zero extent makes the payload empty even if an unused dimension is enormous. Rank zero represents one scalar element. Supported transfer representations are float32, uint32, and uint8; this does not declare arithmetic support for those formats.
- `Buffer` retains its backing through copies. Shape, format, and logical byte size are immutable. A host byte view is read-only and borrows from the buffer; the caller must retain it while using that view. A device buffer rejects host byte access. Raw Metal handles and writable backing pointers are not exposed.
- `upload` and `download` return ordinary `TaskHandle`s. Host callers submit to their root groups; native task entries can spawn transfer children in their own groups. Use `bufferLayout()` with the existing task observation/read protocol. Its copy function constructs a Buffer in uninitialized aligned output storage, as required by `ValueLayout`; callers must destroy that constructed value.
- An already-resident transfer returns a retained alias without submitting a command. Other transfers allocate fresh destination storage and use explicit private Metal buffers plus shared staging. Device buffers from another runtime registry and foreign target handles are rejected by this first bridge, even if the physical GPU is the same. General cross-registry/device transfers remain unsupported.

The first bridge is a trusted compiler/runtime C++ interface. Input spans must actually reference valid memory; checking their declared length cannot validate forged native pointers. It is not a public memory-safe FFI or a stable compiler-generated GPU ABI. Its Buffer ownership is implemented by retained opaque backings and the task value-layout destructor; it does not pretend that device buffers are allocations in the CPU `Invocation` ledger.

## Completion and lifetime

A transfer prepares all storage and encoders before reserving an external completion lease. The scheduler checks cancellation at that reservation under its mutex: a cancellation already recorded prevents submission; after reservation the backend owes an acknowledgement, even if cancellation arrives before the driver receives the command. This is the submission decision's linearization point. There is no claim that cancellation can retract a subsequent Metal commit or preempt submitted work.

The completion handler records command status and signals the one-shot capability. It does not execute Kalandra code, perform the download's host copy, or reclaim a task frame. The scheduler resumes the task only after its earlier execution lease has returned. Successful downloads materialize the host result on that resumed worker; only then can the result be published. Failure/cancellation paths discard unpublished results and staging during scheduler cleanup. The private completion-hold probe can deliberately block test callbacks; normal callbacks do not wait for GPU execution or task settlement.

Frame pinning protects inputs, staging, and destination storage until the command has finished. Cancellation/deadlines prevent successful publication and group settlement until acknowledgement and cleanup. Buffers can outlive their producing group or the Runtime facade because they retain their registry/backing. Dropping the Runtime facade also does not invalidate an admitted transfer packet. Core destruction cancels unfinished groups and waits for outstanding external acknowledgements. A backend must always signal a reserved token; losing it would prevent settlement.

The scheduler uses one event flag/epoch per admitted record and its existing bounded ready/deferred queues. Signals neither allocate an event queue nor create a thread per transfer. Duplicate, stale-generation, previous-epoch, and post-destruction tokens are rejected. A late token holds only a weak reference to scheduler state. `step` stays nonblocking; `drain` may wait on a condition variable for external completion when it still has a step budget. CPU worker threads are free to run other tasks. External waiting has no wall-clock timeout guarantee.

## Limits and failures

Each registry separately limits tracked backing/staging payload bytes (64 MiB by default) and reserved commands (64 by default). Checked buffer allocation also respects the selected device's `maxBufferLength`. Task records, groups, and frame/outcome storage retain the core's existing limits. These are complementary budgets, not a total-process or physical-GPU-memory cap. Driver pools, Objective-C/C++ control metadata, queue storage, and allocator overhead are excluded. The command reservation count drops at callback acknowledgement; staging may remain until scheduler cleanup and remains charged against the byte budget.

Allocation/encoder failures before reservation unwind without a command or published result. Command failure is an explicit failed task, never a successful zero-filled tensor. This private bridge uses `TaskFailure::Fault` with the `metal::Error` detail codes; task-table admission continues to use the existing AdmissionRejected path. Source-level mapping to the language's placement/task errors and transport of detailed Metal NSError payloads belong to the later compiler integration.

Synchronized diagnostic counters track managed backings, Metal buffer wrappers, staging buffers, payload bytes/peak bytes, command reservations, submissions, completions, and logical allocation attempts. Counters provide quiescent cleanup checks, not driver allocation/RSS measurements. Failure injection covers explicit bridge allocation and encoder checkpoints, not every hidden driver or standard-library allocation. The completion-failure probe substitutes a failed status after a real successful command; this is not a physical device-loss test. Diagnostic controls are private and are not exposed to Kalandra programs.

## Verification

The combined 55-test suite passes on the M2 Max. The optimized external-completion and transfer tests also pass with an explicitly optimized scheduler core.

[Transfer tests](Tests.cpp) cover exact round trips for zero through 8,193 elements with 1/2/4 CPU workers, retaining float32 bit patterns including both zeros, subnormals, infinities, quiet/signaling NaN encodings, and arbitrary bits. No floating arithmetic is performed. They also cover odd-sized uint8 copies, uint32 metadata, invalid shapes/ranks/byte lengths, immutable aliases, cached task observations, device results outliving groups, and same-residency transfers without commands.

Native supervisors spawn upload and download children, suspend through await/join, and return host tensors with a one-slot ready queue. Cancellation of a supervisor with a pending device child waits for acknowledgement. Other tests cover pre-admission cancellation, held committed transfers with cancellation and deadline requests, failed completion, each explicit host/upload/download allocation checkpoint, byte/in-flight budget rejection, 16 independent transfers on four workers, cross-registry rejection, dropped facade/input handles, and core teardown with a live command. Managed buffer/byte/command and task counters return to baseline after the relevant owners are dropped.

[External-completion tests](../tests/ExternalTaskTests.cpp) separately cover worker availability, completion arriving before resume returns, cancellation before reservation, cancellation/deadline/fault while pinned, repeated suspension epochs, duplicate/stale tokens, and destruction racing a foreign completion thread. Both suites include TSan without suppressing bridge or scheduler races.

The [Apple GPU contract](../../docs/design/apple-gpu.md) tracks the next gates. Transfer correctness does not fix the shader proof's strict float32 arithmetic failures. Kernel admission, source placement/transfer lowering, general tensor/CPU ABI interoperation, GPU compute, and NVIDIA support remain unimplemented.
