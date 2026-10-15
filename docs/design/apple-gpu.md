# Apple GPU backend contract

Status: executable shader toolchain evidence, managed device/transfer/compute tasks, and a first optional source-to-Metal compiler slice. Apple Silicon/Metal is the first GPU target; NVIDIA/CUDA on Windows follows. Metal source support is an optional native compiler target; the released JavaScript prototype is unchanged.

This implements the direction in [placement and transfers](placement.md), [tensor semantics](tensors.md), and [numeric semantics](numbers.md). Those language contracts remain authoritative. The [Metal toolchain proof](../../native/metal-proof/README.md) now executes generated shaders on an Apple M2 Max; its direct hardware path exposes a strict float32 compatibility gap. A separate [integer lowering](strict-gpu-float32.md) now passes scalar add/multiply conformance on that device.

## Compiler boundary

Keep the typed scalar/tensor IR and target admission shared. CPU, Metal, and future CUDA backends consume the same logical operations and source numeric policy. Device launch layout, buffer binding, and synchronization are backend details; source does not acquire Metal buffer indices or NVIDIA block syntax.

For Metal, use explicit GPU kernel IR, conversion to SPIR-V, SPIRV-Cross to Metal Shading Language, and offline compilation to a Metal library. The proof establishes this route starting at handwritten GPU IR. The optional source compiler now lowers a small rank-one elementwise subset with guarded indexing and explicit placement. General tensor-to-GPU scheduling and integration with the CPU tensor ABI remain subsequent work. Do not serialize CPU memref descriptors into shader parameters or expose arbitrary host pointers to a shader.

A compiled kernel artifact must carry a revisioned interface manifest: entry point, logical parameter order, Metal buffer slots, scalar widths, tensor rank/element format, shape/stride requirements, launch dimensions and workgroup size, required device features, and numerical policy. Validate the interface against reflection and bind against the manifest. The proof fixes one interface and checks it; it does not yet implement a general artifact format.

The first production subset should use dense float32 tensors and supported scalars, with explicit bounds checks and fresh immutable outputs. Pure ordinary helper calls follow the selected device. Transitive admission rejects host effects, nested spawning, arbitrary callbacks, unsupported formats, and unsupported numeric policies before GPU submission. Float64 must not become float32. Wider types, general control flow, reductions, matmul, and tensor acceleration need their own capability and numerical evidence.

## Device selection and admission

`devices.gpu()` selects one stable configured device, falling back to exposed index zero only when no default is configured. `devices.gpu(index)` chooses an exposed device; do not change identity between calls to balance load. The runtime retains the selected Metal device identity for the application. Missing devices, invalid indices, unsupported kernels/formats, and residency mismatches fail admission with the placement/task error contract. There is no automatic CPU fallback.

Before allocating or submitting, validate kernel/interface revision, device identity, tensor residency, rank/shape compatibility, checked dimension/byte/index arithmetic, launch limits, device buffer-size limits, and numerical capability. Reject unsupported inputs without partially publishing a result. GPU indices may use 32 bits for this first subset only if host checks prove every extent, offset, and launch index fits; CPU dimensions do not implicitly truncate. The proof's 4,096-element limit belongs only to its fixed fixture.

## Storage and transfers

Represent device tensor storage by an opaque, retained backing object associated with a specific device. Logical tensor type remains independent of residency. A descriptor records immutable shape, element format, checked capacity/offset, and residency; clients cannot forge an MTLBuffer or host pointer into it.

`transfer(tensor, target)` returns a task under the existing group/error rules. Awaiting it produces a tensor available at the destination. Awaiting a device tensor result completes computation without implicitly downloading it; explicit CPU transfer permits host indexing. Small scalar task results are copied at completion as specified by placement.

Begin with private Metal buffers and explicit staging copies. This costs copies on unified memory but gives the first implementation a clear boundary to verify. Later shared-storage and redundant-transfer optimizations must preserve logical residency, immutable aliases, synchronization, and lifetime behavior. The [native transfer runtime](../../native/metal/README.md) now implements opaque retained host/device backings, private buffers and staging, with checked shape/byte admission. This is a private C++ task bridge; source lowering and the general tensor ABI remain to implement.

Retain inputs, output, staging storage, the kernel/pipeline, and command state until GPU completion. A dropped source binding, failed parent, or cancelled task cannot release storage still referenced by submitted commands. Publish an immutable result only after successful completion and status checks. Completed tensor storage can outlive its task group through normal managed ownership. Failure before submission unwinds locally; failure after submission settles only when outstanding GPU access has ended.

## Completion, cancellation, and errors

Do not block a CPU worker awaiting a GPU command. Submission yields a pending task; a Metal completion callback queues a bounded scheduler event. The callback does not execute Kalandra handlers or resume source continuations directly. The scheduler consumes the event, checks completion/error/cancellation state, publishes at most one outcome, and settles owners under the existing task rules. The shader toolchain proof still uses a host semaphore as a harness. The separate native transfer runtime now uses scheduler completion capabilities, without a semaphore or waiting CPU worker. Download host copies and result publication run on the resumed scheduler task.

The scheduler completion reservation is the submission decision: cancellation already recorded at that point discards unsubmitted work. Once reserved, the backend must acknowledge completion even if cancellation races the subsequent Metal commit. After that decision, cancellation/deadline marks the task as unwanted and prevents successful outcome publication, but does not promise to preempt a running shader. Command references stay alive until completion; settlement and acknowledgement wait for safe cleanup. Cancellation latency can therefore include the outstanding dispatch. Kernels needing tighter bounds must be split into bounded dispatches before such a guarantee is offered.

Allocation, upload, pipeline creation, submission, and command-completion failures map to the established task/fault model while retaining backend diagnostics at the reporting boundary. Do not invent shader-side C++ exceptions or treat a failed command as a valid zero tensor. Size guards and shape errors occur before execution wherever possible. General device-reset/crash containment is not established by successful command-error reporting.

