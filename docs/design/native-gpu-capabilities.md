# Native Apple GPU capability matrix

This describes the current `--target metal` source backend, rather than every
operation the runtime or CPU compiler can represent. **GPU** means computation
inside a dispatched kernel; **Host** means the generated CPU coordinator in a
mixed CPU/Metal program. Host support does not imply equivalent shader support.
Native CPU numeric widths, Strings, records, enums and managed closures are not
automatically device capabilities. Transfers remain explicit; an unsupported
GPU program is rejected rather than silently run on the CPU.

## Tested boundaries

<!-- capability-matrix:start -->

| Feature | Runs in | Status / boundary | Checks |
| --- | --- | --- | --- |
| Vector elementwise expressions | GPU | **Supported.** float32; strict +, -, * and composed helpers | [source](../../native/metal-source/composed.k) (+1 additional probes), [device evidence](../../native/metal-proof/evidence/source-gpu-2026-10-15.json) |
| Matrix elementwise expressions | GPU | **Supported.** Rank two; equal complete shapes | [source](../../native/metal-source/matrix-elementwise.k), [device evidence](../../native/metal-proof/evidence/gpu-matrix-elementwise-2026-10-16.json) |
| Tensor division and scalar lifting | GPU | **Supported.** IEEE division, including either scalar operand order | [source](../../native/metal-source/division.k), [device evidence](../../native/metal-proof/evidence/gpu-division-2026-10-16.json) |
| Tensor unary signs | GPU | **Supported.** float32 vectors and matrices | [source](../../native/metal-source/tensor-negation.k), [device evidence](../../native/metal-proof/evidence/gpu-tensor-negation-2026-10-16.json) |
| Mixed scalar and tensor parameters | GPU | **Supported.** float32 scalars alongside tensor inputs; scalar-only kernels remain unsupported | [source](../../native/metal-source/scalar-entry.k), [device evidence](../../native/metal-proof/evidence/gpu-entry-signatures-2026-10-15.json) |
| High-arity CPU/GPU bridge exports | GPU | **Supported.** 29/40-tensor examples use direct/indirect GPU buffers and bounded checked CPU helpers; compiler/device resource limits still apply | [source](../../native/metal-source/indirect-arguments.k) (+1 additional probes), [device evidence](../../native/metal-proof/evidence/gpu-indirect-arguments-2026-10-16.json) |
| Balanced reduceSum | GPU | **Supported.** Rank one/two inputs; one reduction per entry, including forwarding helpers | [source](../../native/metal-source/matrix-reduction.k), [device evidence](../../native/metal-proof/evidence/gpu-forwarding-2026-10-20.json) |
| Matrix multiplication | GPU | **Supported.** Rank two; one matmul per entry, including forwarding helpers | [source](../../native/metal-source/matmul.k), [device evidence](../../native/metal-proof/evidence/gpu-forwarding-2026-10-20.json) |
| Composed numerical dispatches | Host | **Supported.** Separate GPU calls for matmul, elementwise adjustment and reduction; intermediates remain resident | [source](../../native/metal-source/matrix-pipeline.k), [device evidence](../../native/metal-proof/evidence/gpu-forwarding-2026-10-20.json) |
| Primitive forwarding and re-exports | GPU | **Supported.** Aliases and transitive helpers retain shape obligations and one-primitive entry rules | [source](../../native/metal-source/forwarding/main.k), [device evidence](../../native/metal-proof/evidence/gpu-forwarding-2026-10-20.json) |
| Relative modules and re-exports | Host | **Supported.** Numerical helpers and coordinators retain declaring-file scope | [source](../../native/metal-source/modules/main.k), [device evidence](../../native/metal-proof/evidence/gpu-local-modules-2026-10-20.json) |
| CPU workers inside a Metal program | Host | **Supported.** Qualified mixed-target float32 scalar/tensor subset; explicit transfers | [source](../../native/metal-source/cpu-spawn.k), [device evidence](../../native/metal-proof/evidence/cpu-spawn-2026-10-16.json) |
| Nested parallel groups | Host | **Supported.** Shared scheduler, explicit residence and scope settlement | [source](../../native/metal-source/nested-parallel.k), [device evidence](../../native/metal-proof/evidence/nested-parallel-2026-10-16.json) |
| TaskError recovery | Host | **Supported.** Host catch/match and group settlement; no shader exception handling | [source](../../native/metal-source/recovery.k), [device evidence](../../native/metal-proof/evidence/recovery-2026-10-16.json) |
| Coordinating helper functions | Host | **Supported.** Statically known helper continuations; no general GPU closure dispatch | [source](../../native/metal-source/resumable-helpers.k), [device evidence](../../native/metal-proof/evidence/resumable-helpers-2026-10-16.json) |
| Other CPU numeric widths on GPU | GPU | **Not admitted.** All nine CPU numeric types other than float32 are rejected; no implicit conversion or CPU fallback | [source](../../native/metal-source/capabilities/numeric-int8.k) (+8 additional probes) |
| Rank-three device tensors | GPU | **Not admitted.** Current source bridge admits ranks one and two | [source](../../native/metal-source/capabilities/rank-three.k) |
| Scalar-only GPU functions | GPU | **Not admitted.** Scalar parameters are supported alongside tensors; arbitrary scalar GPU entries are not | [source](../../native/metal-source/capabilities/scalar-only.k) |
| Elementwise expressions before a reduction | GPU | **Supported.** One float32 elementwise stage and one balanced reduction under one task; resident intermediate; rank one/two and mixed parameters | [source](../../native/metal-source/capabilities/reduce-expression.k) (+1 additional probes), [device evidence](../../native/metal-proof/evidence/gpu-pre-reduction-2026-10-21.json) |
| Arithmetic after a reduction inside one entry | GPU | **Not admitted.** A scalar GPU result currently requires a single forwarded reduceSum | [source](../../native/metal-source/capabilities/post-reduction.k) |
| Data-dependent kernel branches | GPU | **Not admitted.** Host control flow is distinct from data-dependent shader control flow | [source](../../native/metal-source/capabilities/branch.k) |
| Arithmetic fused into a matmul entry | GPU | **Not admitted.** Use separate matmul and elementwise dispatches; general one-entry composition is pending | [source](../../native/metal-source/capabilities/post-matmul.k) |

