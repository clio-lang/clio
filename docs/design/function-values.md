# Function values

Proposal — 2026-10-19. The [core design](core.md) accepts function types, lexical captures and automatically managed capture lifetimes. This proposal fills in their spelling and the implementation order. General function values are **not implemented yet**; the examples below specify proposed behavior. Existing [inline map callbacks](array-map.md) remain the implemented baseline.

## The ordinary case

```kalandra
fn double(value: int) -> int:
  value * 2

fn apply(value: int, transform: fn(int) -> int) -> int:
  transform(value)

fn makeAdder(offset: int) -> fn(int) -> int:
  fn(value: int): value + offset

export fn main() -> int:
  transform = double
  addTen = makeAdder(10)
  apply(transform(3), addTen)
```

The result is `16`. A named function can be bound without calling it. A returned closure keeps the captured `offset` valid after `makeAdder` finishes. Calling either value uses the ordinary call syntax; no wrapper object, capture list or lifetime annotation is required.

## Function types and inference

Use `fn(ParameterType, ...) -> ResultType`. Parameter names belong to declarations and anonymous functions, not their types. Zero parameters use `fn() -> int`. Parameters and captures have no special fixed-count limit; ordinary compiler complexity and runtime allocation limits still apply.

```kalandra
increment: fn(int) -> int = fn(value): value + 1
twice = fn(value: int): value * 2
values = map([1, 2, 3], increment)
```

An expected function type supplies anonymous parameter types. Without that context, annotate the parameters; infer the result from the body. Do not infer a function's parameter types from whichever later call happens to be encountered first. Missing information is a diagnostic, never `Any`.

Function types are structural: equal parameter and result types describe compatible callables even when they capture different data or refer to different declarations. Records and enums inside those signatures retain their existing nominal identities. The initial rule requires exact parameter/result types, including concrete numeric widths and canonical expected-error sets. There is no implicit numeric conversion, parameter/result variance, overload resolution, generic function value or partial application.

Function arrows associate to the right:

```kalandra
fn(int) -> fn(int) -> int
fn(fn(int) -> int, int) -> int
```

The first takes an integer and returns a function. The second takes a function and an integer. Parentheses can group a function type when needed.

## Expected errors remain explicit

`fn(int) -> int ! ValidationError` describes a function whose invocation can return `ValidationError`. An expected error remains a result that the caller must handle or propagate:

```kalandra
fn checkedApply(value: int,
                transform: fn(int) -> int ! ValidationError) -> int ! ValidationError:
  try transform(value)
```

Here `ValidationError` stands for a declared error family. This is a signature/body illustration, not a standalone program.

The error suffix belongs to the immediately preceding result type. Group the returned callable to distinguish a fallible factory from a fallible returned function:

```kalandra
fn make(offset: int) -> (fn(int) -> int) ! BuildError
fn make(offset: int) -> fn(int) -> int ! ValidationError
```

These are interface examples. The first factory can fail while constructing an infallible function. The second factory returns a function whose later invocation can fail. Nested expected-result values are not introduced by this spelling. Error unions and aliases follow the existing [error-channel rules](error-unions.md).

## Captures are immutable managed values

Capture referenced lexical bindings when evaluating the anonymous function, once. Capture nothing else implicitly. Repeated references to the same binding share that capture; shadowing follows ordinary lexical scope. Capturing a value does not consume it or allow mutation through another binding.

Completed CPU scalars, Bool, String, arrays, tensors, records and enums use their existing immutable lifetime rules. Captured function values retain their own environments transitively. Returning a closure, passing it into another function, or keeping it after the creator returns must preserve those values. No stack address may outlive its owner. This does not require an observable deep copy of collection data, nor does it promise a particular allocation strategy.

Do not capture unhandled expected results, child task handles, GPU-resident values, device selectors, or scoped resource capabilities in the first implementation. Handle a fallible result before capturing its completed value. Existing task/resource escape restrictions remain in force; wrapping a handle in a closure must not bypass them.

Closure equality, serialization, a public native callback ABI and a way to inspect the capture environment are outside this proposal.

## Execution boundary for the first implementation

Start with synchronous CPU callables. They can use the supported synchronous CPU operations and return typed expected errors. The initial body remains the existing anonymous expression form, `fn(parameters): expression`; general anonymous block bodies are a later increment, not a change to already accepted block-bodied error handlers.

Named function references must be checked transitively for task/device coordination, including helpers which hide those operations behind error handling. Reject a resumable target with an actionable diagnostic; never treat it as a synchronous native call or block a scheduler worker waiting for its children.

Ordinary calls and `map(values, transform)` must accept the same compatible function value. A function-valued conditional can select between compatible callables with different captures. A pipeline inserts its left-hand value as the first argument under the existing rule. Argument expressions are evaluated once, left to right; creating a closure does not execute its body.

Initially reject function-valued fields, arrays of functions, function-valued worker captures/results, indirect `spawn`, and GPU function arguments. These are staged implementation gaps, not permanent language limits. Keep statically named worker calls working. A synchronous worker may still construct and invoke a closure internally once that local lowering is qualified. Indirect task invocation must eventually preserve the existing scheduler admission, capture retention, cancellation and settlement contracts.

Do not freeze the synchronous-only restriction into an undocumented universal callable ABI. Before supporting resumable function values, extend the compiler's inferred execution information and continuation calling convention. Authors should not need manual effect lists merely to pass a function around. Remote function contracts belong to the separate distributed roadmap and require the agreed design discussion first.

## Implementation and qualification order

1. Settle this syntax and scope. Add recursive function-type syntax and grouped type parsing, with bounded nesting, source spans and clear diagnostics. Distinguish a callable's expected error from a factory's error channel.
2. Add typed function values and calls: named references, immutable aliases, parameters, compatible branch results and sequential maps. Check exact signatures and preserve nominal identities across local imports. Keep current direct calls and callback behavior compatible.
3. Add returned expression closures with managed environments, nested function captures and anonymous type inference. Keep the representation private. Prefer direct-call specialization where provable, but support runtime selection between compatible functions rather than relying on one statically chosen target.
4. Qualify ownership and failures before extending transport: returned closures after creator exit, captured arrays/records/Strings, nested closures, repeated invocation, branch-selected targets, typed errors, empty maps, invalid signatures, shadowing, allocation failure and rejected task escapes. Exercise debug, optimized and sanitizer builds. Recheck existing map and local-worker regressions.
5. Extend anonymous bodies, aggregate storage and local-worker transport in separate reviewable increments; address resumable calls explicitly. Keep GPU callbacks, distributed contracts and the public C/C++ ABI on their respective roadmaps.

Each implementation increment must state its supported subset. This proposal does not claim compiler support, runtime qualification or a public closure representation.