## Strict arithmetic remains an explicit capability gate

The accepted baseline preserves float32 subnormals, signed zero, infinities, NaN classification, separate product rounding, and the specified reduction tree. The M2 Max proof passes finite/separate-rounding samples but fails subnormal arithmetic. Its decorated SPIRV-Cross path also changes a signed-zero case. The compiler-controlled diagnostic fixes that case, but still fails subnormal samples even with fast math and contraction disabled.

Consequently, neither direct hardware proof variant qualifies as an implementation of general strict float32 arithmetic. The source compiler must not admit it as one. This is a backend capability failure, not a reason to change the numeric design implicitly or inspect only current runtime inputs and assume the rest are safe.

The subsequent [strict binary32 lowering](strict-gpu-float32.md) now implements scalar add/multiply through integer MLIR operations, including gradual underflow, signed zero, nonfinite cases, and nearest/ties-to-even rounding. CPU LLVM and Metal differential tests pass against LLVM APFloat and CPU hardware. It requires the strict artifact's Int64/MSL 2.2 profile. The private native bridge now uses this lowering for managed rank-one elementwise compute tasks with explicit transfers, checked bindings/residency, retained parameters, and cancellation-safe acknowledgement. Source placement and unsupported arithmetic/tensor kernels remain gated.

The integer implementation preserves the existing contract for its tested subset; no alternative numerical policy is selected. Further operations require corresponding lowering and evidence. Hardware/software correction costs still need measurement before claiming a fast strict backend. Merely offering a fused operation, accepting flush-to-zero as a default, or substituting a vendor matmul would change semantics and is not authorized by this proof.

## Implementation sequence and acceptance

1. **Toolchain proof — complete.** Actual MLIR GPU → SPIR-V → Metal compilation and execution, reflected binding checks, explicit copies, partial workgroups, unchanged inputs, host sanitizer coverage, and recorded strict-arithmetic failures. No speed claim.
2. **Device/storage runtime — implemented as a private native bridge.** Stable device selection, opaque retained buffers, checked sizes, explicit upload/download tasks, zero-sized tensors, scheduler completion capabilities, and transactional failure cleanup now have native tests, including nested groups, cancellation/deadline acknowledgement, dropped owners, budgets, and failure injection. ASan/UBSan and separate TSan cover host/bridge/scheduler code. Source-level transfers and the general tensor ABI remain a later gate.
3. **Numeric compatibility — scalar add/multiply implemented.** Integer lowering now passes IEEE edge, exponent/sign strata, cancellation, and random-value checks on CPU LLVM and Metal, including separately rounded multiplication then addition. Independent APFloat/CPU references and artifact inspection gate this subset. Other operations/types remain unsupported, and performance is unmeasured.
4. **Managed compute — implemented for the strict binary32 subset.** The generated dynamic-array shader now executes through buffer-valued native tasks. Explicit uploads/dispatch/downloads, IEEE differential checks, immutable inputs, nested groups, resource limits, transactional failures, cancellation/deadlines, and host sanitizers pass. This is a private runtime integration, not source placement.
5. **First source vertical slice — implemented for a bounded subset.** The optional source compiler now generates strict GPU MLIR from actual rank-one float32 function bodies, plus native C++ supervisor continuations. Its build driver produces a runnable executable/shader bundle. Explicit transfers, placed spawn/await, indexed/aliased targets, transitive helpers, scalar constants, repeated calls, failure injection, cancellation/deadlines, and cleanup have executable tests. The common compiler entry point and a checked CPU tensor bridge now serve this subset. General mixed-source checking/lowering remains subsequent work. See the scope below.
6. **CPU/GPU tensor bridge — implemented for dense float32 values.** The common compiler selects CPU/Metal targets, retained CPU allocation leases feed explicit GPU uploads, and checked downloads export invocation-owned descriptors consumed by actual MLIR-generated CPU code. Target-specific source lowering remains; arbitrary mixed-source programs and dynamic external-input entry points are later work.
7. **Tensor kernels and measurement — first baseline implemented.** Direct rank-one reductions and rank-two matmul preserve the accepted tree and rounding. The [initial CPU/Metal performance report](../../benchmarks/results/native-gpu-2026-10-15.md) separates preallocated GPU command intervals, managed resident tasks and complete transfer paths. Matmul kernel optimization, broader kernels and application-level measurement remain ahead.
8. **NVIDIA/Windows.** Add CUDA/NVVM lowering and Windows runtime/toolchain integration behind the same source placement, ownership, transfer, and numeric contracts. Validate on the RTX 5090; passing Metal tests does not establish CUDA support.

The Metal proof is optional in CMake so CPU-only development does not acquire shader tool dependencies. The shader proof contains no production code generation or source syntax changes. The separate runtime uses a generic external-completion facility for transfers and the strict elementwise compute subset. The optional source compiler adds placement parsing and target-specific source checking. The ordinary CPU compiler rejects placed calls rather than discarding the target. The released compiler and website are unchanged.

## First source-to-Metal compiler slice

The optional `kalandra-metal-source` compiler accepts the shared handwritten frontend's AST and generates a checked Metal kernel from the source function body. It checks original tensor/scalar function types once through the shared semantic stage. CPU lowering and GPU lane generation consume those same typed function bodies; GPU helper calls are inlined during target lowering. Generated MLIR is parsed and verified, then passed through the existing strict integer arithmetic lowering and the pinned SPIR-V/SPIRV-Cross/Metal toolchain. GPU constants are emitted as exact integer bits and bitcasts, preserving the float32 rounding chosen by the semantic checker.

