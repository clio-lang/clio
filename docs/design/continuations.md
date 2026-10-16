# Common CPU/GPU continuation planning

CPU task lowering and the mixed Apple GPU supervisor now use one planner over checked typed IR. The planner decides value slots, lexical groups, branch edges, recovery exits and suspension points. The LLVM CPU emitter and C++ Metal supervisor emitter implement those instructions through their respective value layouts and runtime interfaces.

## Representation and policies

[Continuation.h](../../native/include/kalandra/Continuation.h) defines a module plan containing typed frame slots, parameters, group indices and instruction lists. Calls and operations retain checked function/value identities rather than source names. The input `TypedModule` must remain alive and unchanged through planning and emission; the plan keeps a reference to it for numerical operation metadata and diagnostics. Planning does not query hardware or execute source code, and failure returns no partial plan.

The shared instruction set covers literals and arithmetic, numerical kernels, synchronous calls, selectors, transfers, owned child admissions, await, group open/join, copy, try/fail, catch, cases, branches, field reads and return. Tensor slots retain rank, extents and residency; task and expected-error status remain separate type facts.

Two call policies preserve the current backend interfaces:

- Ordinary CPU task compilation expands synchronous helper bodies into the caller's plan and extracts numeric operations into checked CPU kernels. Named CPU child entries and synthetic builtin entries retain their own plans. Existing recursion, expansion and frame-value limits still apply.
- Mixed-program compilation preserves ordinary synchronous calls as checked target dispatches and plans its selected `main`. CPU calls use the existing checked export ABI; GPU calls and transfers use the Metal task runtime. A placed spawn contains evaluated argument slots plus a checked selector slot. Constant tensor data stays embedded instead of consuming one frame slot per literal element; nonconstant operands retain their evaluation order. Logical function IDs map explicitly to CPU export IDs. Other function IDs retain their positions rather than being renumbered around the selected entry.

These are call-lowering policies within the same control-flow planner. They do not introduce asynchronous mixed helper bodies, new value types, a different scheduler, remote execution or new GPU capabilities.

## Settlement and control flow

A parallel operation opens a lexical child group. Its join instruction closes the group, suspends until all children and external completions settle, then publishes its value or error. Every `try` or `fail` edge targeting that boundary goes through the same join. A function or handler boundary instead stores the expected error and branches to its common exit.

Catch copies a successful value directly to the continuation after the handler, or binds the failure and enters the handler. Match arms receive independent value/symbol environments; their results join in one output slot. Pattern fields consume the already evaluated subject. Shared graph values are reused only where their defining environment is available. Exhaustive matches still fault on an invalid internal tag.

Arguments are planned before an explicit task selector and admission. Reading an existing immutable selector requires no new runtime work. Transfers retain their owning group, checked target and tensor shape. The runtime still performs device availability, capability, budget and binding checks.

The Metal emitter maps logical plan positions to target program counters. A group join uses a close step followed by a resumable wait step; resuming the wait does not close the group again. If admission observes an already failed containing group, it branches to that group's join and preserves the original failure. It does not convert the failed admission handle into a different fault.

CPU and Metal value storage remain backend-specific. CPU expected results use the existing checked layout; the Metal frame uses scalar/Buffer/Failure fields and immutable backing leases. The target emitter can retain shape facts proven by its kernels even when the public result type is dynamic. Straight-line writes preserve these facts, while branch writes keep an extent only when every successful payload path agrees; explicit checked extents remain constraints. Scalar float32 negation in the supervisor flips the sign bit directly. No floating-point reassociation, automatic tensor transfer or mutable payload sharing is added.

## Inspection and qualification

```sh
# CPU task plans, including helper expansion and synthetic builtin entries.
build/native/native/kalandra-check --dump-plan native/tests/fixtures/task-recovery.kalandra

# Placement-aware entry plan; no GPU is needed to inspect it.
build/native/native/kalandra-check --placement --dump-plan native/metal-source/recovery.kalandra
```

`--dump-plan` and `--dump-ir` are mutually exclusive. Placement plan inspection selects `main`. The Metal compiler writes the exact same `continuation.plan` alongside its typed IR, generated supervisor and kernel artifacts. It is an inspection format, not a stable serialized program or supported compiler input. Symlink and source/output collision preflight cover this artifact too.

[Planner tests](../../native/tests/ContinuationTests.cpp) check 20 mixed and two CPU fixtures normally and under ASan/UBSan. They verify group/failure/branch edges, typed targets and transfers, argument order for fresh selectors, deterministic output, CPU placement rejection, entry validation, recursion limits, synthetic builtin child plans and a 21,000-element embedded literal that must not exhaust continuation slots. [Artifact checks](../../native/metal-source/VerifyPlacement.cmake) compare 70 target plans with independent standalone planning. Existing compiled CPU/Metal tests exercise the common plan with worker variation, shape faults, recovery, cancellation/deadlines, admission races, allocation/completion failures and cleanup. Debug, optimized, ASan/UBSan and separate TSan variants remain required.

The private generated GPU-await/group observation points let the lifecycle harness cancel a containing scope at a GPU wait without depending on a frame-field number or source program counter. They are not a public runtime ABI. [Evidence](../../native/metal-proof/evidence/common-continuations-2026-10-16.json) records the regression and artifact comparisons.

Next, support resumable helper bodies in mixed programs using this shared representation. Broader language values, element types and devices remain separate work. Native distributed execution still requires its agreed design review.
