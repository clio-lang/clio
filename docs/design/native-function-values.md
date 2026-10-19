# Named CPU function values

Implemented native subset — 2026-10-19. Named synchronous CPU functions can now be assigned to bindings, passed as parameters, selected at runtime and returned as values. This implements the first executable part of the accepted [function-value design](function-values.md); returning an anonymous closure with captured data remains separate work.

## Assign, pass, return and call

```kalandra
fn double(value: int) -> int:
  value * 2

fn triple(value: int) -> int:
  value * 3

fn apply(value: int, transform: fn(int) -> int) -> int:
  transform(value)

fn choose(flag: Bool) -> fn(int) -> int:
  if flag: double
  else: triple

export fn main() -> int:
  transform = choose(false)
  alias: fn(int) -> int = transform
  items = map([1, 2, 3], alias)
  apply(4, choose(true)) + items[2]
```

The result is `17`: `choose(false)` returns `triple`, the mapped array is `[3, 6, 9]`, and the last call adds `double(4)`. The [complete fixture](fixtures/function-values.k) can be compiled with the native compiler.

A binding copies a function reference without invoking it or consuming the original binding. `fn(int) -> int` is a structural signature; different named functions with that signature are interchangeable. Numeric widths and nominal record/enum declarations must still match exactly. A declaration with the same fields as another record is a different parameter type.

Function-valued parameters and results may themselves contain function signatures. Call chains such as `factory()(false)(14)` evaluate each callee before its arguments. Ordinary arguments evaluate once, left to right. Existing pipelines work with a function-valued binding: `10 -> combine(3)` means `combine(10, 3)` when `combine` is that binding. Function-value equality and reflection are not introduced.

## Maps and local workers

Sequential `map(values, transform)` accepts a compatible function-valued binding, parameter or expression. It keeps the existing one-element callback contract and input order. An inline map callback may also capture a completed function reference and invoke it. Callback creation is evaluated even for an empty input; the callback body is not invoked for empty inputs.

A local CPU worker can create and call function references internally, including through maps. A coordinating function can hold an ordinary function reference across its own task suspension and invoke it after awaiting data. This does not permit indirect spawn or transporting a function value as a worker argument, worker result or captured argument of a directly spawned map.

Ordinary immutable records returned by these calls keep their existing managed field ownership. Record values with String and array fields can still be returned from a worker and observed repeatedly; the function reference itself is not part of that transported data.

## Collection parameters and results

A function value can accept or return an immutable collection directly:

```kalandra
fn keep(values: [int]) -> [int]:
  values

fn doubled(values: [int]) -> [int]:
  map(values, fn(value): value * 2)

fn choose(flag: Bool) -> fn([int]) -> [int]:
  if flag: doubled
  else: keep

fn apply(values: [int], transform: fn([int]) -> [int]) -> [int]:
  transform(values)

export fn main() -> int:
  transform = choose(true)
  values = apply([10, 11], transform)
  values[0] + values[1]
```

The [complete fixture](fixtures/function-collections.k) returns `42`. Numeric tensors use ordinary signatures such as `fn(Tensor[float32, ?, ?]) -> Tensor[float32, ?, ?]`. Rank, element type, fixed extents and the distinction between an array and a tensor remain part of the signature. Rank-zero tensors such as `Tensor[int]` use the same callable path. Function signatures must match exactly; this increment does not add variance or automatic numeric conversions.

An array length is a value fact, not part of the `[T]` signature. Inferred array-producing functions can therefore be assigned to an annotated callable and selected together even when they produce different lengths. A dynamic parameter extent accepts different concrete input sizes. A fixed extent is checked statically when known and guarded at runtime otherwise. A dynamic result extent has a fresh identity for each invocation: two calls through the same function value do not promise equally shaped results. Later operations still guard their shape requirements. The compiler does not infer a relationship between parameter and result extents from a callable signature alone.

Bool, String and record arrays preserve the existing descriptor representation and managed child storage. A named local worker may create a function reference, invoke it on collections and return collection data through the ordinary retained-result path, including repeated awaits. Transporting the function reference itself remains unsupported. Inline map callbacks can call a captured function on a collection and produce a supported scalar element; arrays of arrays and tensor-valued map elements are not introduced.

