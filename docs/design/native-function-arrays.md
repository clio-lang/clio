# Arrays of functions

Implemented native CPU subset — 2026-10-19. Immutable arrays can contain named functions and managed closures with one shared structural signature. This extends [native function values](native-function-values.md), [managed closures](native-closures.md) and [function-valued fields](native-callable-fields.md).

```kalandra
fn make(offset: int) -> [fn(int) -> int]:
  [fn(value): value + offset, fn(value): value * offset]

fn main() -> int:
  callbacks = make(20)
  callbacks[0](2) + callbacks[1](1)
```

The [standalone fixture](fixtures/function-arrays.k) returns `42`. The declared array element type supplies each anonymous function's parameter and result types. Both callbacks retain their captured `offset` after `make` returns.

## Types and inference

Use `[fn(ParameterType, ...) -> ResultType]`. Each element has the same parameter/result types, numeric widths, nominal record identities, tensor shape contract and expected-error set. Aliases and reordered error unions follow the existing canonical channel rules. Functions with incompatible signatures cannot be mixed through literals, concatenation, branches, fields or higher-order calls.

An unannotated nonempty literal can infer its element signature from independently typed elements, such as named functions or anonymous functions with annotated parameters. A later element is not used to guess an earlier element's parameter types. An explicit array type supplies context to every element; it is required for an empty literal:

```kalandra
callbacks: [fn(int) -> int] = []
```

Supported synchronous factories can accept and return function arrays, including through other function values. Lengths remain value facts, rather than part of the `[T]` callable contract. Nested array types and arrays of tensors remain outside the current array subset.

## Indexing and collection operations

Indexing returns a function value that can be bound or invoked immediately. Bounds checks happen before reading or calling the element. Negative and statically out-of-range indices are rejected; unknown indices use the existing checked Bounds fault. The array itself is not callable.

Pipelines support indexed targets, including `21 -> callbacks[0]` and `21 -> callbacks[0]()`. Existing `length`, `slice`, `concat` and sequential `map` operations preserve signatures and immutable ownership. Maps can consume function elements or construct new closures. An empty map does not execute its callback or allocate element environments.

Reading or copying a function element does not execute it. Array copies store code/environment references; they do not mutate captures. Slicing and concatenation use the current owned-array copying implementation. Shared backing and allocation elision remain [optimization work](../roadmap.md#optimization).

## Expected errors and aggregates

An element type `[fn(int) -> int ! InputError]` describes functions whose invocation can produce `InputError`. Creating, reading or copying the array does not invoke those functions. Each actual call must handle, propagate or return the expected error.

A factory may separately return an array or a factory error: `fn make() -> [fn(int) -> int ! InputError] ! BuildError`. The brackets delimit the element's callable type; the outer suffix belongs to the factory.

Sequential maps require completed elements. Returning an error-producing function value is allowed because the value itself is completed. Invoking it inside a map requires handling its errors before returning the mapped element. [Direct static-map callbacks](native-control-maps.md) and bound function-value callbacks both support synchronous recovery before returning an element.

Function arrays also work in records, enum variants and expected-error payloads within one invocation. Imported helpers preserve the same declared signatures. Native executable output does not display function values: `main` must return a supported printable result, such as a count or a callback's numeric result.

## Storage and execution boundary

The existing owned-array descriptor points to inline code/environment pairs. Each cell occupies two pointers on the qualified target. The compiler reuses checked array allocation, descriptor validation and same-invocation retention. Captured environments and their managed payloads remain valid until invocation settlement, including after their creator returns and while a coordinator waits for ordinary worker results.

A worker can create and use function arrays locally, then return a result without function storage. Function transport remains unsupported: arrays, nested aggregate fields, worker captures and declared error payloads containing functions are rejected at the worker boundary. This restriction is type-based, including untaken variants and error paths.

The descriptor retention used internally does not establish callback ownership across invocations or a public native ABI. GPU callbacks, distributed execution and C/C++ integration retain their separate roadmaps.

## Remaining work

- General standalone indented expressions inside delimiters. [Anonymous suites](native-delimited-closures.md) are supported, including function-array elements.
- Delimiter-aware indented anonymous bodies.
- Recursive control-flow callables, indirect spawn and function transport.
- Earlier reclamation, shared storage and allocation/copy elimination.

## Qualification

All 84 selected checks passed on Apple M2 Max. New execution suites compile 152 programs across debug, optimized, ASan/UBSan and separate ThreadSanitizer builds. Relevant existing frontend, callable, closure, collection, module, record, enum, error and worker regressions pass in their selected debug and ASan/UBSan modes.

The frontend catalog covers 25 accepted and 24 rejected programs per variant, plus 12 forged-metadata cases, nested type spans, parser depth limits, GPU rejection and an explicit two-pointer storage-budget diagnostic. Execution coverage includes all ten scalar widths, contextual and inferred literals, empty arrays/maps, indexing, both indexed pipeline forms, maps, slice/concat, fields, imported factories and independent factory/element error channels.

Private probes invoke returned-array callbacks 512 times after creator exit, exercise 40 context-allocation cases and 40 creator-allocation cases, and verify stopped/failed contexts and balanced transitive cleanup. CLI sweeps run 960 allocation-failure processes with exact successful output and no partial failed output. Worker-local use, local recovery, coordinator-held arrays and bounds-before-invocation checks additionally run with pools of one, two and four threads. Invalid signatures and unsupported entry results preserve existing executable and IR artifacts.

The [qualification evidence](../../native/metal-proof/evidence/cpu-function-arrays-2026-10-19.json) records selected tests, per-variant counts and frozen sources. It qualifies this macOS ARM64 subset, not function transport, resumable callables, a public ABI, performance improvements or other platforms.
