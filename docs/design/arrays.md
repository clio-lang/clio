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

There are no array-to-tensor or tensor-to-array coercions. Tensor arithmetic, reductions, matrix multiplication, numeric conversion calls and device transfers do not accept arrays in this slice. GPU/mixed-target array execution is gated.

## Remaining collection work

This is an array value foundation, not the complete collection API. [Sequential `map` with named numeric functions](array-map.md) is now implemented. Anonymous functions with lexical captures remain the next collection implementation work. Explicit `tensor(values)` construction from runtime arrays, nested/general element types and indexing also remain unimplemented. Indexed writes are never part of the immutable model; any future replacement operation must produce another logical value.

The development CLI still requires a scalar `main` result; displaying arrays directly is separate tooling work. Array-returning functions are qualified through checked native test interfaces and worker outcomes.

## Qualification

On Apple M2 Max, 83 focused checks passed across frontend and generated/native execution, including debug, optimized, ASan/UBSan and separate ThreadSanitizer variants. The array suites ran 1,296 worker harness invocations, 192 allocation/lifetime cases and 640 exact retained float64 lane checks. Existing tensor inference, control-flow, numeric workers and selected Metal regressions also passed. All 640 tracked numerical artifacts remain unchanged. This is focused qualification, not a full-suite claim. The [evidence record](../../native/metal-proof/evidence/cpu-arrays-2026-10-17.json) records coverage and source/artifact hashes.
