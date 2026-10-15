# Apple device, transfer, and compute runtime

This optional native C++23/Objective-C++ library implements retained tensor storage and asynchronous CPU↔Metal transfers through the existing task scheduler. It has been exercised on an Apple M2 Max. It also dispatches a private strict binary32 elementwise kernel through managed tasks. A separate optional source compiler now uses this bridge for a first bounded `.kalandra` placement slice.

## Build

Use the existing pinned native Clang/LLVM toolchain and the system Foundation/Metal frameworks:

```sh
cmake --preset native -DKALANDRA_BUILD_METAL_RUNTIME=ON -DKALANDRA_BUILD_METAL_PROOF=OFF
cmake --build --preset native
ctest --preset native
```

The runtime does not require SPIRV-Cross, SPIRV-Tools, or the offline Metal shader compiler. Those are dependencies of the separate [shader toolchain proof](../metal-proof/README.md). Both options default to off in a fresh CPU-only configuration. Execution of the Metal tests requires access to an actual Metal device; missing device access is a test failure, not a skip or CPU fallback.

The CPU-only suite has 47 tests, including platform-independent external-completion and allocation-lease coverage. Enabling the transfer runtime adds four tests; enabling both Metal options also builds the optional source compiler and its source/CLI conformance suites. The transfer tests build the bridge, scheduler, and harness in debug, optimized, ASan/UBSan, and separate TSan variants. Metal API validation is enabled. Host sanitizers do not instrument GPU/driver accesses, and no shader executes in the transfer tests. The separate compute tests execute the MLIR-generated strict shader on the GPU.

## Private native interface

[Metal.h](Metal.h) exposes ordinary C++ values, not Objective-C objects or shader parameters:

- `Runtime::create` snapshots Metal devices sorted by registry ID and retains a command queue for each. The default index is zero unless configured; indexed/default selectors refer to that same snapshot. Missing devices and invalid defaults/indices return an explicit error.
- `hostTensor` checks rank (up to eight), nonnegative dimensions, byte-size arithmetic, and exact supplied byte length, then copies into an immutable host backing. A zero extent makes the payload empty even if an unused dimension is enormous. Rank zero represents one scalar element. Supported transfer representations are float32, uint32, and uint8; this does not declare arithmetic support for those formats.
- `Buffer` retains its backing through copies. Shape, format, and logical byte size are immutable. A host byte view is read-only and borrows from the buffer; the caller must retain it while using that view. A device buffer rejects host byte access. Raw Metal handles and writable backing pointers are not exposed.
- `upload` and `download` return ordinary `TaskHandle`s. Host callers submit to their root groups; native task entries can spawn transfer children in their own groups. Use `bufferLayout()` with the existing task observation/read protocol. Its copy function constructs a Buffer in uninitialized aligned output storage, as required by `ValueLayout`; callers must destroy that constructed value.
- An already-resident transfer returns a retained alias without submitting a command. Other transfers allocate fresh destination storage and use explicit private Metal buffers plus shared staging. Device buffers from another runtime registry and foreign target handles are rejected by this first bridge, even if the physical GPU is the same. General cross-registry/device transfers remain unsupported.

The first bridge is a trusted compiler/runtime C++ interface. Input spans must actually reference valid memory; checking their declared length cannot validate forged native pointers. It is not a public memory-safe FFI or a stable compiler-generated GPU ABI. Its Buffer ownership is implemented by retained opaque backings and the task value-layout destructor; it does not pretend that device buffers are allocations in the CPU `Invocation` ledger.

## Managed compute

With both Metal options enabled, the build produces `native/metal-proof/runtime.metallib` through the existing strict integer MLIR → SPIR-V → SPIRV-Cross → Metal pipeline. Its dynamic arrays replace the numerical proof fixture's fixed capacity. The runtime itself still loads precompiled libraries and does not depend on shader compiler tools at execution time.

```sh
cmake --preset native -DKALANDRA_BUILD_METAL_RUNTIME=ON -DKALANDRA_BUILD_METAL_PROOF=ON
cmake --build --preset native
ctest --preset native -R 'native-metal|metal-runtime-artifacts'
```

`loadBinary32Kernel(path, device)` loads the trusted generated artifact and checks its entry point, four buffer bindings, element layouts, and minimum workgroup capacity using Metal reflection. The artifact test separately checks the SPIR-V entry/workgroup, runtime-array layout, Int64 operations, and absence of floating arithmetic. Reflection cannot prove an arbitrary shader's numerical behavior or memory safety. This is a private compiler/runtime interface, not an untrusted shader loader or a stable extension ABI.

