# Apple GPU backend contract

Status: executable shader toolchain evidence plus an optional managed device/transfer runtime. Apple Silicon/Metal is the first GPU target; NVIDIA/CUDA on Windows follows. The released JavaScript prototype and existing native CPU implementation do not gain GPU source support from this document.

This implements the direction in [placement and transfers](placement.md), [tensor semantics](tensors.md), and [numeric semantics](numbers.md). Those language contracts remain authoritative. The [Metal toolchain proof](../../native/metal-proof/README.md) now executes generated shaders on an Apple M2 Max; its direct hardware path exposes a strict float32 compatibility gap. A separate [integer lowering](strict-gpu-float32.md) now passes scalar add/multiply conformance on that device.

## Compiler boundary

Keep the typed scalar/tensor IR and target admission shared. CPU, Metal, and future CUDA backends consume the same logical operations and source numeric policy. Device launch layout, buffer binding, and synchronization are backend details; source does not acquire Metal buffer indices or NVIDIA block syntax.

For Metal, use explicit GPU kernel IR, conversion to SPIR-V, SPIRV-Cross to Metal Shading Language, and offline compilation to a Metal library. The proof establishes this route starting at handwritten GPU IR. The compiler still needs tensor-to-GPU scheduling, checked shape/index lowering, metadata generation, and source placement support. Do not serialize CPU memref descriptors into shader parameters or expose arbitrary host pointers to a shader.

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

The subsequent [strict binary32 lowering](strict-gpu-float32.md) now implements scalar add/multiply through integer MLIR operations, including gradual underflow, signed zero, nonfinite cases, and nearest/ties-to-even rounding. CPU LLVM and Metal differential tests pass against LLVM APFloat and CPU hardware. It requires the strict artifact's Int64/MSL 2.2 profile. This numerical component is not yet wired to source placement or compute tasks, and it does not admit unsupported arithmetic or tensor kernels.

The integer implementation preserves the existing contract for its tested subset; no alternative numerical policy is selected. Further operations require corresponding lowering and evidence. Hardware/software correction costs still need measurement before claiming a fast strict backend. Merely offering a fused operation, accepting flush-to-zero as a default, or substituting a vendor matmul would change semantics and is not authorized by this proof.

## Implementation sequence and acceptance

1. **Toolchain proof — complete.** Actual MLIR GPU → SPIR-V → Metal compilation and execution, reflected binding checks, explicit copies, partial workgroups, unchanged inputs, host sanitizer coverage, and recorded strict-arithmetic failures. No speed claim.
2. **Device/storage runtime — implemented as a private native bridge.** Stable device selection, opaque retained buffers, checked sizes, explicit upload/download tasks, zero-sized tensors, scheduler completion capabilities, and transactional failure cleanup now have native tests, including nested groups, cancellation/deadline acknowledgement, dropped owners, budgets, and failure injection. ASan/UBSan and separate TSan cover host/bridge/scheduler code. Source-level transfers and the general tensor ABI remain a later gate.
3. **Numeric compatibility — scalar add/multiply implemented.** Integer lowering now passes IEEE edge, exponent/sign strata, cancellation, and random-value checks on CPU LLVM and Metal, including separately rounded multiplication then addition. Independent APFloat/CPU references and artifact inspection gate this subset. Other operations/types remain unsupported, and performance is unmeasured.
4. **First source vertical slice.** Compile a placed elementwise function from `.kalandra`, transfer inputs, spawn, await, download, and compare the actual source-generated result. Validate aliases, repeated calls, failure injection, cancellation/deadlines, and group cleanup. A handwritten shader is not this milestone.
5. **Tensor kernels and measurement.** Add matmul/reductions with the accepted tree and rounding, then measure kernel-only and end-to-end transfer/dispatch/completion costs separately, including retained device inputs. Do not extrapolate GPU speed from CPU results.
6. **NVIDIA/Windows.** Add CUDA/NVVM lowering and Windows runtime/toolchain integration behind the same source placement, ownership, transfer, and numeric contracts. Validate on the RTX 5090; passing Metal tests does not establish CUDA support.

The Metal proof is optional in CMake so CPU-only development does not acquire shader tool dependencies. The shader proof contains no production code generation or source syntax changes. The separate transfer runtime adds a generic external-completion facility to the task scheduler; neither enables GPU arithmetic or changes the published website.
