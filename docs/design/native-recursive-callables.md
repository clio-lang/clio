# Recursive synchronous calls and function values

Implemented native CPU subset — 2026-10-19. Named synchronous functions and their function values can call themselves or each other, including when their bodies handle expected errors or match variants. Recursive definitions need explicit return types.

```kalandra
error MathError:
  Negative

fn factorial(n: int) -> int ! MathError:
  if n < 0: fail MathError.Negative
  if n <= 1:
    1
  else:
    previous = try factorial(n - 1)
    n * previous

fn main() -> int:
  callback = factorial
  callback(5) catch fn(error): 0
```

The [factorial example](../../native/tests/fixtures/recursive-callables/factorial.k) returns `120`. The [error-propagation fixture](fixtures/recursive-callables.k) returns `42` after recovering a typed payload from a recursive call.

## Supported behavior

Direct self/mutual calls and calls through aliases use the existing declared signatures. Captured anonymous functions can call named recursive helpers; named functions can recursively return arrays or captured closures. Expected-error payloads retain their Strings and collections while unwinding, and existing union widening/recovery rules still apply. Expected application errors remain separate from checked execution faults.

Recursive callbacks can run in sequential maps or be created and invoked inside a CPU worker. Named CPU workers can also call recursive synchronous helpers. Existing worker ownership, cached-await behavior and function-transport restrictions are unchanged.

This does not introduce recursive local bindings: `callback = fn(...): callback(...)` cannot read its own binding during initialization. Use a named definition for recursion. Missing return annotations still produce `S006`. Synchronous function values still reject targets that coordinate tasks or devices. Existing task scheduling behavior is not changed by this increment; ordinary synchronous recursion through a coordinating helper is not added.

## Checked call admission

Every generated checked CPU entry and synchronous callable entry acquires an invocation-local call slot and releases it on success, expected-error return, execution fault or cancellation. A rejected entry acquires no slot. Counts describe active checked entries, including internal wrappers, rather than source-level calls.

The current limit is 128 active checked entries. On Apple systems, admission also checks the executing pthread's stack bounds and leaves 128 KiB of headroom. Stack bounds are queried on the executing thread because an invocation may migrate between workers. No thread-local or process-global current invocation is introduced.

Exhaustion produces execution fault code `6`, reported as `CallLimitFault` at a CLI boundary. A worker exposes it through the existing `TaskError.Fault` with `FaultKind.Native`; it is not an application error and cannot be caught as `MathError`. A later ordinary call in the same healthy invocation starts with its call slots available again. Faulted invocations remain faulted. Source coordinates are retained when the rejecting entry has them; low-level checked adapters currently report `0:0`.

The CPU backend also rejects synchronous source functions and callable entries exceeding a conservative 16 KiB native-stack estimate. Scheduler resume bodies are not native-recursive entries and do not receive this additional limit. Compiler-owned SIMD matmul leaves retain their separately qualified numeric implementation: their argument/fixed-allocation storage is bounded, and validation forbids indirect or source-function calls from those leaves rather than treating every vector SSA temporary as simultaneously live. The estimate counts SSA value storage, incoming/outgoing arguments and fixed allocas without assuming register allocation or stack-slot reuse; dynamic/scalable stack allocations are rejected. This estimate is a compiler admission limit, not an exact machine-frame size. It keeps margin below runtime headroom and can reject large inline aggregates or long generated functions even when an optimizer could reduce their stack use. Use smaller helpers or collection backing rather than relying on a large inline temporary.

These are bounded native calls, not unlimited recursion or guaranteed tail-call elimination. [Optimization work](../roadmap.md#optimization) tracks explicit heap-stack/trampoline execution, proven tail calls and less conservative stack admission.

## Lowering and ownership

The continuation planner emits a synchronous-call backedge when inlining would revisit an active synchronous function. All callable declarations are created before bodies are emitted, so self and mutual references can resolve directly. No recursive body expansion or scheduler task is needed for that backedge.

Synchronous continuation frames remain checked invocation allocations. Recursive expected-error result staging lives in those heap frames. Returning or faulting releases the temporary frame; captured environments and result backing follow their existing managed ownership rules. Ordinary MLIR functions use the same call-admission runtime through the checked ABI. The private test-export path can expose an existing capture-free synchronous entry with typed parameters; this is not a public C/C++ ABI.

## Qualification

The [CPU qualification record](../../native/metal-proof/evidence/cpu-recursive-callables-2026-10-19.json) records 110 selected CTest suites passing on Apple M2 Max with LLVM/MLIR 22.1.8. This is a focused regression selection, not the full project suite.

The new execution suites compile and run 35 programs in each of debug, optimized, ASan/UBSan and separate ThreadSanitizer modes (140 compiled programs). They cover all ten numeric scalar result types, Bool/String/record/array/tensor results, returned captured functions, self/mutual references, canonical error unions, recursive matrix operations and local CPU workers. Frontend suites check and plan 22 fixtures in normal and sanitizer builds, including static backedge checks and four unsupported boundaries.

Runtime harnesses cover 120 allocation-failure probes, 1,024 repeated recursive calls, balanced admission and unwind, arithmetic faults and already faulted/cancelled contexts. Additional worker runs use pools of one, two and four threads. Deep recursion exits with `CallLimitFault` and a settled allocation ledger; oversized-stack compilation rejects the source without replacing existing output artifacts. Relevant existing syntax, control flow, collection, closure, aggregate, expected-error, worker and matrix suites also pass.