`compute(core, group, kernel, operation, left, right)` and the native-task overload return ordinary buffer-valued tasks. The first subset accepts equal-length rank-one float32 device buffers in the kernel's own runtime/device registry. It supports addition, multiplication, and separately rounded `(left * right) + left`; these private operation selectors are not new language syntax. Wrong ranks, formats, shapes, operation tags, empty handles, host inputs, and foreign registries fail explicitly before command submission. There is no upload or CPU fallback inside compute. Length is bounded by uint32 indexing, the byte budget, and Metal buffer limits; no 4,096-element fixture limit remains.

Every result has a fresh immutable device backing. Await/read does not download it; an explicit download is required for host access. Empty vectors produce an empty device result without dispatch. Nonempty dispatches use guarded 64-thread workgroups and an eight-byte retained parameter buffer charged to the same byte budget as tensor/staging storage. Compute and transfer tasks share command limits and the external-completion protocol below. Inputs, pipeline, parameters, and unpublished output remain alive through acknowledgement, including parent cancellation and core destruction.

The shader preserves strict float32 through integer arithmetic. This establishes correctness for the tested subset, not a GPU performance claim. A narrow source compiler now generates placed functions against a separate `kalandra_elementwise` kernel entry through `loadElementwiseKernel`/`elementwise`. It shares the checked buffer geometry and completion protocol, without the numerical proof's operation selector. Checked `fromCpu`/`toCpu` descriptor interoperation now connects this storage to CPU invocation allocations. General tensor operations, complete source error mapping, and mixed-source lowering remain subsequent work.

## Completion and lifetime

A transfer or compute task prepares all storage and encoders before reserving an external completion lease. The scheduler checks cancellation at that reservation under its mutex: a cancellation already recorded prevents submission; after reservation the backend owes an acknowledgement, even if cancellation arrives before the driver receives the command. This is the submission decision's linearization point. There is no claim that cancellation can retract a subsequent Metal commit or preempt submitted work.

The completion handler records command status and signals the one-shot capability. It does not execute Kalandra code, perform the download's host copy, or reclaim a task frame. The scheduler resumes the task only after its earlier execution lease has returned. Successful downloads materialize the host result on that resumed worker; only then can the result be published. Failure/cancellation paths discard unpublished results and staging during scheduler cleanup. The private completion-hold probe can deliberately block test callbacks; normal callbacks do not wait for GPU execution or task settlement.

Frame pinning protects inputs, pipeline/parameters, staging, and destination storage until the command has finished. Cancellation/deadlines prevent successful publication and group settlement until acknowledgement and cleanup. Buffers can outlive their producing group or the Runtime facade because they retain their registry/backing. Dropping the Runtime facade also does not invalidate an admitted transfer packet. Core destruction cancels unfinished groups and waits for outstanding external acknowledgements. A backend must always signal a reserved token; losing it would prevent settlement.

The scheduler uses one event flag/epoch per admitted record and its existing bounded ready/deferred queues. Signals neither allocate an event queue nor create a thread per transfer. Duplicate, stale-generation, previous-epoch, and post-destruction tokens are rejected. A late token holds only a weak reference to scheduler state. `step` stays nonblocking; `drain` may wait on a condition variable for external completion when it still has a step budget. CPU worker threads are free to run other tasks. External waiting has no wall-clock timeout guarantee.

## Limits and failures

Each registry separately limits tracked backing/staging payload bytes (64 MiB by default) and reserved commands (64 by default). Checked buffer allocation also respects the selected device's `maxBufferLength`. Task records, groups, and frame/outcome storage retain the core's existing limits. These are complementary budgets, not a total-process or physical-GPU-memory cap. Driver pools, Objective-C/C++ control metadata, queue storage, and allocator overhead are excluded. The command reservation count drops at callback acknowledgement; staging may remain until scheduler cleanup and remains charged against the byte budget.

Allocation/encoder failures before reservation unwind without a command or published result. Command failure is an explicit failed task, never a successful zero-filled tensor. This private bridge uses `TaskFailure::Fault` with the `metal::Error` detail codes; task-table admission continues to use the existing AdmissionRejected path. Source-level mapping to the language's placement/task errors and transport of detailed Metal NSError payloads belong to the later compiler integration.