The host supervisor currently lowers to generated C++ continuations compiled by native Clang. Transfers and placed calls become child task admissions; `try await` suspends and resumes the supervisor through the existing scheduler. It never calls a nested blocking drain on a worker. This target backend is now linked into `kalandrac` and selected with `--target metal`; the smaller `kalandra-metal-source` tool remains available for IR inspection. A checked descriptor bridge connects the CPU invocation allocator and MLIR memref ABI to retained Metal Buffers. Function bodies now share the common typed IR across CPU and GPU. Supervisor placement/residency checking and C++ continuation lowering remain target-specific; arbitrary mixed CPU/GPU source programs do not yet share one placement-aware IR.

The [placed example](../../native/metal-source/placed.kalandra) computes `(left * right) + left`:

```kalandra
fn combine(left: Tensor[float32, ?], right: Tensor[float32, ?]) -> Tensor[float32, ?]:
  product = left * right
  product + left

fn main() -> Tensor[float32, 3] ! TaskError:
  try parallel:
    gpu = devices.gpu()
    left: Tensor[float32, 3] = tensor([1, 2, 3])
    right: Tensor[float32, 3] = tensor([4, 5, 6])
    leftCopy = transfer(left, gpu)
    rightCopy = transfer(right, gpu)
    deviceLeft = try await leftCopy
    deviceRight = try await rightCopy
    work = spawn combine(deviceLeft, deviceRight) on gpu
    result = try await work
    try await transfer(result, devices.cpu())
```

Build and run it from the repository root:

```sh
cmake --preset native -DKALANDRA_BUILD_METAL_PROOF=ON -DKALANDRA_BUILD_METAL_RUNTIME=ON
cmake --build --preset native
build/native/native/kalandrac native/metal-source/placed.kalandra \
  --target metal -o build/placed-gpu -O2
build/placed-gpu/program
```

The diagnostic entry prints exact float32 bits: `[40a00000,41400000,41a80000]`, representing `[5, 12, 21]`. This is executable conformance output, not a new language printing API. The output directory contains the executable and its offline-compiled `kernel*.metallib` files. Keep those files together when moving the bundle; the program does not require LLVM, MLIR, SPIRV-Cross, or the Metal compiler at execution time. The compiler itself uses paths from its configured native build.

`kalandrac` builds the selected target; for Metal, `-o` names the output bundle directory. `--target cpu` selects the ordinary CPU path, which remains the default. A CPU-only configuration reports Metal support as unavailable rather than falling back. The inspection tool emits verified GPU MLIR and host continuation source unless passed `--build`. Both entry points support separate `--sanitize` and `--thread-sanitize` build variants; they cannot be combined. Invalid source is diagnosed before generated output is changed. The executable is replaced only after a successful link; backend build failures may leave intermediate build artifacts.

### Implemented scope

- Elementwise GPU entries have one or two `Tensor[float32, ?]` parameters, up to eight float32 scalars, and the same rank-one result type. Direct rank-one `reduceSum` entries return float32 scalars, and direct rank-two `matmul` entries return matrices, as described below. Transitive helpers may take scalar float32 and/or dynamic rank-one tensor parameters and return either type, within the admitted operation subset. Every tensor input must contribute to the entry's result; scalar parameters may be unused. Operations are strict `+` and `*`, including float32 literals lifted across tensor arithmetic. No annotations or duplicate GPU implementations are needed to select placement.
- `main` has no parameters and a float32 or rank-one/rank-two float32 tensor result with `! TaskError`. Its body is one `try parallel` block. It constructs explicitly typed flat host literals, selects CPU/default/indexed GPU targets, submits transfers and placed calls, observes children with `try await`, and explicitly downloads any tensor consumed by a CPU function or returned from main. Immutable aliases and repeated calls are supported. Device indices are constant uint32 values in this slice.
- Kernel inputs/results retain dynamic array lengths in the native device ABI. The supervisor obtains its input data from literals and CPU functions. Known shapes are checked at compile time; dynamic CPU results carry checked buffer dimensions, with runtime guards on fixed-shape bindings, CPU parameters, GPU argument pairs, and main results; native kernel conformance separately exercises runtime-sized buffers. This does not claim general external tensor inputs or dynamic residency analysis in the common typed IR.
- Known shape mismatches, missing transfers/downloads, unobserved children, escaping task results, unsupported operations/types, and scalar arguments passed to tensor helper parameters are diagnosed. Scalar lifting is an arithmetic rule, not permission to erase a tensor parameter's type.
- The supervisor and its child commands use existing task/memory limits. Two uploads submitted before either is awaited need two ready admissions. Insufficient queue or device budgets fail visibly and settle their owners; no automatic admission backpressure is introduced here. A successful run requires only one CPU worker.
- `try await` propagates failures to the top-level run. Source-level recovery/matching, full placement-specific TaskError payloads, CPU functions spawning tasks, nested source parallel blocks, CPU-placed calls in this path, general tensor operations, and arbitrary mixed CPU/GPU source lowering remain unimplemented. The checked native descriptor bridge described below now interoperates with CPU invocation storage. The ordinary native compiler reports an explicit diagnostic for `on`; it never treats a placed invocation as an ordinary CPU spawn.

### Source conformance

The [second program](../../native/metal-source/composed.kalandra) computes `left + (right * right) + 0.5` through a helper and inline `try await spawn ... on devices.gpu(0)`. It produces a different GPU artifact and results from the first program. Neither dispatches the previous proof's operation-selector shader. The source kernel loader checks the separate `kalandra_elementwise` entry, binding layouts, and kernel kind.

Both actual generated supervisors run with 1/2/4 workers and retained/cached outcomes. Tests inject every logical runtime preparation failure, hold the actual compute completion during cancellation/deadline and core teardown, and check that managed resources return to zero. The source-generated kernels also run the 583,238-pair APFloat corpus plus zero/tail/beyond-4,096 sizes through the managed buffer ABI, checking unchanged inputs and exact output bits except NaN classification. Debug, optimized, ASan/UBSan, and separate TSan variants instrument host/bridge/scheduler code; they do not instrument GPU execution or prebuilt LLVM libraries.

