# Kalandra numeric types and arithmetic proposal

Accepted numeric design — 2026-10-14. The project owner approved the default widths, literal typing, conversions, and arithmetic rules below. They describe the fresh implementation, not behavior of the released Kalandra 0.13 compiler. Error propagation is accepted separately; tensor/reduction extensions are accepted in the tensor design.

Use convenient defaults for everyday code and explicit widths for memory layout, native interfaces, and tensors. Arithmetic should have predictable types, diagnose mistakes, and preserve safety in optimized builds. CPU, GPU, and remote execution must not silently change a declared type or precision.

## Accepted defaults

| Name    | Meaning                      | Explicit equivalent |
| ------- | ---------------------------- | ------------------- |
| `int`   | Signed 64-bit integer        | `int64`             |
| `uint`  | Unsigned 64-bit integer      | `uint64`            |
| `float` | IEEE binary64 floating point | `float64`           |

These aliases have the same meaning on every target. They are not pointer-sized types. Native pointer sizes and array indexing representations are separate ABI/runtime decisions, not reasons to vary public numeric types.

Support `int8`, `int16`, `int32`, `int64`, their unsigned equivalents, and `float32`/`float64` in the first numeric core. Evaluate `int128`/`uint128`, `float16`, and `bfloat16` in the tensor/extended-number proposal. A format can be represented or serialized even when a device cannot efficiently perform arithmetic on it; representation support and arithmetic capability must be specified separately.

The 64-bit defaults favor range and stable cross-target meaning. Compute-focused programs choose narrower types deliberately. A later change to the alias defaults would be a language-level breaking decision, not a backend optimization.

## Literals and inference

```kalandra
count = 3
ratio = 0.5
capacity: uint = 32
sample: float32 = 0.5
```

Unconstrained whole-number literals infer `int`; decimal or floating-exponent literals infer `float`. An expected numeric type may type a literal directly, provided its value is valid for that type. This is distinct from converting an already typed variable.

```kalandra
fn double(value: int32) -> int32:
  value * 2

answer = double(21)
```

The parameter context types `21` as int32. The known int32 operand types the literal `2` as int32; the result is int32. Context does not search for the smallest representation or change a variable's established type.

Integer literals are parsed with enough compile-time precision to perform range checks, including the signed minimum written with a leading minus. Their runtime types remain fixed-width. Fractional literals cannot initialize integer types. Float literals round to the declared format using round-to-nearest, ties-to-even; overflow of a finite literal is diagnosed rather than silently producing infinity.

Invalid:

```kalandra
negative: uint = -1
tooLarge: uint8 = 256
fractional: int = 1.5
```

Literal format details such as hexadecimal notation, digit separators, and suffixes are a later grammar decision. Explicit annotations are sufficient for these examples.

## No silent mixing of typed values

Ordinary numeric binary operations require operands of the same concrete type. Aliases count as their explicit equivalents. A literal can take the other operand's numeric type; an already typed variable cannot silently widen, narrow, or switch family.

```kalandra
count: int = 3
ratio: float = 0.5
mixed = count + ratio
```

Reject `mixed` and suggest an explicit conversion. Likewise, adding an int32 variable to an int64 variable requires an explicit conversion. There are no C-style signed/unsigned promotion rules.

A homogeneous array has one element type. With no expected array type, integer and floating literals do not silently establish a mixed/promotion rule. Write `values: [float] = [1, 2.5]`; the array context types both literals as float. An unannotated `[1, 2.5]` needs an annotation under this initial rule.

Generics and numeric constraints are separate design work. A monomorphic function with an `int` parameter does not automatically specialize into int32 or float variants merely because a caller supplies those types.

## Explicit conversion

Use a numeric type as a conversion function:

```kalandra
count = 3
ratio = float(count) / 2.0
```

`ratio` is float 1.5. Conversion has the same ordinary call spelling as other operations and requires no decorator or special cast operator.

| Conversion         | Proposed behavior                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------ |
| Integer to integer | Preserve the value; fail if it is outside the destination range                            |
| Integer to float   | Round to the destination format; precision loss is explicitly authorized by the conversion |
| Float32 to float64 | Preserve the represented value exactly                                                     |
| Float64 to float32 | Round to nearest, ties-to-even; fail if a finite source overflows to infinity              |
| Float to integer   | Truncate toward zero; fail for NaN, infinity, or an out-of-range truncated value           |

