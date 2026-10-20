# Function-containing CPU worker collections

Spawned `slice`, `concat`, and `length` now accept arrays whose elements are proven synchronous functions or records/enums containing those functions. The compiler checks all transported function environments before allowing the task, even if a slice is empty or a query returns only a count.

```kalandra
fn make(offset:int)->fn(int)->int:
  numbers=[offset]
  fn(value:int):numbers[0]+value

fn main()->int ! TaskError:
  callbacks=[make(1),make(40)]
  selected=try parallel:
    try await spawn slice(callbacks,1,2)
  selected[0](2)
```

`concat` checks both input arrays. Function-containing results own their environments independently of the source invocation and producing group. They can be observed repeatedly or passed onward to another worker. The existing runtime packet copying, immutable data ownership, capture budgets, cancellation and checked fault behavior apply unchanged; there is no new runtime ABI.

Slice bounds are evaluated in the caller and checked by the existing collection implementation. Invalid constant bounds remain compile-time errors; invalid runtime bounds produce the existing `TaskError.Fault` with `FaultKind.Bounds`. Function-containing arrays keep their original element signatures and nominal record/enum identities.

Unknown function origins and unsupported transitive captures remain `S074` errors. A zero-length slice does not erase unsafe input provenance, and a safe input on one side of a concatenation cannot hide an unsafe input on the other side. Rejected programs preserve existing executable, LLVM and MLIR output files.

This milestone does not extend `shape` to ordinary arrays: it remains a numeric tensor query. It does not add function-containing error payloads, resumable first-class functions, or placement-aware/GPU callbacks.

## Sequential maps and parallel mapping

`spawn map(values, callback)` still schedules one sequential loop as one CPU task. For a fixed collection of calls, spawning them before awaiting them allows the bounded scheduler to run them concurrently:

```kalandra
try parallel:
  first=spawn double(10)
  second=spawn double(20)
  third=spawn double(30)
  [try await first,try await second,try await third]
```

A typed divide-and-conquer helper can map an array in parallel today:

```kalandra
fn parallelMap(values:[int],transform:fn(int)->int)->[int] ! TaskError:
  count=length(values)
  if count==0:[]
  else:
    if count==1:[transform(values[0])]
    else:
      middle=count/2
      try parallel:
        left=spawn parallelMap(slice(values,0,middle),transform)
        right=spawn parallelMap(slice(values,middle,count),transform)
        first=try await left
        second=try await right
        concat(first,second)
```

Both halves are submitted before either is awaited. Leaf tasks apply the callback, and concatenation preserves input order. This example compiles and runs with the current CPU implementation; it is a specific `[int]` helper, not a generic standard-library API. It creates coordinator tasks as well as leaf tasks, copies slices under the current storage implementation, and remains subject to scheduler admission limits. It is not an efficient scheduling strategy for tiny operations or very large arrays.

A built-in parallel map is **missing core functionality**, tracked in the [roadmap](../roadmap.md#immediate-accepted-core-queue). Its surface syntax, bounded scheduling/granularity, ordered results, grouped errors and cancellation need to be specified before implementation. The helper demonstrates that users can express parallel mapping; the built-in should avoid its task-tree and intermediate-collection overhead.

## Qualification

The focused suite covers function and callable-aggregate slices/concatenations, length queries, empty collections, dynamic bounds, bounds-fault recovery, nested workers, repeated awaits and onward submission. It runs with worker counts 1, 2, and 4, injected allocation failures, unsafe/unknown-origin rejections and forged element provenance. Qualification also includes the existing function-array, callable-field, worker-map and worker-transport regressions. This is a selected suite, not the full project suite.

**36/36 selected CTest checks passed.** See the [qualification record](../../native/metal-proof/evidence/cpu-worker-callable-collections-2026-10-20.json) for the exact selection and scope.