<!-- capability-matrix:end -->

## How this table is checked

The machine-readable contract is
[`capabilities.json`](../../native/metal-source/capabilities.json). Its source
probes must first pass the shared placement checker. Supported probes must then
emit host, continuation, placement and kernel artifacts with a consistent kernel
manifest. Unsupported probes must produce a GPU admission diagnostic, preserve
existing output bytes, and leave a fresh output path absent.

The table is generated from that contract. A stale table fails the test. To
regenerate it after deliberately changing a capability and its probes:

```sh
python3 native/metal-source/CapabilityTests.py --write-docs
```

These matrix checks stop at source emission: they do not execute shaders or
establish numerical correctness, performance or runtime lifetime safety. The
separately linked device evidence records the corresponding hardware and failure
qualification. Some older evidence uses the former source extension or LLVM
version; those records are historical, while the source-admission probes run
against the current compiler. [Installed numerical library acceptance](native-metal-install.md#installed-numerical-libraries)
adds current LLVM 23 Debug/Release bundle execution on the M2 Max, including
CPU/GPU private dependency versions and all four generated host modes.

The [initial matrix audit](../../native/metal-proof/evidence/gpu-capability-matrix-2026-10-20.json)
records the pre-repair 32-probe audit, including the two high-arity positive
gates that failed at that point. The repair record below covers current acceptance.

## GPU-HOST-001: repaired high-arity source admission

The older `arguments.k` and `indirect-arguments.k` full-program examples had begun
rejecting with `G001: function exceeds the conservative native stack budget`.
Their signatures and placement remained valid, but their CPU bridge contained
redundant tensor descriptor SSA and long inlined elementwise bodies.

[Bounded tensor helpers and checked IR simplification](native-stack-admission.md)
restore those examples without raising the 16 KiB frame budget or exempting
source functions from admission. The matrix now requires positive source emission
for both, and their positive GPU CLI gates remain required. The older audit record
above describes the failure before this repair; the
[repair qualification](../../native/metal-proof/evidence/gpu-host-stack-repair-2026-10-20.json)
records current acceptance and retained safety checks.

## Remaining N2 work

[Elementwise expressions before one reduction](native-gpu-pre-reduction.md),
such as `reduceSum(values + 1)`, now lower to two resident GPU stages under one
task. Remaining composition gaps include arithmetic after a scalar reduction,
multiple numerical primitives and `matmul(input, weights) + bias` inside one
helper. Separate placed calls already express those computations. Extending the
internal graph must preserve strict reduction and rounding contracts; it does not require putting host closures or TaskError
handlers into shaders. Scalar-only kernels, broader numeric types, higher tensor
ranks and device control flow remain distinct unimplemented boundaries.

Custom user kernels/shaders, lower-level device interfaces and NVIDIA/CUDA remain
later work in their respective plans. This matrix does not add release
requirements beyond the accepted numerical GPU scope.