Floating-width conversions preserve infinity and NaN as nonfinite values; preservation of a NaN payload is not part of this initial contract. Lossless conversions may be optimized away. Known invalid conversions are compile-time errors; runtime-invalid checked conversions produce an arithmetic failure. The accepted [errors design](errors.md) classifies it as an ArithmeticFault that stops the execution unit. Explicit checked conversion helpers provide recoverable error results.

Passing a correctly typed value needs no conversion. Implicit conversion from strings, booleans, or arbitrary foreign objects is not part of the numeric core.

## Integer arithmetic

Addition, subtraction, multiplication, and unary negation preserve operand type. Overflow is checked by default on every build mode. A known overflow is diagnosed during compilation; a dynamic overflow produces an arithmetic failure. The compiler removes checks only when it proves they unnecessary.

```kalandra
largest: uint8 = 255
overflow = largest + 1
```

This does not produce zero or undefined behavior. It is a known invalid operation and is rejected.

Wrapping arithmetic may be provided through explicitly named library operations, such as `wrappingAdd`, for algorithms that require modular arithmetic. It must not become the release-build meaning of ordinary `+`. Saturating arithmetic is another explicit library operation, not the default.

Integer division with `/` produces the same integer type and truncates toward zero:

```kalandra
whole = 5 / 2
fraction = 5.0 / 2.0
```

`whole` is int 2; `fraction` is float 2.5. Integer division by zero and signed minimum divided by -1 fail. A caller wanting fractional division converts explicitly or uses floating operands.

`%` is integer remainder, consistent with truncating division: `-5 % 2` is -1 and `5 % -2` is 1. The quotient/remainder identity holds where the division is defined. Remainder by zero fails; signed minimum remainder -1 is mathematically zero and must be implemented without invoking an overflowing division. A nonnegative modulo helper can be provided separately.

Division has one documented rule per operand family, with no hidden result-type promotion.

## Floating-point arithmetic

Float32 operations produce float32; float64 operations produce float64. Finite results round to the declared format. Values are not silently accumulated or evaluated with a different source-visible precision because another target permits it.

The baseline has strict floating-point semantics, including signed zero, infinities, and NaN. Floating-point division by zero follows IEEE behavior rather than the integer failure rule: positive finite divided by positive zero yields positive infinity; zero divided by zero yields NaN. Finite arithmetic overflow can produce infinity; the explicit literal/conversion checks above are separate entry-validation rules.

NaN is unequal to every value, including itself. Ordered comparisons involving NaN are false. Positive and negative zero compare equal. Finiteness checks belong to ordinary numeric library functions. Serialization/contracts must state their support for nonfinite values instead of silently replacing them with zero.

Do not reassociate floating-point expressions or contract multiply/add into a fused operation under the baseline if that changes rounding. An explicitly named fused operation can request that behavior. Fast-math requires a separate explicit policy stating which guarantees are relaxed; it is not an automatic consequence of a production build or GPU target.

This baseline requires evaluating hardware support for operations, subnormals, rounding, and precision. If a target cannot implement the promised behavior, diagnose the unsupported operation/target or offer an explicitly selected alternative policy. Do not silently substitute float32 for float64 or flush subnormal values without declaring that policy.

Reduction order is an execution-level numerical decision. A sequential reduction and a parallel tree reduction may yield different rounded results. The future reduction API must expose its reproducibility/tolerance contract; parallel scheduling cannot arbitrarily redefine a promised deterministic result.

## CPU, GPU, contracts, and native interfaces

Public signatures and tensor element types have fixed widths. Contract generation preserves signedness, width, and float format. A JavaScript client cannot losslessly represent all int64/uint64 values as JS Number; its generated representation must use an appropriate lossless type such as BigInt or an explicitly defined external encoding.

The compiler may use wider intermediates internally only when results, failures, and rounding remain equivalent to the specified operation. It cannot replace checked overflow with a different arithmetic model.

