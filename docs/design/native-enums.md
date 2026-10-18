# Native CPU enums

User-defined enums now support payload-free variants and named fields containing any of the ten implemented CPU numeric scalar types, `Bool` or `String`.

```kalandra
enum Reading:
  Missing
  Value:
    measurement: float32
  Invalid:
    reason: String

fn valueOrDefault(reading: Reading, fallback: float32) -> float32:
  match reading:
    Reading.Missing: fallback
    Reading.Value { measurement }: measurement
    Reading.Invalid: fallback

fn main() -> int:
  value = Reading.Value { measurement: 21.5 }
  int(valueOrDefault(value, 0))
```

This prints `21`. `Reading.Missing` is a value without constructor parentheses. Payload constructors require every declared field exactly once, with the correct type. Written initializer order is preserved. There is no implicit numeric promotion or conversion between distinct enum declarations.

## Matching

A match evaluates its subject once and runs only the selected branch. Named fields can be bound directly (`{ measurement }`), renamed (`{ measurement: sample }`) or omitted when unused. Bindings stay within their branch. Branch bodies may contain local bindings and finish with a result expression.

Every declared variant must be covered, unless an explicit final `_` branch handles the remainder. Missing, duplicate and unreachable branches are diagnosed, including a redundant fallback after complete coverage. Returning branches require one common success type under the existing literal-context and shape rules.

Payload fields can be read only through a selected variant's pattern. `reading.measurement` is rejected. The compiler does not infer a common-field interface when multiple variants happen to share a field name. Their fields may have different types. Enum values have no numeric ordinal conversion, derived equality, record-style construction or `with` update operation.

Declarations are nominal. Imports, aliases and explicit re-exports preserve the original enum identity. Equal spellings in separate declarations do not make their values interchangeable.

## Ownership and local execution

Enum values and fields are immutable. Ordinary calls, conditional results, local CPU worker captures/results, nested workers and repeated awaits use the existing automatic lifetime model. String payloads retain their UTF-8 backing. The same storage foundation allows enum values in record fields and immutable arrays, including array maps and worker transport.

Only the active variant's initializer expressions are evaluated; inactive storage is initialized internally. A match that ignores the payload still evaluates its subject and constructor arguments. Arithmetic, allocation and task failures retain their existing propagation and cleanup rules.

The current lowering uses private, fully initialized tagged aggregates and the established record ownership implementation. Inactive numeric/Bool slots contain zero/false and inactive String slots contain an empty String. This is an implementation choice, not an exposed record interface or stable ABI. Storage currently includes slots for every variant; compact union storage is a later optimization. Match lowering uses the existing conditional IR and its configured depth/resource budgets.

## Remaining accepted variant work

The [accepted variant design](variants.md) remains the language contract. This first implementation deliberately rejects collection, record and nested-enum **payload fields**. Those fields need follow-up ownership and layout qualification. This differs from storing an enum value inside an already supported record or array, which is available.

GPU enums, recursive payloads, application `error` declarations, error-family unions, generics, guards and nested destructuring are not introduced here. Distributed execution and public C/C++ contracts remain separate roadmaps. Native CLI entry results retain their existing supported output types; return a matched scalar, String or numeric collection rather than an enum directly.

## Qualification

[Frontend tests](../../native/tests/EnumTests.cpp) cover declarations, constructors, nominal identity, payload bindings, exhaustive/common-result checking, scopes, explicit payload/GPU limits and rejection of malformed typed layouts. [Compiled programs](../../native/cmake/VerifyEnums.cmake) cover every numeric width, Bool/String payloads, common field spellings, Unicode, records/arrays, module aliases, single-variant and fallback-only matches, selected-branch execution, nested/cached workers, allocation-failure cleanup and output preservation after diagnostics. Debug, optimized, ASan/UBSan and TSan variants share the same checks.

The [qualification record](../../native/metal-proof/evidence/cpu-enums-2026-10-19.json) records the source hashes, generated programs and final regression scope.