Synchronized diagnostic counters track managed backings, Metal buffer wrappers, staging buffers, payload bytes/peak bytes, command reservations, submissions, completions, and logical allocation attempts. Counters provide quiescent cleanup checks, not driver allocation/RSS measurements. Failure injection covers explicit bridge allocation and encoder checkpoints, not every hidden driver or standard-library allocation. The completion-failure probe substitutes a failed status after a real successful command; this is not a physical device-loss test. Diagnostic controls are private and are not exposed to Kalandra programs.

## Verification

The combined native suite passes on the M2 Max. The optimized external-completion and transfer tests also pass with an explicitly optimized scheduler core.

[Transfer tests](Tests.cpp) cover exact round trips for zero through 8,193 elements with 1/2/4 CPU workers, retaining float32 bit patterns including both zeros, subnormals, infinities, quiet/signaling NaN encodings, and arbitrary bits. No floating arithmetic is performed. They also cover odd-sized uint8 copies, uint32 metadata, invalid shapes/ranks/byte lengths, immutable aliases, cached task observations, device results outliving groups, and same-residency transfers without commands.

Native supervisors spawn upload and download children, suspend through await/join, and return host tensors with a one-slot ready queue. Cancellation of a supervisor with a pending device child waits for acknowledgement. Other tests cover pre-admission cancellation, held committed transfers with cancellation and deadline requests, failed completion, each explicit host/upload/download allocation checkpoint, byte/in-flight budget rejection, 16 independent transfers on four workers, cross-registry rejection, dropped facade/input handles, and core teardown with a live command. Managed buffer/byte/command and task counters return to baseline after the relevant owners are dropped.

[External-completion tests](../tests/ExternalTaskTests.cpp) separately cover worker availability, completion arriving before resume returns, cancellation before reservation, cancellation/deadline/fault while pinned, repeated suspension epochs, duplicate/stale tokens, and destruction racing a foreign completion thread. Both suites include TSan without suppressing bridge or scheduler races.

The [Apple GPU contract](../../docs/design/apple-gpu.md) tracks the next gates. Transfer correctness does not fix the original hardware shader's strict float32 failures. The [integer arithmetic lowering](../../docs/design/strict-gpu-float32.md) is now connected to managed compute tasks through the private ABI described above. A [first optional source compiler slice](../../docs/design/apple-gpu.md#first-source-to-metal-compiler-slice) now lowers explicit source transfers and placed rank-one float32 calls through this bridge. A checked dense float32 CPU tensor bridge now passes native interoperability tests. General mixed-source lowering, GPU matmul/reductions, and NVIDIA support remain unimplemented.

[Compute conformance](ComputeTests.cpp) runs the complete 583,238-pair IEEE corpus against APFloat for all three operations through actual managed uploads, dispatches, and downloads. Prefix/tail cases span zero to 8,193 elements with 1/2/4 workers, nested CPU supervisors, and a one-slot ready queue. Repeated observations and results retained after group release bring the total to 2,121,882 APFloat comparisons per build variant, with zero mismatches. NaNs compare by classification; other outputs compare exact bits. Input buffers are downloaded and checked unchanged. The debug, optimized, ASan/UBSan, and TSan harnesses use the same generated shader; sanitizers instrument host code, not the GPU or prebuilt LLVM reference library.

Compute tests also cover incompatible fixed-capacity artifacts, invalid paths/device registries, explicit admission failures, every compute allocation/encoder checkpoint, failed completion, parameter-byte and command budgets, 16 concurrent commands, cancellation/deadline acknowledgement, nested parent cancellation, pending core destruction, dropped facade/kernel/input handles, and counter cleanup. Group deadline failures remain `DeadlineExceeded`; their cancelled children follow the existing `Cancelled` task outcome contract. These are conformance runs, not benchmarks.

The [recorded compute evidence](../metal-proof/evidence/managed-compute-2026-10-15.json) identifies the tested sources, generated artifacts, toolchain, comparison counts, and complete 68-test run.