Tensor precision is explicit at the tensor boundary. CPU/GPU capability checks occur before dispatch where possible. The initial 64-bit scalar defaults are convenience choices, not a claim that every accelerator efficiently supports 64-bit arithmetic.

C ABI types are mapped using the target ABI. Do not equate C `int` or `long` with Kalandra's `int` alias merely because their names look similar. Native conversion and layout need explicit binding metadata.

## Examples to turn into conformance checks

1. Defaults are int64, uint64, and float64 on every supported target.
2. Literal typing works through annotations, parameters, and binary operations.
3. Integer endpoints, signed minimum parsing, and out-of-range literals are checked correctly.
4. Mixed typed operations require explicit conversions.
5. Conversion rounding, truncation, boundaries, NaN, and infinity follow the rules above.
6. Integer overflow/division checks remain effective in optimized builds.
7. Negative quotient/remainder cases and the signed-minimum edge cases are defined safely.
8. Float32 and float64 retain declared rounding behavior without unrequested reassociation or fusion.
9. Unsupported device precision/semantics are diagnosed.
10. Generated contracts preserve values that exceed JavaScript's exact Number range.

## Review and next step

The alias widths, checked arithmetic, division/remainder rules, literal typing, and conversion spelling are accepted. The [memory programming model](memory.md) is automatic and allocation strategy belongs to the compiler.

The [errors and effects design](errors.md) now accepts expected errors, inferred effects, and the execution-fault treatment for invalid ordinary checked operations. [Resources and task lifetimes](execution.md) are accepted. [Variants and error payloads](variants.md) are accepted. [Tensor types and shapes](tensors.md), including shape failures and reduction policies, are accepted. Review [placement and transfers](placement.md) next.

## Shared numeric descriptions in the native implementation

The native compiler now carries an explicit concrete numeric identity on scalar and tensor types. [NumericType.h](../../native/include/kalandra/NumericType.h) describes the ten accepted core types: signed and unsigned 8/16/32/64-bit integers, float32 and float64. The catalogue records canonical spelling, numeric family and fixed bit/byte width. `int`, `uint` and `float` resolve to the accepted 64-bit equivalents independently of host pointer size. These are internal compiler identities, not a serialized protocol or target ABI declaration.

**This is type infrastructure, not arithmetic support for all ten types.** The initial implementation restricted CPU/Apple GPU arithmetic to float32. Checked CPU int32 scalars are now qualified below; Apple GPU arithmetic remains float32-only. Int32 CPU scalar tasks and synchronous tensor literals/elementwise operations are qualified below. Recognizing a type's description does not enable its literals, conversions, operators, tensor kernels or runtime interfaces. The deferred int128/uint128, float16 and bfloat16 formats are not added to the core catalogue by this step.

Numeric identity now survives signatures, scalar/tensor operations, shape checks, calls, tasks, expected errors, branches and continuation slots. Type conformance and arithmetic/branch joins compare the concrete identity, rather than treating all numbers as the same type. IR inspection prints the concrete name; float32 program dumps remain unchanged. CPU lowering rejects unsupported numeric identities before constructing float32 MLIR or LLVM task layouts, including unsupported identities in a declared result, symbol or expression. The Metal supervisor and GPU closure admission retain explicit type capability checks.

Storage size and arithmetic capability are separate concerns. Checked byte counts use the concrete element width and an explicit maximum, rejecting overflow and invalid identities while supporting valid empty allocations. Semantic tensor allocation checks and the Metal storage bridge use these descriptions. The bridge's existing private float32, uint32 and uint8 formats map explicitly to numeric identities; uint32 storage does not imply integer shader or source-language support. Existing float32 memref descriptors and scalar result layouts retain their ABI and numerical behavior.

[Numeric type tests](../../native/tests/NumericTypeTests.cpp) cover aliases, unique identities, storage limits and overflow, empty sizes, invalid/deferred formats, typed task-plan metadata, private storage mapping and rejection of same-width uint32 IR at every CPU entry surface. They run in debug and ASan/UBSan variants alongside the complete CPU/Metal regression suite. [Qualification evidence](../../native/metal-proof/evidence/numeric-descriptions-2026-10-16.json) records the regression and numerical artifact comparisons.