Compiler diagnostics run in ordinary and ASan/UBSan builds. Artifact checks verify distinct source-generated kernels, constant lowering, strict integer arithmetic, guarded workgroup geometry, and reflected buffer contracts. CLI tests build and run optimized, ASan/UBSan, and TSan programs; verify repeated placed calls and a relocated bundle; preserve an existing executable after invalid source; and require a missing GPU index to fail without CPU fallback. These are correctness checks, not performance measurements.

The [source GPU evidence](../../native/metal-proof/evidence/source-gpu-2026-10-15.json) records source/artifact hashes, both calculations, 595,730 APFloat comparisons per fixture/build variant, and the complete 80-test run.

## Common compiler entry and CPU tensor ABI

`kalandrac --target metal` invokes the Metal backend as a linked compiler library. It does not launch a second source compiler process or silently infer CPU execution when Metal is unavailable. Source checking, MLIR shader lowering, and offline native linking retain the first slice's limits. This integration unifies the command entry point, not the two backends' entire typed IR or source capability set.

[Tensor.h](../../native/runtime/Tensor.h) declares ranked float32 descriptors matching the MLIR C interface: allocated/aligned pointers, element offset, sizes, and strides. Rank zero has no dimension arrays. The bridge supports ranks zero through eight with checked dense row-major layouts; noncontiguous views are rejected. GPU elementwise execution still requires rank one.

`Runtime::fromCpu(context, view)` validates shape/byte arithmetic, stride metadata, allocation membership, alignment, and the complete data range before reading payload bytes. Nonempty tensors must belong to the supplied live, successful invocation. Dense subviews may have an aligned-pointer displacement and a nonnegative element offset, provided the selected range lies within that allocation. Empty tensors do not dereference or retain data pointers. Metadata spans are a trusted native calling interface and must themselves refer to valid, stable memory during validation; this is not a public arbitrary-pointer FFI.

A successful nonempty import acquires a move-only, read-only `AllocationLease`. The runtime records each allocation's payload length and retains its backing independently of the invocation's owner list. Releasing or settling the invocation drops its owners; an imported buffer keeps the payload alive until its own last reference disappears. Copies of that Buffer share its retained storage. There is no extra host payload copy at import and no implicit GPU access to CPU pointers. Upload remains an explicit task using private device buffers and staging copies.

The native caller must preserve the language's immutable-payload contract while a lease exists. The source compiler creates the host tensor in its task invocation, imports it, and immediately releases the invocation owner; only the retained immutable backing remains. Existing mutable native pointers are not exposed to language programs. This implementation introduces no allocation-scope keyword, manual-free language feature, or user-visible lifetime parameter.

An imported view charges the complete retained CPU allocation payload to the Metal registry's byte budget, even if the view selects a small range. Separate imports can charge the same physical allocation separately; copies of one Buffer do not. This is conservative backing accounting, not physical-GPU or process-memory measurement. Allocation headers, descriptor/control metadata, and driver pools remain outside that budget.

`Runtime::toCpu<Rank>(context, hostBuffer)` checks dtype/rank and representable contiguous strides, allocates in the destination invocation, copies the completed host bytes, and returns a canonical MLIR descriptor. It rejects a device buffer before allocation: explicitly download first. Export copies so the CPU result can outlive all Metal buffers and task groups without adopting foreign allocator storage. The CPU invocation owns that result under its existing automatic cleanup rules. The bridge does not claim a copy-free round trip or reinterpret a Metal object as a CPU memref.

[Interop conformance](../../native/metal-source/InteropTests.cpp) runs CPU-owned tensors through the source-generated GPU kernel and explicit download, retires the original invocation and GPU group/buffers, then calls the [MLIR-generated CPU reduction](../../native/metal-source/cpu-consumer.kalandra) on the exported descriptor. There are 24 shape/worker cases per debug, optimized, ASan/UBSan, and TSan variant, including zero and partial workgroups. Other probes cover dense offsets, ranks zero/two/eight, signed-zero/subnormal/NaN bit preservation, forged/foreign/out-of-range descriptors, settled/faulted contexts, byte budgets, and export failure cleanup. Platform-independent allocation-lease tests separately exercise moves, retained contexts, and concurrent final owner release.

CPU-only configuration/build and compiler smoke checks still pass without Metal/shader dependencies. Full mixed-source type/effect checking, device residency in the shared typed IR, richer CPU/GPU entry parameters, and general tensor kernels remain subsequent implementation work. This bridge establishes safe interoperability; it does not establish GPU performance.

The [tensor interoperability evidence](../../native/metal-proof/evidence/tensor-interop-2026-10-15.json) records the compiler/ABI sources and executable hashes, 24 CPU→GPU→compiled-CPU cases per build variant, CPU-only build checks, and the complete 89-test run.

### Mixed CPU/GPU source programs

The [mixed source fixture](../../native/metal-source/mixed.kalandra) defines CPU and GPU functions in one file. Ordinary calls run on the CPU; `spawn ... on devices.gpu()` selects the GPU. No function annotation is needed. All ordinary function bodies use the common tensor/scalar type checker and typed IR. A function may be called on CPU and placed on GPU without a second definition. GPU capability admission still rejects unsupported operations in the reachable helper closure. The supervisor does not yet use a shared placement-aware typed IR.

```kalandra
fn total(values: Tensor[float32, ?]) -> float32:
  reduceSum(values)

fn combine(left: Tensor[float32, ?], right: Tensor[float32, ?]) -> Tensor[float32, ?]:
  product = left * right
  product + left

fn main() -> float32 ! TaskError:
  try parallel:
    left: Tensor[float32, 3] = tensor([1, 2, 3])
    right: Tensor[float32, 3] = tensor([4, 5, 6])
    gpu = devices.gpu()
    a = try await transfer(left, gpu)
    b = try await transfer(right, gpu)
    result = try await spawn combine(a, b) on gpu
    host = try await transfer(result, devices.cpu())
    total(host)
```

