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

This is a representation decision and an implemented internal planner, **not yet an executable language feature**. The current frontend still rejects recursive declarations with `S068` until construction, lowering and ownership support are ready.

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

Type lowering and per-type ownership helpers must predeclare and memoize recursive identities. Existing finite-layout walkers cannot simply be reused on cyclic type graphs. Worker packets, cached outcomes, repeated awaits and application-error payloads need independent lifetime and failure qualification before recursive values cross those boundaries.

## Implementation stages

1. **Implemented:** private storage planner with canonical recursive groups, per-field storage choices and finite-construction facts. Its graph traversal is iterative and bounded by a charged input budget. It validates nominal references and enum payload-slot partitions; it does not replace full typed-IR validation.
2. **Next:** cycle-aware nominal type resolution and physical layout, retaining explicit rejection wherever runtime support is absent.
3. Managed constructors, projection, matching, immutable updates and iterative retain/release integration; then admit the qualified CPU source subset.
4. Qualify recursive worker transport and application-error payloads, allocation failures, cancellation and deep/shared graph cleanup.

GPU recursive values, distributed transport and public C/C++ representation are outside this step. The main roadmap estimate does not change for this foundation alone.

## Verification

[Storage planner tests](../../native/tests/RecordStorageTests.cpp) cover self/mutual recursion, finite enum bases, impossible cycles, recursive arrays, mixed descriptor/inline paths, repeated dependencies, acyclic sharing, opaque callable signatures, invalid nominal metadata and payload partitions, work limits and 10,000-type chains/cycles. Checked acyclic source is accepted by the planner; recursive source still receives `S068`. Both ordinary Debug and ASan/UBSan test targets are registered with CTest.