The element-aware CPU runtime storage and adapters described below now cover retention, copying and scalar task layouts. Next, qualify an additional concrete source arithmetic type end to end. Integer overflow/conversion rules, floating-format rounding and strict GPU arithmetic still need per-type implementations and conformance evidence. Shared descriptions allow that work to reuse shape, ownership, scheduler and placement logic; they do not replace those arithmetic proofs. No distributed execution or protocol work is included.

## Element-aware CPU runtime storage and adapters

The native runtime now has `CpuTensor<Element, Rank>` descriptors and numeric scalar task layouts for all ten core types. [NumericStorage.h](../../native/runtime/NumericStorage.h) maps concrete language identities to fixed-width C++ storage and the host ABI's alignment. [Tensor.h](../../native/runtime/Tensor.h) defines ranked memref descriptors, checked retention and independent owned copies. This is storage/ABI infrastructure; the separate checked CPU int32 scalar increment below enables arithmetic only where it has been qualified.

The descriptor contains only the fields required by the MLIR memref ABI: allocated/aligned pointers, element offset, and ranked size/stride arrays. Its element type is carried by the C++ template and the separate adapter view. The float32 alias retains the existing descriptor layout, including the special rank-zero representation. Raw views default to an invalid element tag; typed descriptors supply the tag automatically. Views are trusted native adapters, not language-level casts or a dynamic foreign-object interface.

`retainCpuTensor` validates the numeric identity, dimensions, dense row-major strides, alignment, element-width-aware offset and complete allocation bounds against the source Invocation. It snapshots dimensions and retains an immutable allocation lease. The retained bytes remain readable after source metadata and invocation owners disappear. Empty tensors validate their type and dimensions but do not dereference or retain their descriptor addresses. A failed validation publishes no retained value.

Typed CPU copies require an exact element match before allocation. They compute canonical strides with overflow checks, copy bytes into independently owned invocation storage, and preserve the represented bits without numeric conversion. This includes floating NaN payloads and integer sign bits. Allocation failure and invalid rank/type/size leave no output allocation. Invalid or unsupported element types are never guessed from their byte width.

Scalar task layouts have distinct type identities, correct host alignment and fixed-width bit-copy functions. The float32 bridge uses the same canonical layout as the generic scalar factory and retains its existing private layout identity. The scheduler's exact layout check rejects reading a uint32 result as float32 even though both occupy four bytes. Retaining, completing, observing and cleaning up values still use the existing scheduler and ownership mechanisms.

The Metal bridge uses the common CPU validator and copy machinery. It maps only its existing float32, uint32 and uint8 storage formats, charges the complete retained allocation, and validates typed exports before allocation. `toCpu<Rank>` remains the float32 interface; private typed exports carry an explicit element. Other CPU formats are rejected by this bridge until their Metal storage support is qualified. Upload/download can preserve existing integer storage buffers, but this does not enable integer shaders or source arithmetic. Resident values still require explicit download.

[CPU storage tests](../../native/tests/CpuStorageTests.cpp) cover all ten types, descriptor layouts, zero/rank-zero tensors, offset/alignment/stride/bounds checks, capture/result lifetimes, allocation failures and scalar task results with 1/2/4 workers. [Metal adapter tests](../../native/metal/CpuStorageTests.cpp) cover typed float32/uint32/uint8 round trips, zero-copy leases, full-allocation charging, unsupported formats, missing tags, width mismatches and explicit residency. Both run in debug, optimized, ASan/UBSan and TSan builds. Existing compiled float32 interoperability and complete numerical/task lifecycle checks remain required. [Qualification evidence](../../native/metal-proof/evidence/cpu-storage-2026-10-16.json) records those checks.

Checked CPU int32 scalar arithmetic is now implemented below. Tensor arithmetic, additional types and explicit conversions require their own lowering and qualification before enabling their corresponding capability gates. The shared runtime storage does not authorize reusing floating-point instructions or float32 numerical proofs for integer computation. Distributed execution remains behind its separate design review.

## Checked CPU int32 scalar arithmetic

Explicit `int32` annotations now work on ordinary scalar parameters, results and immutable bindings:

```kalandra
fn increment(value: int32) -> int32:
  value + 1

fn main() -> int32:
  initial: int32 = 16777217
  increment(initial)
```