This returns 38. `total(result)` is rejected: awaiting GPU work leaves its result on the device. The download stays explicit. The executable currently prints scalar float32 bits in hexadecimal, as it does for tensor elements.

CPU bridge functions accept and return float32 scalars or rank-one/rank-two float32 tensors. They can call other CPU functions, including checked shape-constrained helpers. Calls run synchronously on the current worker; compiled loops poll cancellation. Each tensor argument is copied from a completed host Buffer into an invocation-owned CPU descriptor, then released after the call. This keeps ownership explicit internally; it does not claim a zero-copy CPU call path. CPU allocation/shape faults propagate through the owning task and settle the invocation. Scalar results use a separate immutable task result layout; main can still return a host tensor.

The bundle includes `cpu.mlir` and `cpu.ll`, and links the CPU object code into the same executable as the supervisor. CPU exports use checked invocation interfaces and do not synthesize a second main. Sanitizer variants instrument the generated CPU LLVM for ASan or TSan, alongside the existing host/runtime sanitizer builds; UBSan covers C++ host/runtime code, not arithmetic already lowered to LLVM. There is no compiler-library dependency in the executable.

Current limits: CPU bridge functions cannot return tasks or tensors beyond ranks one and two; GPU entry signatures and operation admission remain restricted; CPU placement/spawn in this supervisor remains unimplemented. General tensor operations and a common placement-aware typed IR are still subsequent work. Existing strict GPU arithmetic qualification is unchanged, and performance is unmeasured.

[Mixed-source conformance](../../native/metal-source/MixedTests.cpp) checks results and repeated observation with one, two, and four workers, every supervisor invocation allocation failure up to the successful run, cancellation while GPU completion retains the frame, and resource retirement. It runs in debug, optimized, ASan/UBSan, and TSan variants. CLI tests cover empty tensors, CPU shape faults after GPU download, tensor-valued main, and executable/shader relocation. Source diagnostics reject CPU access to device tensors, bad CPU arguments, shapes, duplicate names, and shadowed function calls before writing output.

The [mixed-source evidence](../../native/metal-proof/evidence/mixed-source-2026-10-15.json) records source and artifact hashes, CPU-only smoke checks, and the complete 94-test passing run.

### CPU tensor results

Ordinary CPU functions can now create, compute, forward, and return rank-one float32 tensors in mixed source programs. The [tensor-result fixture](../../native/metal-source/tensor-results.kalandra) constructs GPU inputs with a CPU function, forwards them through nested CPU helpers, uploads them explicitly, runs the GPU kernel, downloads its result, and returns a CPU helper's tensor result. A CPU function can also build a tensor from a scalar computation, such as `tensor([reduceSum(values)])`.

```kalandra
fn seed(first: float32, second: float32, third: float32) -> Tensor[float32, 3]:
  tensor([first, second, third])

fn forward(values: Tensor[float32, ?]) -> Tensor[float32, ?]:
  values
```

CPU tensor results use the existing MLIR ranked-memref C interface: the caller supplies a result descriptor, and the checked invocation owns its returned storage. The buffer-deallocation pipeline produces owned results, including a clone where forwarding an argument would otherwise borrow its backing. The supervisor acquires an immutable Buffer lease before releasing the result descriptor's invocation owner. This adds no result payload copy at import, but does not remove copies introduced by MLIR to establish ownership. CPU tensor arguments still use the copying descriptor export described above. Aliases and cached results retain the backing after the producing invocation and scheduler have ended.

A dynamic result's length is unknown to the supervisor checker unless the CPU type checker proves a constant. Transfers retain that uncertainty. Fixed-shape binding and main-result annotations add runtime guards; GPU calls check dynamic argument lengths before kernel admission. CPU interfaces check their declared parameter shapes. A mismatch raises ShapeFault, with no GPU fallback or automatic transfer. This extends shape checking in the target-specific supervisor; it does not yet add placement/residency to the common typed IR.

The [tensor-result conformance tests](../../native/metal-source/TensorResultTests.cpp) run the complete source program with one, two, and four workers in debug, optimized, ASan/UBSan, and TSan builds. They retain results past group/core retirement, compare repeated observations, sweep all eight invocation allocation failures and Metal preparation allocations, and check cancellation, deadlines, completion failure, byte budgets, and cleanup. [CLI cases](../../native/metal-source/VerifyTensorResults.cmake) cover empty tensors under ASan/UBSan, 65-element CPU factories feeding partial GPU workgroups, negative-zero/subnormal bit preservation, CPU-computed tensor results, and runtime shape faults at bindings, CPU calls, GPU calls, and main results. Diagnostics reject unsupported result ranks/types, fallible CPU tensor functions, oversized extents, and missing transfers before writing output.

Rank-two CPU tensor interfaces, CPU tasks in mixed programs, broader GPU kernels, and a shared placement-aware typed IR remain subsequent work. Performance is unmeasured.

The [CPU tensor-result evidence](../../native/metal-proof/evidence/cpu-tensor-results-2026-10-15.json) records source/artifact hashes, the allocation and lifetime checks, and the complete 99-test passing run.

### Shared CPU/GPU helpers

The [shared-helper program](../../native/metal-source/shared-helpers.kalandra) calls one `combine` definition on CPU and GPU, then passes their results to a shared `add` helper. `combine` calls both a tensor helper and a scalar helper. The compiler checks the original definitions once, preserving tensor parameter types, scalar parameter types, return types, and shape requirements. It no longer rewrites GPU function signatures into scalar functions or uses a separate AST tensor checker.

```kalandra
fn combine(left: Tensor[float32, ?], right: Tensor[float32, ?]) -> Tensor[float32, ?]:
  left * right + left
```

