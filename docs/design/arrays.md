# Immutable native arrays

The native CPU subset now implements the construction and value-passing part of the [accepted core array design](core.md#4-transform-an-array). Numeric arrays are ordered immutable collections. `[int]` is distinct from a ranked tensor type, and its length is runtime data rather than part of the source type.

```kalandra
fn pair(left: int, right: int) -> [int]:
  [left, right]

fn choose(flag: Bool) -> [int]:
  if flag:
    pair(10, 20)
  else:
    []
```

`choose` may return two elements or none. Both results have type `[int64]`. There is no equal-length requirement between arrays passed to a function or returned by its branches.

## Elements and inference

This first subset supports scalar `int32`, `uint32`, `int64`, `uint64`, `float32` and `float64` elements, including the accepted `int`, `uint` and `float` aliases.

Without context, each leaf expression is inferred independently in source order. Whole-number expressions default to `int64`; decimal/exponent expressions follow the scalar `float64` defaults. All elements must have exactly the same completed CPU numeric type. `[1, 2.5]` and `[int32(1), 2]` are rejected in either order. An expected array type supplies literal context:

```kalandra
fn samples() -> [float32]:
  [1, 2, 3]

fn empty() -> [uint]:
  []
```

Already typed values must conform exactly; contextual typing does not silently convert them. Empty arrays need element context, so an unannotated `values = []` is rejected. Nested arrays and arrays of Bool, records, functions, tasks or expected-error results are not implemented in this slice.

Array elements evaluate left to right, once each. A runtime failure stops evaluation and retains its original source location. No partial array result is published. Source/value/depth limits and the existing bounded collection-element, indexing-range and allocation-byte checks apply.

## Sharing, calls and workers

Passing an array does not consume its binding. Functions can return it, and the returned value remains valid after the function or worker completes. Multiple calls and tasks may share the same immutable input. Ordinary calls, pipelines to named functions, conditional length joins, structured parallel scopes, nested workers, cached awaits and TaskError recovery preserve array types and ownership.

The implementation reuses checked rank-one storage and managed ownership from the tensor runtime. A separate source-category flag distinguishes arrays throughout typed IR. Worker values have separate array layout names and private identities, even when an array and a rank-one tensor carry the same numeric element type. These private layouts are not a public native or wire ABI.

There are no implicit array-to-tensor or tensor-to-array coercions. Tensor arithmetic, reductions, matrix multiplication, numeric conversion calls and device transfers do not accept arrays in this slice. GPU/mixed-target array execution is gated.

## Explicit tensor construction from arrays

Use `tensor(values)` to construct a rank-one CPU tensor from a completed numeric array:

```kalandra
fn total(values: [float], offset: float) -> float:
  values -> map(fn(value): value + offset) -> tensor() -> reduceSum()
```

The constructor preserves the array's numeric element type, element order and length, including private dynamic extent facts. An empty typed array produces an empty tensor. The array remains available for later calls; it does not become a tensor implicitly. To change element type, use an explicit numeric conversion in `map` or on the resulting tensor.

A fixed tensor annotation checks the runtime length rather than reshaping the array:

```kalandra
fn four(values: [int]) -> Tensor[int, 4]:
  tensor(values)
```

A statically known wrong length is rejected; an unknown wrong length raises a checked Shape fault before allocating the result. Rank changes and `tensor(values, [rows, columns])` for runtime array data are separate work. The existing ranked literal constructor, including `tensor([1, 2, 3, 4], [2, 2])`, remains available.

The current implementation performs a checked ordered copy into managed tensor storage. It preserves raw floating-point representations, including signed zero and NaN payloads. Borrowed native input storage does not escape as an owned tensor result. Cancellation or allocation failure publishes no partial result and settles intermediate storage.

Construction also works in ordinary worker functions, in anonymous map callbacks and through `spawn tensor(values)`. Worker handoff preserves the separate array-input and tensor-result categories and the existing retained ownership rules. Calls used as arguments are evaluated before dispatch; use a worker helper when the whole map/construction pipeline should run in that worker. GPU/mixed-target array construction is not part of this CPU slice.

## Remaining collection work

This is an array value foundation, not the complete collection API. [Sequential `map` with named functions or inline anonymous numeric callbacks and lexical captures](array-map.md) is now implemented. First-class function values remain separate work. Rank-changing runtime tensor constructors, tensor-to-array construction, nested/general element types and indexing remain unimplemented. Indexed writes are never part of the immutable model; any future replacement operation must produce another logical value.

The development CLI still requires a scalar `main` result; displaying arrays directly is separate tooling work. Array-returning functions are qualified through checked native test interfaces and worker outcomes.

## Qualification

On Apple M2 Max, 83 focused checks passed across frontend and generated/native execution, including debug, optimized, ASan/UBSan and separate ThreadSanitizer variants. The array suites ran 1,296 worker harness invocations, 192 allocation/lifetime cases and 640 exact retained float64 lane checks. Existing tensor inference, control-flow, numeric workers and selected Metal regressions also passed. All 640 tracked numerical artifacts remain unchanged. This is focused qualification, not a full-suite claim. The [evidence record](../../native/metal-proof/evidence/cpu-arrays-2026-10-17.json) records coverage and source/artifact hashes.

Explicit runtime array-to-tensor construction passed 87 focused checks on Apple M2 Max, including debug, optimized, ASan/UBSan and separate ThreadSanitizer builds. The constructor suites ran 2,304 copy invocations with 3,159,552 exact lane checks, 312 fixed-shape/ownership cases, 72 size-metadata cases, 48 pre-entry/active cancellation cases and 1,272 worker harness runs. Existing map/closure, array, numeric frontend, tensor inference and selected CPU/GPU regressions passed. All 640 tracked numerical artifacts and the numeric/runtime sources remain unchanged. See the [constructor evidence record](../../native/metal-proof/evidence/cpu-array-tensor-2026-10-18.json) for scope and hashes.