The executable prints `16777218` exactly. Integer function calls and CLI entries use integer registers and results; they never pass through float32. The existing float32 CLI and tensor ABI are preserved.

Contextual decimal integer literals cover `-2147483648` through `2147483647`. Signed minimum is parsed with its unary sign, without requiring the positive magnitude to fit int32 first. Out-of-range and fractional/exponent literals in an int32 context are rejected with S051. Unconstrained literals still have the accepted int64/float64 defaults, which remain unsupported by this subset; they do not silently default to int32. Typed int32 and float32 values cannot mix implicitly.

Unary `+`/`-` and binary `+`, `-`, `*`, `/`, `%` retain int32. The compiler diagnoses known invalid arithmetic in literal expressions and immutable constant bindings with S052, including a known zero divisor with a runtime numerator. It does not perform interprocedural constant evaluation. Operations on runtime values check overflow and division/remainder by zero in every build. An invalid operation records `ArithmeticFault` at its source span and returns through the existing checked invocation convention. It ends the current task rather than resuming the invalid operation, wrapping, or depending on debug assertions. A supervised child fault is exposed to its parent as TaskError.Fault at the task boundary, as described below.

MLIR lowering sign-extends int32 operands to int64, computes without overflowing that wider representation, checks the int32 result bounds, then narrows. Division/remainder check a zero divisor before execution. Widened intermediates implement the signed-minimum cases safely: `-2147483648 / -1` faults and `-2147483648 % -1` is zero. Negative quotient/remainder use truncation toward zero. Fault propagation stops dependent function calls and preserves the invocation cleanup path.

The initial scalar increment covered synchronous CPU scalars and ordinary functions. Int32 CPU task continuations are now qualified below. Int32 synchronous tensor literals and elementwise operations are now qualified below. Integer tensor task handoff is now qualified below. Integer reductions/matmul, Metal modules/kernels, conversions and other numeric arithmetic types remain unsupported and diagnosed. Type metadata and runtime storage availability do not imply those capabilities. Tensor and GPU arithmetic follow separate qualification. Distributed execution still requires the agreed design review.

[Int32 frontend tests](../../native/tests/Int32Tests.cpp) cover literal boundaries, immutable constants, context/default rules, type mismatches, typed calls and unsupported target paths. The frontend runs independently under ASan/UBSan so its container instrumentation is not mixed with the uninstrumented MLIR backend. [Runtime conformance tests](../../native/tests/Int32RuntimeTests.cpp) compare six operations against wider integer reference arithmetic over 10,361 boundary/random input pairs per operation in debug, optimized, ASan/UBSan and TSan builds. Generated wrappers forward through an ordinary function to verify fault propagation. CLI checks cover exact endpoints, values beyond float32 precision, arithmetic fault reporting, output preservation on static rejection and Metal rejection. [Qualification evidence](../../native/metal-proof/evidence/cpu-int32-2026-10-16.json) records the results and unchanged float32 numerical artifacts.

## Int32 CPU task captures and results

CPU `spawn`/`await` and structured parallel groups now support int32 scalar arguments and results, including independently scheduled nested helpers, direct calls, aliases and repeated awaits. Int32 and float32 parameters/results can coexist in a module and in one capture packet; this does not permit implicit arithmetic conversions. Either numeric type can be the scalar executable result.

```kalandra
fn increment(value: int32) -> int32:
  value + 1

fn main() -> int32 ! TaskError:
  try parallel:
    work = spawn increment(16777217)
    try await work
```

The compiler carries int32 through continuation slots, frame fields, capture packets, cached task results and the root entry. Generated result wrappers contain the existing failure header plus a typed payload. Their private int32 and float32 layout identities and copy functions are distinct even though the payload widths match. These generated wrappers are separate from the raw numeric scalar adapter layouts described above; neither is a distributed wire format.

Integer task arithmetic is lowered to synchronous numerical steps by the common continuation planner. Those steps use the existing checked int32 MLIR/LLVM lowering, including safe division/remainder and overflow checks. The task emitter does not implement another set of integer operators. Function-call overhead in this initial lowering is not a performance optimization claim. Existing scheduling, cancellation, ownership and group settlement remain shared with float32 tasks.