Within a mixed program's parallel block, `local = combine(left, right)` executes CPU code. After explicit uploads, `work = spawn combine(deviceLeft, deviceRight) on devices.gpu()` selects GPU execution. The ordinary CPU-only target can compile the same definition, including calls from CPU tasks. No annotation or alternate function implementation selects the target. Device tensors still require explicit download before CPU calls, and host tensors require explicit upload before GPU placement.

The shared typed IR now has `TensorBinary` for strict float32 elementwise `+` and `*`. A scalar operand lifts across every tensor element, on either side of the operator. Tensor operands must have identical rank and extents; there is no tensor-axis broadcasting. Known mismatches are compilation errors. Unresolved equality requirements propagate through helper calls and become runtime guards. The mixed supervisor checks CPU helper preconditions before exporting descriptors or executing the call.

CPU lowering allocates a fresh immutable result and emits ranked serial MLIR loops with separately rounded arithmetic. Allocation bounds, ownership, and loop cancellation use the existing checked invocation machinery. The task backend extracts these same operations as CPU kernels. GPU lowering emits one scalar lane from the typed tensor operation, then uses the existing integer implementation of strict binary32 arithmetic. Scalar helpers are permitted within the GPU closure when their operations are supported; a CPU-only helper may use scalar division, but placing a caller of that helper on GPU is explicitly rejected. There is no CPU fallback.

Elementwise and reduction GPU entries remain rank-one float32. The mixed bridge also supports rank-two float32 tensors for direct GPU matmul and ordinary CPU calls. Ordinary CPU elementwise lowering supports ranked tensors; tests include rank-two and empty dimensions. GPU entries accept one or two dynamic tensor inputs and up to eight float32 scalar parameters; every tensor input must contribute to the result. Elementwise GPU helpers cannot introduce tensor constructors, reductions, fixed-shape refinements, or other unsupported operations; direct scalar reduction entries are supported separately below. This milestone shares function typing and arithmetic IR, not placement/task/residency IR for the whole program. Performance is unmeasured.

[Shared-helper conformance](../../native/metal-source/TensorResultTests.cpp) compares the actual compiled CPU helper and source-generated GPU kernel against APFloat for **595,723 input pairs through each of three helpers** (addition, multiplication, and their composition with a scalar helper): **1,787,169 pair/operator cases per build variant**, including zero/tail lengths, NaNs, infinities, signed zeros, and subnormals. Each CPU and GPU result must match the reference, and the two results must match each other; NaNs are compared by classification, other values by bits. The same suite checks input immutability, runtime CPU shape faults, cached results after invocation/core retirement, all 15 supervisor invocation allocation failures, Metal preparation failures, cancellation/deadline settlement, and budgets. Debug, optimized, ASan/UBSan, and TSan variants run on the Apple GPU.

[CLI checks](../../native/metal-source/VerifyShared.cmake) compile one source helper for both targets, verify tensor types remain in CPU MLIR, execute it from a CPU task, and check ranked scalar lifting, empty tensors, CPU-only capabilities, and dynamic supervisor shape guards. Diagnostics reject unsupported GPU scalar operations, scalar-to-tensor helper arguments, scalar GPU entries, fixed-shape GPU helpers, and known CPU shape mismatches before changing output.

The [shared-helper evidence](../../native/metal-proof/evidence/shared-helpers-2026-10-15.json) records source/artifact hashes, independent addition/multiplication/composition checks, CPU-only smoke checks, and the complete 104-test passing run.

## GPU entry scalar parameters

A GPU entry can accept **one or two rank-one dynamic float32 tensors and zero to eight float32 scalars**, in any parameter order. Its result remains a rank-one dynamic float32 tensor. The same function can run on CPU:

```kalandra
fn scale(values: Tensor[float32, ?], factor: float32) -> Tensor[float32, ?]:
  values * factor
```

Use `local = scale(values, factor)` for an ordinary CPU call. After uploading `values`, use `work = spawn scale(uploaded, factor) on devices.gpu()` and `result = try await work` for GPU execution. The result stays on the device until explicitly downloaded. Scalars require no transfer: submission copies their exact float32 bits into the owned task packet. Caller storage does not remain borrowed while a command is pending.

The [source fixture](../../native/metal-source/scalar-entry.kalandra) exercises scaling, scalar-first affine transformation, interleaved tensor/scalar arguments, identity, and the eight-scalar bound. It calls the affine helper on CPU as well. Tensor inputs must have equal extents and reside on the selected GPU. Scalar-only entries, scalar GPU results other than the direct reduction subset below, more than two tensors, more than eight scalars, and unsupported operations remain diagnostic. Scalars may be unused; every tensor input must contribute to the output. This is elementwise execution, without reductions or axis broadcasting.

The private `kalandra_elementwise_v2` ABI packs tensor bindings first, followed by output and a uint32 parameter array. That array holds the element count followed by scalar bit patterns, in scalar declaration order. Runtime reflection checks binding count, element types, offsets, lengths, sizes and alignment against the compiler-supplied signature. Parameter storage costs `4 * (1 + scalarCount)` bytes against the existing byte budget and remains retained through command acknowledgement. Two-tensor entries without scalars keep their existing ABI. Neither loader is a numerical validator for untrusted shaders.

[Conformance checks](../../native/metal-source/ScalarEntryChecks.h) check five CPU/GPU helpers in **676,900 cases per build variant**, using APFloat for arithmetic and exact bits for identity, including empty/tail workgroups, subnormals, signed zeros, infinities and NaNs. Identity additionally preserves exact input bits, including NaN payloads. Tests change caller capture arrays immediately after submission, reject incompatible signatures/counts/residency before dispatch, and run supervisor allocation failures, cancellation, deadlines, completion failure and cleanup in debug, optimized, ASan/UBSan and TSan builds. [CLI checks](../../native/metal-source/VerifyScalarEntry.cmake) cover CPU execution, unused scalars, placement and diagnostics without modifying existing output on rejection. [Evidence](../../native/metal-proof/evidence/gpu-entry-signatures-2026-10-15.json) records the run and artifact hashes.

