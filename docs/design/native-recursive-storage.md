# Recursive value storage

Recursive records and enum payloads will use compiler-managed references wherever a direct nominal field would otherwise create an infinite inline layout. Users keep ordinary immutable value syntax; there is no pointer, box, allocator or ownership annotation to write.

For example, the intended source form is:

```kalandra
enum List:
  Nil
  Cons:
    head: int
    tail: List
```

Storage planning, cycle-aware nominal field resolution and physical MLIR/LLVM type construction are implemented, **not yet recursive value execution**. The current frontend still rejects recursive storage declarations with `S068` before function analysis; the backend independently retains its execution gate until generated managed constructors, projection/matching and ownership integration are ready.

## Storage decisions

The planner identifies strongly connected groups of nominal declarations twice: once including array element dependencies, and once with only directly embedded nominal fields. A direct field within an inline recursive group uses a managed reference. Other direct nominal fields retain their existing inline representation.

Arrays already have a finite descriptor, so recursive array element types do not need an extra reference layer. For example, a tree containing `[Tree]` uses the ordinary array descriptor; its empty array is a finite base case. A cycle containing an array edge does not by itself require boxing the other direct fields.

Function signatures do not embed their parameter and result values. Their nominal references do not create storage edges. Existing function handles and other scalar/collection representations remain unchanged. These decisions make no public ABI or byte-size guarantee.

## Finite values

A record can be constructed when every direct nominal field can be constructed. An enum needs at least one variant with constructible payloads. Payload-free alternatives, primitive fields and empty arrays provide finite bases. The planner computes these facts with an iterative worklist, including mutual recursion and repeated dependencies.

`List.Nil` provides a base for `List.Cons`. In contrast, a record whose only field is another value of itself has no finite construction. The planner reports this distinction; source admission and its diagnostic policy remain part of the next implementation stage.

Values remain immutable. Construction can refer to existing values, rather than tying a recursive initialization knot. The intended runtime graph is therefore a finite directed acyclic graph with shared backing. A recursive type graph does not require cyclic runtime values.

## Ownership requirements before source admission

Managed payloads must retain immutable backing across construction, projection, matching, updates and returned values. Failure and cancellation must release partially constructed values. Releasing a deep graph must use an iterative, allocation-free worklist rather than recursive native destructors. Shared values must be released exactly once after their last owner disappears.

Physical type lowering now follows a bounded dependency order with references and descriptors as leaves, so it does not recursively expand nominal fields. Per-type ownership helpers still need cycle-aware identity memoization. Existing finite-layout walkers cannot simply be reused on cyclic type graphs. Worker packets, cached outcomes, repeated awaits and application-error payloads need independent lifetime and failure qualification before recursive values cross those boundaries.

## Implementation stages

1. **Implemented:** private storage planner with canonical recursive groups, per-field storage choices and finite-construction facts. Its graph traversal is iterative and bounded by a charged input budget. It validates nominal references and enum payload-slot partitions; it does not replace full typed-IR validation.
2. **Implemented:** ordinary field annotations resolve predeclared nominal identities without recursively expanding fields. Error aliases still copy completed families. The physical planner orders inline dependencies iteratively, bounds expanded scalar/pointer units and inline depth, and builds finite MLIR LLVM-dialect structures. The CPU backend uses this path for existing nonrecursive programs. Recursive source storage and forged recursive executable IR remain rejected.
3. **In progress:** runtime backing now supports private immutable recursive payload construction, retained child projection and iterative final release. **Next:** connect compiler-generated constructors, field reads, matching and immutable updates to that runtime, qualify their ownership, then admit the synchronous CPU source subset.
4. Qualify recursive worker transport and application-error payloads, allocation failures, cancellation and deep/shared graph cleanup.

GPU recursive values, distributed transport and public C/C++ representation are outside this step. The main roadmap estimate does not change for this foundation alone.

## Verification

[Storage planner tests](../../native/tests/RecordStorageTests.cpp) cover self/mutual recursion, finite enum bases, impossible cycles, recursive arrays, mixed descriptor/inline paths, repeated dependencies, acyclic sharing, opaque callable signatures, invalid nominal metadata and payload partitions, work limits and 10,000-type chains/cycles. Checked acyclic source is accepted by the planner; recursive source still receives `S068`. Both ordinary Debug and ASan/UBSan test targets are registered with CTest.

[Physical layout tests](../../native/tests/RecordPhysicalLayoutTests.cpp) verify sized LLVM translation for a recursive list, mutual references, recursive collection descriptors, acyclic layout order/sharing, all numeric widths, existing leaf representations, expansion/depth bounds, malformed fields and a 2,000-type cycle. An opaque function contract may name its containing record without creating a storage cycle; checked source and compiled local/worker examples cover this distinction. Existing enum, nested-record, record-array-field and error-family regression suites preserve current behavior.

The unit budget is an expansion bound, not an ABI byte count. Graph-input work is bounded separately. Neither unused variants nor unconstructible recursive declarations are made executable merely because their physical type is finite.

## Managed runtime backing

The existing allocation backing now carries an optional immutable dependency list. Private `Invocation::makeRecursiveValue` copies a complete payload, retains existing dependency leases and publishes the node only after those operations finish. A stable compiler-generated type token identifies its physical payload. No mutable payload pointer is returned. This reuses invocation allocation, failure injection and retained leases rather than adding a separate heap or user-facing memory syntax.

The compiler bridge must enumerate every owned payload field, including recursive children and ordinary String/collection/function backing. The runtime retains the supplied dependencies; it does not discover pointer fields by inspecting arbitrary bytes. This bridge is not yet emitted by the compiler, and its completeness must be qualified before source admission. It has no public C ABI or language API yet.

A retained lease can validate a recursive payload's type token, size and alignment, or independently retain one dependency by index. A returned byte view borrows its lease and must not outlive it. These operations continue to work after the original invocation settles. Dependency order is private metadata; it is not a source-level record layout guarantee. The private reference-count snapshot exists for diagnostics and ownership qualification, not synchronization or uniqueness decisions.

Parents retain children without duplicating their backing. Creating a different parent preserves the original value. Dependencies refer only to already-existing retained values, so this construction path cannot tie a mutable knot or introduce an ownership cycle. The invocation initially owns each published node and keeps its existing allocation lifetime; this step does not add last-use reclamation within an invocation.

Final release decrements child references using an intrusive worklist stored in retired backing headers. Only the thread retiring the final reference writes the worklist link. Cleanup allocates no memory and does not recurse on the native stack. Shared and duplicate edges each own a reference and retire independently. Cancellation or failure before publication destroys the temporary node and releases its acquired child references. Failure channels already present on an invocation are preserved.

[Runtime tests](../../native/tests/RecursiveValueRuntimeTests.cpp) exercise immutable copies, independent child projection, duplicate/shared tails, unchanged parents after replacement, ordinary backing dependencies, invalid construction/projection requests, injected allocation failure, cancellation races and concurrent retirement. A 100,000-link chain survives invocation settlement and releases on a 256 KiB thread stack; the retained terminal node's reference count verifies that the chain leaves no owned child edges behind. Debug, optimized, ASan/UBSan and TSan variants use the same cases. Compiler source admission and recursive worker transport remain blocked.