A fault stops the executing task and retains its original source location. At the supervised child boundary it becomes `TaskError.Fault` with `FaultKind.Arithmetic` and an arithmetic diagnostic message. An outer handler may inspect the settled group's error and continue with a new result; it cannot resume the failed operation. An uncaught supervised failure prints TaskError.Fault at the CLI boundary. An arithmetic fault in the coordinating task itself remains an ArithmeticFault. Allocation, native and admission errors keep their existing classification.

[Task conformance checks](../../native/cmake/VerifyInt32Tasks.cmake) run compiled programs in debug, optimized, ASan/UBSan and TSan modes with 1/2/4 workers. They cover signed endpoints, values above float32's exact precision, all six checked operations, negative quotient/remainder, signed-minimum remainder -1, mixed scalar packets/results, both numeric root types, nested scheduling, cached awaits, child faults and recovery, original source locations, sibling tensor ownership, parent data after failure, root allocation failure and invalid worker admission. [Fixtures](../../native/tests/fixtures/task-int32-scalars.kalandra) and [qualification evidence](../../native/metal-proof/evidence/cpu-int32-tasks-2026-10-16.json) accompany the full CPU/Metal regression.

CPU int32 tensor literals, elementwise operations and tensor task captures/results are now qualified below. Next: checked integer reductions. Integer reductions, matmul, GPU arithmetic, additional numeric families and conversions need their own follow-up checks. Distributed execution remains behind the agreed design review.

## Checked CPU int32 tensor literals and elementwise operations

Synchronous CPU functions now accept and return `Tensor[int32,...]`, with fixed or dynamic extents. Tensor literals type each leaf as int32, including signed minimum and exact values above float32 precision. Nested rectangular data and explicit constant flat-data shapes use the existing shape checks; rank-zero and empty tensors remain supported. An int32 tensor context is required, and float32 values are not implicitly converted into integer elements.

```kalandra
fn shift(values: Tensor[int32, ?], amount: int32) -> Tensor[int32, ?]:
  values + amount

fn example() -> Tensor[int32, 3]:
  values: Tensor[int32, 3] = tensor([16777217, -5, 9])
  shift(values, 1)
```

Unary `+`/`-` and elementwise `+`, `-`, `*`, `/`, `%` preserve int32. A scalar may appear on either side of an integer tensor operation. Two tensors require matching ranks and extents; this does not add broadcasting. Runtime shape guards run before element evaluation. Empty tensors evaluate no element operations, so an empty tensor divided by scalar zero produces an empty tensor rather than a division fault.

Each evaluated element uses the same checked int32 MLIR helpers as ordinary scalar arithmetic. Overflow, division/remainder by zero, and signed-minimum division are checked in every build. Signed-minimum remainder -1 is zero. A failure retains the operation's source span, stops the invocation through the checked ABI, and publishes no result. Invocation ownership settles any partially constructed buffers. Inputs remain immutable, including aliased operands and borrowed native descriptor views with offsets. Literal ranges and scalar constant expressions retain their compile-time checks; this increment does not introduce aggregate tensor constant folding or interprocedural evaluation.

Tensor element identity now reaches ranked tensor/memref types, literal construction, result allocation and private checked native interfaces. Byte-count checks remain valid for the two supported four-byte element formats. Integer reductions and matmul are rejected with S053 rather than reaching float32 algorithms; backend admission also checks their operand types. Integer tensor task captures/results are now qualified below with distinct element-aware layouts and retained ownership. GPU modules/kernels remain float32-only. This increment does not add indexing, conversions, a public foreign-memory API or a new tensor-valued CLI print format.

[Runtime conformance checks](../../native/tests/Int32TensorRuntimeTests.cpp) compare exact cells against independent wider integer arithmetic. The [compiled test driver](../../native/cmake/VerifyInt32Tensors.cmake) covers all binary operations with tensor/tensor and both scalar orders, unary operations, native input aliases/offsets, nontrivial ranked shapes, every empty dimension, dynamic-to-fixed shape refinement, signed endpoints, deterministic random inputs, late element faults, invalid dimensions/byte counts, allocation failure, unpublished fault results and balanced cleanup. Literal checks cover ranks zero through three. All run in debug, optimized, ASan/UBSan and TSan modes. [Frontend checks](../../native/tests/Int32Tests.cpp) also reject malformed literals, mixed element types, ragged/mismatched shapes, integer reductions/matmul and invalid private test exports. [Qualification evidence](../../native/metal-proof/evidence/cpu-int32-tensors-2026-10-16.json) records the complete CPU/Metal regression and numerical artifact comparison.