Strict arithmetic implementation and its qualification are unchanged. GPU performance is unmeasured. Placement/task/residency lowering still uses the target-specific supervisor.

## Tracked follow-up: general GPU parameter layouts (GPU-ABI-001)

Status: open. The current two-tensor/eight-scalar cap is a temporary compiler/runtime implementation restriction on GPU-placed user functions, not a language rule. It comes from fixed tensor slots and a fixed scalar capture array. Ordinary CPU functions do not inherit this GPU cap. Remove the arbitrary counts as the GPU interface becomes general.

Completion requires:

- Derive the argument layout from the checked function signature, preserving source evaluation order and allowing any ordering of supported parameter types.
- Replace fixed tensor slots and scalar arrays with bounded, owned argument storage sized for that signature. Retain tensor owners and copy scalar values at submission; preserve cancellation, allocation-failure cleanup and resource accounting.
- Generate and validate matching artifact metadata, shader bindings and scalar layouts. Handle target resource limits where practical; diagnose actual unsupported types, device capabilities or resource limits instead of imposing a universal language parameter count.
- Derive shape requirements from the function's operations. Equal lengths and the requirement that every tensor contribute to the result belong to the current elementwise implementation, not to general function signatures.
- Exercise more than two tensors and more than eight scalars, mixed ordering, unused arguments, invalid layouts, allocation failures and cancellation in the numerical and sanitizer suites.

This does not imply that every language type can immediately execute on every GPU. Type and operation support must expand explicitly, with capability checks and numerical evidence.

Rank-one GPU `reduceSum` now has a first implementation, described below. GPU-ABI-001 remains a separate open requirement; reduction support does not turn the current argument counts into language semantics.

## Rank-one GPU reductions

A user-defined function can now run `reduceSum` on a rank-one float32 device tensor and return a scalar:

```kalandra
fn total(values: Tensor[float32, ?]) -> float32:
  reduceSum(values)
```

After explicit upload or another GPU computation, `result = try await spawn total(uploaded) on devices.gpu()` returns an ordinary float32 value. Small scalar results are copied at completion, so `result` can go directly to a CPU function or become a scalar parameter in another GPU call. This does not download the tensor. Tensor-valued GPU results still require explicit transfer for CPU use.

The [source fixture](../../native/metal-source/reduction.kalandra) calls `total` on CPU, scales a tensor on GPU, reduces the device result, and passes the scalar to a CPU function. It prints `41f80000` (31) through the diagnostic executable's existing bit-output interface.

The first admitted reduction entry has one dynamic rank-one float32 tensor parameter and a body consisting directly of `reduceSum(parameter)`. Admission recognizes the shared checked `ReduceSum` operation and its balanced-adjacent, row-major policy. Additional arithmetic before/after the reduction, aliases around the reduction, nested reduction helpers, extra parameters, other ranks/formats, and general scalar GPU functions remain unsupported in this slice. These are implementation restrictions. To compose supported stages today, use separate placed calls; their tensor intermediates stay on GPU. CPU execution retains its existing broader operation support. There is no CPU fallback for unsupported GPU bodies.

The GPU shader performs one tree level: adjacent pairs add with strict binary32 rounding, and an odd final element is copied unchanged. The runtime encodes successive levels in order, using separate compute encoders and fresh private buffers, until one value remains. This matches the CPU/reference tree independently of thread scheduling. Empty input returns positive zero without a command; singleton input copies its exact bits without adding zero. Every nonempty reduction uses one command buffer and finishes with a four-byte staging copy. It neither uses a host arithmetic reduction nor reassociates the tree into scheduling-dependent partial sums.

The private `kalandra_reduce_sum` entry has input/output runtime float32 array bindings and one uint32 element-count word. Reflection validates its layout, and kernel-kind checks prevent elementwise/reduction entry substitution. The existing uint32 indexing bound allows at most 32 levels. Scratch buffers, count words and scalar readback are charged to the shared byte budget and retained through completion acknowledgement, along with the input and pipeline. Intermediate storage is linear in input length in this baseline. Allocation/encoder failures unwind before commit. Once committed, cancellation/deadlines prevent publication and wait for acknowledgement; the runtime does not promise interruption between encoded levels or hardware preemption.

[Reduction conformance](../../native/metal-source/ReductionTests.cpp) compares compiled CPU results, actual GPU results and an APFloat implementation of the accepted tree in **570 cases containing 3,264,973 input elements per build variant**, with zero mismatches. Coverage includes empty and singleton values, odd levels, workgroup/power-of-two tails through 131,073 elements, signed zeros, subnormals, cancellation-sensitive finite sums, infinities, NaNs and deterministic random inputs. Arithmetic NaNs compare by classification; singleton copies preserve payload bits. Tests also check unchanged inputs, repeated observation, invocation and Metal allocation failures, command/byte budgets, missing or incompatible kernels, invalid ranks/formats/residency, dropped owners/facades, pending core destruction, cancellation/deadlines and simulated failed completion. Debug, optimized, ASan/UBSan and TSan variants run on the Apple GPU.

[CLI checks](../../native/metal-source/VerifyReduction.cmake) cover scalar CPU/GPU composition, repeated awaits, empty input, negative zero, bundle relocation, strict artifact inspection and rejection before changing existing output. The [reduction evidence](../../native/metal-proof/evidence/gpu-reductions-2026-10-15.json) records the numerical and lifecycle run and artifact hashes. The [initial performance baseline](../../benchmarks/results/native-gpu-2026-10-15.md) now measures reductions with and without resident inputs. Direct GPU matmul is implemented below; tensor-kernel optimization and general placement/task/residency IR remain subsequent work.