The [common compiler and CPU tensor ABI](../../docs/design/apple-gpu.md#common-compiler-entry-and-cpu-tensor-abi) documents `kalandrac --target metal`, ranked descriptors, retained CPU allocation leases, full-backing byte charges for imported views, and checked copies of downloaded results into CPU invocation storage. Nonempty imports validate actual allocation membership and bounds before payload access. A retained alias survives its source invocation; a copied CPU export survives the GPU group and buffers. These are trusted immutable compiler/runtime values, not a public mutable native-pointer API.

## Source kernel signatures

The source compiler also emits `kalandra_elementwise_v2` for one or two dense rank-one/rank-two float32 inputs with up to eight float32 scalar parameters. Use `loadElementwiseKernel(path, device, ElementwiseSignature{tensorCount, scalarCount})` and the `elementwise` overload taking tensor/scalar spans. Submission copies both Buffer owners and scalar bits; the spans may be released or changed immediately afterward. Counts must match the loaded signature. All tensors must reside on its device and have equal ranks and complete shapes, not just equal byte lengths. Outputs preserve that shape. The older private `compute` operation interface remains rank-one.

Bindings contain packed tensor inputs, output, then a uint32 array with element count and scalar bits. Reflection checks the declared signature. Parameter storage is four bytes plus four per scalar, charged to the shared budget and retained until completion acknowledgement. Empty outputs require no encoded command. The existing two-input/no-scalar source ABI and proof kernel remain supported by their original overloads. See the [source scope and conformance](../../docs/design/apple-gpu.md#gpu-entry-scalar-parameters).

See [matrix helpers and resident pipeline qualification](../../docs/design/apple-gpu.md#rank-two-gpu-elementwise-helpers) for strict scalar lifting, transitive helpers, per-axis guards and source/runtime conformance.

## Reduction tasks and scalar outcomes

`loadReductionKernel(path, device)` validates the private source-generated `kalandra_reduce_sum` entry. `reduceSum(core, group, kernel, input)` and its Task overload return float32-valued tasks observed with `Runtime::scalarLayout()`. Inputs must be dense rank-one or rank-two float32 device buffers in the loaded kernel's registry/device. Empty input returns positive zero with no command; singleton input preserves exact bits. Unsupported kinds, formats, ranks and residency fail before submission.

Nonempty reductions encode the fixed adjacent-pair tree in flat row-major order, carrying an odd element forward, and read back only the final four-byte scalar. Each invocation reuses two private output buffers, sized for its first two levels; later levels only shrink. One explicitly serial compute encoder preserves dispatch and resource ordering across all levels. Fallible scratch/count preparation finishes before the encoder opens. Each level still has its own immutable count word. The input, kernel, both output buffers and scalar staging remain retained through command acknowledgement, including cancellation. Scratch, parameter and readback bytes share the existing budget; one command admission covers the complete tree and final scalar copy. Cancellation cannot preempt the encoded tree. See [source scope, numerical evidence and limitations](../../docs/design/apple-gpu.md#rank-one-gpu-reductions).

The [scratch reuse comparison](../../benchmarks/results/native-gpu-2026-10-15-reduction-reuse.md) records memory bounds and warm timing. Scratch is local to each invocation; cancellation of one reduction does not affect another. The [serial batching comparison](../../benchmarks/results/native-gpu-2026-10-16-reduction-batching.md) now records one encoder for all levels, unchanged memory bounds and roughly flat warm latency; no throughput improvement is claimed.

Matrix results can feed a reduction on the same device without downloading their elements. Only the final scalar is copied to the host. Source parameter ranks remain checked; rank-zero/rank-three and non-float32 inputs are rejected. See [rank-two reduction scope and conformance](../../docs/design/apple-gpu.md#rank-two-gpu-reductions).

## Matrix multiplication tasks

`loadMatmulKernel(path, device)` checks the private `kalandra_matmul` entry: two runtime float32 input arrays, one output array, and uint32 `[M, K, N]` parameters. `matmul(core, group, kernel, left, right)` and the Task overload accept rank-two device tensors `[M,K]` and `[K,N]` in the kernel's registry/device and return a fresh immutable device tensor `[M,N]`. Admission checks inner dimensions, uint32 indexing bounds and existing allocation/device budgets. Awaiting the result does not download it.

The shader preserves separately rounded products and the fixed adjacent-pair tree with 32 private subtree roots per lane. Empty output has no dispatch; zero contraction length produces positive zero without reading empty inputs. One asynchronous command retains both inputs, output, pipeline and 12-byte parameters through completion acknowledgement. Cancellation cannot preempt its per-cell contraction loop. See [source scope, numerical evidence and limitations](../../docs/design/apple-gpu.md#rank-two-gpu-matrix-multiplication). No GPU speed claim has been established.

Matmul bundles now include scalar, two-row and 2×2 entries generated through the strict MLIR pipeline. On the profiled Apple M2 Max, the runtime validates all three interfaces and chooses a conservative layout from the actual M/K/N dimensions. Other GPUs and shapes outside the profile use the scalar GPU entry. See the [profile and its limits](../../docs/design/apple-gpu.md#shape-selected-register-matmul). This changes kernel selection and workgroup counts without adding tensor copies, implicit transfers or relaxed arithmetic. Managed payload budgets do not account for driver pipeline/private workspace storage.