Typed int32 tensor task captures/results are now qualified below. Next: checked integer reductions; matmul and GPU integer arithmetic remain later increments. Distributed execution still requires its separate design review.

## Int32 tensor captures and results in CPU tasks

CPU workers now accept and return int32 tensors, including rank-zero values, empty tensors, nested coordinating helpers and mixed int32/float32 capture packets. Awaiting or returning a tensor retains its immutable backing through the existing invocation ownership machinery. Cached awaits can acquire independent owners of the same backing; buffers are not reconstructed through float32 or copied through a floating-point value representation.

```kalandra
fn shift(values: Tensor[int32, ?], amount: int32) -> Tensor[int32, ?]:
  values + amount

fn batch(values: Tensor[int32, ?]) -> Tensor[int32, ?] ! TaskError:
  try parallel:
    work = spawn shift(values, 1)
    try await work
```

Generated tensor result layouts now include numeric element identity and rank in their private keys/IDs. Int32 and float32 tensors therefore use distinct layout objects even when their memref descriptors have identical physical sizes. The scheduler's existing exact-layout check rejects mismatched observations before copying or retaining data. These compiler/runtime descriptors remain internal ABI metadata, not a distributed serialization format.

Capture construction, publication and observation reuse the existing retain/copy protocol. A successful handoff retains its dependencies before publishing the descriptor. The receiving invocation can keep the value after all workers, task frames, intermediate outcomes and the core itself have been destroyed. An independent immutable lease can then outlive the receiving invocation. A failed capture or observation publishes no tensor and follows the existing allocation/fault settlement path.

Integer tensor arithmetic still uses the checked synchronous MLIR lowering. A child arithmetic fault keeps its source span, becomes TaskError.Fault/FaultKind.Arithmetic at the supervision boundary and cancels/settles the affected group. Handlers can use the original parent tensor and start another group. Shape refinement and failure propagation avoid reading absent tensor payloads. Root/child allocation failures, quota admission rejection and explicit cancellation/deadline signals retain their existing classification. This step adds no new deadline timer or scheduling policy.

The compiler's existing private `--test-entry` option can now select a parameterless numeric function in a task module. It exports a const TaskEntry pointer, `kalandra_task_test_entry`, so native tests can drive the compiled code through TaskCore and inspect its wrapped result. This is a trusted test interface; arbitrary task inputs and a public foreign-memory API are not introduced. Ordinary executable main functions still return scalar int32 or float32; tensor CLI formatting is unchanged.

[Compiled ownership tests](../../native/tests/Int32TensorTaskTests.cpp) inspect exact returned cell bits, source faults, distinct same-width layouts and scheduler counters. They destroy every worker and task owner, then the receiving invocation, while checking the independently retained result. [Fixtures](../../native/tests/fixtures/task-int32-tensor-mixed.kalandra) and the [test driver](../../native/cmake/VerifyInt32TensorTasks.cmake) cover signed endpoints, values above float32 precision, rank-zero through rank-three results, empty tensors, mixed element families, nested/cached awaits, arithmetic recovery, runtime shape failure without an absent-payload read, twelve allocation-failure positions, byte-budget admission rejection and explicit cancellation/deadline settlement. They run with 1/2/4 workers in debug, optimized, ASan/UBSan and TSan variants. The optimized observer also links the existing optimized task core. [Qualification evidence](../../native/metal-proof/evidence/cpu-int32-tensor-tasks-2026-10-16.json) records the full CPU/Metal regression and unchanged numerical artifacts.

Next: checked CPU int32 `reduceSum`, including empty inputs, deterministic reduction order, overflow propagation and task integration. Integer matmul, additional numeric types, conversions and GPU integer arithmetic remain separate increments. Distributed execution still requires its agreed design review.