## Rank-two GPU matrix multiplication

A direct matrix helper can now run on CPU or GPU from the same checked function definition:

```kalandra
fn project(input: Tensor[float32, ?, ?], weights: Tensor[float32, ?, ?]) -> Tensor[float32, ?, ?]:
  matmul(input, weights)
```

With `input` shaped `[M, K]` and `weights` shaped `[K, N]`, ordinary `project(input, weights)` executes on CPU. Upload the two inputs explicitly, then use `work = spawn project(a, b) on devices.gpu()` and `result = try await work` to get a device tensor of shape `[M, N]`. Await does not download it. The [source fixture](../../native/metal-source/matmul.kalandra) downloads the result before passing it to a CPU reduction; it produces `43230000` (163). A downloaded matrix can also be returned from main, whose diagnostic output prints its elements in flat row-major order.

The mixed-source supervisor now tracks both matrix axes through literals, CPU calls/results, transfers, placed calls, awaits, annotations and main results. Nested rectangular literals construct matrices; an empty outer literal uses its annotated column extent. The CPU bridge exports/imports rank-two descriptors and propagates axis-specific shape requirements. Known mismatches are compilation errors; unknown inner dimensions and fixed-width annotations have runtime guards before calls or host descriptor access. GPU runtime admission independently checks format, rank, inner dimensions, selected-device residency, byte bounds, and uint32 dimension/input/output index capacity. Inputs may alias; each result has fresh immutable storage.

This first matrix GPU entry has exactly two dynamic rank-two float32 tensor parameters and a direct `matmul(firstParameter, secondParameter)` body. Admission checks the shared typed `Matmul` operation, separately rounded products and balanced-adjacent reduction policy. Helpers, aliases or arithmetic around matmul inside the same GPU function are not implemented. Supported matrix calls can be composed as separate placed tasks while their intermediates stay on device. This source restriction is not a language rule, and GPU-ABI-001 remains open. Elementwise GPU calls and GPU reduceSum still accept only rank-one tensors; CPU helpers can reduce or otherwise process downloaded matrices through the existing CPU subset.

The [generated kernel](../../native/metal-source/MatmulShader.h) assigns one output cell to a lane in a guarded 64-thread workgroup. It rounds every product to float32 before addition. A private stack stores aligned power-of-two subtree roots as products arrive; occupied roots combine from low to high level, placing each larger subtree on the left. This reproduces the accepted adjacent-pair tree even for odd contraction lengths, without adding an initial zero to a nonempty sum. The stack holds 32 float32 roots per lane under the current uint32 indexing bound, rather than allocating `M*N*K` global products. Strict scalar multiplication/addition use the existing integer GPU lowering; vendor matmul, hardware float32 reassociation and fusion are not substituted.

Zero rows or columns yield an empty device tensor without dispatch. Zero contraction length with nonempty output dispatches positive zeros without reading the empty input buffers. The private `kalandra_matmul` entry has two flat input buffers, output, and a reflected uint32 parameter array `[M, K, N]`. The runtime retains the input owners, output, pipeline and 12-byte parameter buffer through asynchronous command acknowledgement. Parameter/output storage shares the existing byte budget. Cancellation and deadlines prevent publication and wait for safe cleanup; a running shader is not preempted, and the per-cell contraction loop has no mid-kernel cancellation check.

[Matrix conformance](../../native/metal-source/MatmulTests.cpp) checks **676 shapes/pattern cases, 19,166 output cells and 3,621,350 separately rounded products per build variant** against both the compiled CPU helper and an APFloat product/tree reference. It covers contraction lengths through 1,025, odd/power-of-two and workgroup tails, empty dimensions, negative zero, subnormals, finite cancellation, overflow, infinities, NaNs and a fusion-sensitive case. Other checks cover immutable/aliased inputs, retained/cached results, allocation and encoder failures, command/byte budgets, invalid ranks/formats/residency, uint32 overflow guards using empty buffers, cancellation/deadlines, simulated completion failure, dropped owners and pending core destruction. Host/runtime debug, optimized, ASan/UBSan and TSan variants execute on the Apple GPU; these sanitizers do not instrument device instructions.

[CLI checks](../../native/metal-source/VerifyMatmul.cmake) run rank-two CPU factories and consumers, matrix main results, chained GPU calls, zero axes, source diagnostics and dynamic inner/width guards. [Evidence](../../native/metal-proof/evidence/gpu-matmul-2026-10-15.json) records the run and hashes. This establishes a strict baseline. The [initial CPU/Metal measurements](../../benchmarks/results/native-gpu-2026-10-15.md) now show higher GPU matmul latency than the optimized CPU call on the tested shapes, including the preallocated device-command control. Tiling, tensor acceleration, numerical-policy alternatives and broader source/parameter layouts require separate implementation and evidence.

## Initial CPU / Metal performance baseline

The [benchmark report](../../benchmarks/results/native-gpu-2026-10-15.md) records three processes with excluded warmups, seven samples per cell and independent validation of every result. It distinguishes checked CPU calls, preallocated GPU command intervals, resident managed tasks and calls including explicit transfers. The harness rebuilds optimized runtime code, without sanitizers or Metal validation. There is no language JIT or first-dispatch timing in the measured samples.

On the tested M2 Max, 256-square matmul takes 2.05 ms on CPU, 8.03 ms as a resident GPU task and 8.52 ms including transfers. The million-element reduction takes 1.54 ms on CPU, 0.72 ms resident and 1.38 ms including upload, with overlapping individual CPU/transfer samples. This supports prioritizing GPU matmul device execution and studying reduction reuse/batching; it does not establish a general placement threshold or identify a specific instruction-level bottleneck. Source supervisor continuations and application-level concurrency remain unmeasured. Parameter-layout work GPU-ABI-001 remains open.