The current numeric indirect-call boundary uses private checked descriptor adapters. It copies logical elements into managed backing and reconstructs tensors in the callee and caller. This preserves immutable values, borrowed/strided input ordering, empty shapes and checked failures, but it adds allocations and copies compared with a direct call. Shared-storage adapters and copy elimination are tracked in the [optimization roadmap](../roadmap.md#optimization); this implementation makes no zero-copy or performance claim. Ordinary statically named collection calls retain their existing lowering.

## Supported signatures and remaining gaps

Callable signatures accept and return all ten CPU numeric scalar types, Bool, String, completed records/enums, numeric arrays/tensors, Bool/String/record arrays and other supported function values. Completed TaskError values can be ordinary data; an expected-error channel is a separate concept. Records may contain the already supported collection fields. Parameter counts have no special small cap: the compiler's ordinary parsing and complexity budgets apply. Qualification includes a ten-argument call mixing six numeric types, Bool, String, a record and another function.

The following remain implementation gaps under the accepted function-value design:

- Expected-error callable signatures such as `fn(int) -> int ! ValidationError`, fallible factories returning functions, and callable targets requiring continuation lowering. Targets are checked transitively, including helpers that catch task failures internally. Ordinary checked arithmetic faults remain supported and supervised.
- General anonymous function bindings and returned closures with captured environments. The existing inline map callback remains supported.
- Function-valued record/enum fields, arrays of functions, indirect spawn, worker transport, GPU callbacks and remote function contracts.

These are staged implementation restrictions, not additional language design limits. Distributed contracts still require their separate design discussion; public C/C++ callback integration remains on its separate roadmap.

## Native lowering and checked execution

Typed IR distinguishes a named function reference from an invocation through a function value. The latter stores the callee value and checked argument types rather than choosing a single declaration during type checking. MLIR lowers it through a typed indirect call; the current private runtime representation is a native code pointer. It has no captured environment and requires no runtime environment allocation.

After LLVM translation, function addresses are redirected to checked entries and indirect calls receive the current invocation context. The same failure polling, cancellation checks and cleanup rules used by direct calls therefore apply. A fault while computing the callee stops evaluation before its arguments; a fault during invocation stops subsequent result use. Original source locations are preserved. This is compiler/runtime plumbing, not a public native callback ABI or a serialization format.

Backend validation checks function signatures, producer operations, references, argument counts/types, compatible branch results, binding reads, returned function types and execution boundaries. Recursive signature comparison and validation have depth/work budgets. Invalid typed IR is rejected before lowering.

## Qualification

### Initial named subset

Focused frontend checks cover named aliases, higher-order parameters/results, call chains, runtime selection, maps, imported functions, nominal identity, unsupported captures/transport and malformed typed IR. Execution checks cover all ten numeric types, mixed argument passing, Bool/String/record/enum values, nested signatures, worker-local calls, cached worker data, checked faults, evaluation order, allocation failure and preservation of rejected output artifacts.

All 143 selected checks passed on Apple M2 Max, including the existing compiler, map, module, task and expected-error regressions. The new execution suites run in debug, optimized, ASan/UBSan and separate ThreadSanitizer variants, compiling 124 programs. Private runtime probes verify checked context forwarding, original fault locations, pre-cancelled/failed contexts and aggregate ownership settlement. Floating-point identity maps reuse the existing raw-bit/strided-array harness, with 768 invocations and 1,053,184 exact lane comparisons. CLI allocation-failure sweeps run 384 processes, alongside 100 aggregate-context allocation probes. The [qualification evidence](../../native/metal-proof/evidence/cpu-function-values-2026-10-19.json) records the scope, tests and frozen source hashes; these checks do not qualify escaping closures, function transport, a public ABI or other platforms.

### Collection signature extension

All 171 selected checks passed on Apple M2 Max: three focused frontend/debug checks followed by 168 remaining regression and sanitizer checks. A final rank-zero validation extension was followed by rerunning all ten callable frontend/execution checks, including the four build variants. This gives 181 passing test executions across 171 distinct checks. The final collection suites compile 128 programs across debug, optimized, ASan/UBSan and separate ThreadSanitizer builds. Coverage includes every numeric width, Bool/String/record arrays, mixed arguments, inferred array lengths, fixed, dynamic and rank-zero tensor shapes, local imports, worker-produced collections, repeated awaits and inline map captures.

Raw collection probes execute 2,944 invocations and compare 1,053,184 lanes exactly, including floating-point edge bit patterns, offset/strided borrowed input, immutable snapshots and retained output leases after settlement. The extension also runs 1,664 CLI allocation-failure processes and 100 aggregate-context allocation probes. Checked faults retain their original source locations; already-failed and pre-cancelled contexts do not enter the target. Invalid collection signatures preserve existing executable and IR output artifacts. Existing named-function, frontend, collection, module, task and error regression suites also pass.

The [collection qualification evidence](../../native/metal-proof/evidence/cpu-function-collections-2026-10-19.json) records the regression and final callable batches with their corresponding frozen implementation/test hashes. This is focused macOS ARM64 qualification; the remaining callable, closure, transport and platform gaps listed above are unchanged.
