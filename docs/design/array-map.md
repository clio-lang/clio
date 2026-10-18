# Sequential native array mapping

The native CPU subset implements `map(values, transform)` and its pipeline form for the [immutable numeric array foundation](arrays.md). The transform is a named function or an inline anonymous function with one numeric scalar parameter and a numeric scalar result.

```kalandra
fn double(value: int) -> int:
  value * 2

fn doubled(values: [int]) -> [int]:
  values -> map(double)
```

`doubled([1, 2, 3])` produces `[2, 4, 6]`. The input remains unchanged and usable. `map([1, 2, 3], double)` means the same thing.

## Types and evaluation

A named or explicitly annotated callback parameter gives literal array arguments their element context. Otherwise the input array establishes the anonymous parameter type. Already typed arrays must match that parameter exactly; map does not implicitly convert their elements. The callback result determines the output element type, which may differ from the input:

```kalandra
fn asFloat(value: int) -> float:
  float(value)

fn converted(values: [int]) -> [float]:
  map(values, asFloat)
```

All 36 input/output combinations of the six implemented CPU numeric types can be represented by ordinary named functions. Explicit conversion still follows the checked numeric conversion contract. Results remain homogeneous numeric arrays of the same length as the input, including its private dynamic length identity. An expected result type does not change the callback's declared/inferred result type.

Callbacks execute sequentially in input order, once per element, with exactly one explicit element argument. Map never supplies an implicit index or collection argument. Empty arrays execute no callbacks; `map([], double)` obtains element context from `double` and returns an empty `[int64]`.

A runtime arithmetic fault stops the map at the first failing element. Its source location points to the failing callback/helper operation. No partial array result is published. Inputs remain unchanged, and all intermediate/output allocation owners settle on failure. Loop execution uses the existing cooperative cancellation and checked allocation machinery.

## Anonymous callbacks and captures

```kalandra
fn shifted(values: [int], offset: int) -> [int]:
  values -> map(fn(value): value + offset)
```

`map(values, fn(value): value + offset)` is equivalent. The input establishes the element parameter type. Optional annotations can make it explicit: `map([], fn(value: int) -> float: float(value))`. An empty input without an annotated callback parameter has no element type to infer and is rejected.

The callback body is currently one expression. Names resolve lexically; its parameter can shadow an outer binding. Only referenced outer values are captured, including through nested anonymous callbacks. Supported captures are completed CPU numeric scalars, numeric arrays/tensors, scalar Bool values and [immutable CPU records](record-closures.md). Task handles, unhandled fallible results, device selectors and device-resident tensors cannot be captured.

The compiler lifts a callback into a private function and passes its captures as additional internal arguments. Captures are established once before iteration; collection storage follows the existing immutable ownership and worker handoff rules. This does not introduce a public closure ABI or allow an anonymous function to escape as a value. Empty maps do not invoke the callback, even if its body would fail.

Mapped arrays can feed [explicit rank-one tensor construction](arrays.md#explicit-tensor-construction-from-arrays): `values -> map(double) -> tensor() -> reduceSum()`.

## Ordinary helpers and workers

Callbacks may call other synchronous functions, use CPU conditionals, construct temporary numeric collections/tensors and use the supported synchronous numeric operations. Worker kernel extraction imports the callback's synchronous helper graph with remapped function, value and symbol identities. A mapped result can be retained after its function or worker ends, shared by later calls and obtained from cached awaits.

```kalandra
fn background(values: [int]) -> [int] ! TaskError:
  try parallel:
    work = spawn map(values, double)
    try await work
```

This sends one sequential map to a worker. It does not run individual elements in parallel. Mapping inside an ordinary worker function also works, including nested structured tasks around that function. Checked callback faults become ordinary supervised worker faults; existing catch/recovery and cancellation/deadline settlement rules apply.

## Current limits

This slice accepts named source functions and inline anonymous callbacks with lexical captures. Function-valued bindings, callback aliases, returned closures and anonymous block bodies are separate work. Named or anonymous wrappers can expose numeric conversions; numeric type names themselves are not first-class callbacks yet.

Callbacks must be synchronous throughout their reachable helper graph. Task operations, expected-error channels and their recovery, transfers/device selection, and other resumable operations are rejected even when a particular branch or input is empty. Bool, tensor, array and general-value callback results remain outside the numeric array subset. GPU/mixed-target mapping is gated. Existing restrictions on ordinary recursion in task-enabled modules still apply.

Explicit parallel mapping, broader element types, first-class functions and direct array display in the development CLI remain separate work. There is no new public native callback ABI in this implementation.

## Qualification

On Apple M2 Max, 89 focused checks passed across frontend and native/generated execution, including debug, optimized, ASan/UBSan and separate ThreadSanitizer variants. The map suites ran 2,304 identity-map invocations with 3,159,552 exact lane checks, 12,624 mapped conversion cases with 262,144 exact lane checks, and 1,200 worker harness invocations. The conversion cases reuse independent APFloat/integer oracles. Source ordering, empty maps, helper import, temporary callback allocations, retained outputs, cancellation, allocation failure and invalid-program artifact preservation passed. All 640 tracked numerical artifacts remain unchanged. This is focused qualification, not a full-suite claim. The [evidence record](../../native/metal-proof/evidence/cpu-array-map-2026-10-18.json) records coverage and source/artifact hashes.

The anonymous-callback extension passed 69 focused checks, including debug, optimized, ASan/UBSan and separate ThreadSanitizer execution. Its six numeric identity closures ran 2,304 invocations with 3,159,552 exact lane checks; 1,200 worker harness runs exercised scalar, Bool, array and tensor captures, nested callbacks, cached results, source faults, cancellation and allocation failure. The prior named-map, array, frontend and selected CPU/GPU regressions also passed. The [capture evidence record](../../native/metal-proof/evidence/cpu-array-closures-2026-10-18.json) records the scope, test reruns and unchanged numerical artifacts.
