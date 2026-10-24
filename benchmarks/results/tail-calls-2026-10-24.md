# Scalar tail calls, cancellation and total casts — 2026-10-24

This pass optimizes checked scalar self-tail recursion and removes redundant admission IR around total hardware casts. The source algorithms and arithmetic policy are unchanged. The Rust/C++ 10% target remains unmet; these are narrow workload results, with all losses retained.

## Equivalent source algorithms

Apple M2 Max / macOS 27.2. Three fresh processes per cell, two warmups, seven measured batches, median of process medians. Invocation lifecycle, ordinary checked arithmetic and admission remain timed. All 180 edge/reference workloads and every warmup/measured checksum match independent integer/Fraction/GCD references. No tensor built-ins or numerical-library calls occur in these algorithms. Each comparator uses its normal optimizing compiler.

| Case | Leaves | K before µs | K final µs | Before/final | C++ µs | Rust µs | Go µs | Python µs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| polynomial | 1,024 | 7.664 | 7.912 | 0.97× | 2.453 | 2.641 | 2.219 | 129.388 |
| polynomial | 16,384 | 121.598 | 126.879 | 0.96× | 38.623 | 41.804 | 34.924 | 2086.266 |
| branches | 1,024 | 7.620 | 7.781 | 0.98× | 3.087 | 3.090 | 3.308 | 146.718 |
| branches | 16,384 | 120.591 | 125.092 | 0.96× | 49.135 | 49.509 | 53.104 | 2420.692 |
| Euclid/GCD | 1,024 | 55.793 | 31.395 | 1.78× | 7.452 | 8.898 | 9.767 | 438.238 |
| Euclid/GCD | 16,384 | 900.626 | 538.946 | 1.67× | 124.446 | 167.341 | 166.362 | 7002.500 |

Ratios below one are recorded regressions. Small changes in polynomial/branches are not attributed to the cast change: their machine work is still dominated by ordinary checked recursive traversal. Separate runs have clock/load variation; the raw process medians are retained.

[Final source samples, commands and hashes](fair-source-tail-versioned-2026-10-24.json), [complete source report](fair-source-tail-versioned-2026-10-24.md), [previous baseline](fair-source-optimized-2026-10-24.md).

## Cancellation-token control

The same final LLVM and runtime are exercised with an unbound invocation and a normally bound, non-cancelled atomic token. Binding and acquire checks are included; correctness tests independently request cancellation. These controls use three fresh processes and five measured batches per cell.

| Case, 16,384 leaves | Unbound µs | Bound token µs |
| --- | ---: | ---: |
| polynomial | 123.287 | 124.292 |
| branches | 122.382 | 125.711 |
| euclid | 520.577 | 822.885 |

The previous token-bound GCD control was 964.088 µs; the final control is 822.885 µs (1.17×). The gain is smaller with a token because return-time acquire polls remain active. [Final matched control evidence](tail-versioned-controls-2026-10-24.json).

## Intermediate measurements

The first tail loop improved GCD, then assembly inspection found a Darwin TLS resolver hoisted from the observed admission path into the hot loop. An internal noinline admission shim isolates it. Extending the SSA-depth proof to token-bound calls introduced invariant branches; LLVM loop specialization now moves those choices outside the loop when the resulting body still fits its stack budget.

| Source GCD, 16,384 leaves | µs |
| --- | ---: |
| [Before this pass](fair-source-optimized-2026-10-24.json) | 900.626 |
| [Initial tail loop](fair-source-tail-calls-2026-10-24.json) | 562.352 |
| [Outlined admission](fair-source-tail-admission-2026-10-24.json) | 522.011 |
| [Shared token-aware loop](fair-source-tail-tokens-2026-10-24.json) | 624.187 |
| [Final specialized loop](fair-source-tail-versioned-2026-10-24.json) | 538.946 |

The intermediate [outlined control](tail-call-controls-2026-10-24.json) and [shared-token control](tail-token-controls-2026-10-24.json) retain the tradeoffs that motivated specialization. The conversion change emits direct hardware casts with constant valid admission for all 16 integer-to-float pairs and float32 widening. Those inputs cannot overflow either destination format. This removes redundant integer IR around an already-hardware operation; no isolated cast runtime-speed claim is made. Float narrowing, float-to-integer, integer range checks and explicit software conversion remain unchanged.

## Language and safety qualification

- Eligibility follows scalar types and IR/effect proofs. Tail results must be returned unchanged; frame-local storage, pointer/aggregate arguments, large signatures and bodies near the stack budget retain their existing paths. Mixed tail/non-tail recursion and helper calls retain ordinary admission where required.
- Logical depth is still bounded at 128. Pure bodies can keep depth in SSA under exclusive invocation ownership; token-bound admission performs an acquire load before every depth check. Observed execution retains ordinary polling. Each admitted slot is released, and token-bound return polls remain explicit. Existing faults keep priority; denied admission acquires no slot.
- Every original arithmetic operation and checked failure remains. No FMA/reassociation, width change, numerical-library substitution or software-policy weakening was added.
- Specialization runs on a private clone. It replaces the original body only after the unchanged 16 KiB conservative budget passes; a larger candidate is discarded. Function identity, signature and linkage remain stable.
- **244,752 differential/reference cases** across hardware/software policies and debug/O2/ASan+UBSan/TSan. All 40 baseline/current output-digest pairs match, including status/location, observed polls and final logical depth. Tests cover cancellation, exhausted depth, settled contexts, helper/mixed recursion, worker-stack migration, low stacks, signed zero, NaNs, retained tensors and eligibility fallbacks.
- **1,389,332 scalar APFloat cases** across all 17 total casts and four build modes, including exhaustive 8/16-bit inputs and deterministic wider boundary/random patterns. Hardware NaN widening preserves NaN as a value; payload preservation is outside its existing contract.
- **225,440 tensor APFloat lane comparisons** across representative cast families, ranks 0–3 and all four build modes. This count includes retained-output rechecks after settlement. Strided inputs, empty shapes, invalid metadata, allocation failure and immediate/active cancellation pass.
- **90 existing regression groups passed** on the final compiler, including recursion/continuations/workers, captured callables, records/strings/collections, checked conversions, stack outlining, CPU numerical optimization, every timed CPU matrix cell, real Metal numerical optimization and arithmetic policies.
- GCD and the internal admission shim have a maximum audited fixed frame of **464 bytes** across 16 function/build/policy combinations. The existing 128 KiB reserve and 16 KiB budget remain in force.

[Qualification evidence and full regression output](tail-call-validation-2026-10-24.json), [machine-stack audit](tail-call-stack-audit-2026-10-24.json), [implementation invariants](../../docs/design/checked-call-optimization.md).

## Remaining work

Final source GCD is 4.33× the contemporaneous C++ time and 3.22× Rust. General checked recursive traversal remains expensive, and token-bound return bookkeeping is visible. The next targets are budgeted checked-call inlining and proof-based reduction of return bookkeeping while preserving acquire observations, depth and fault priority. These results do not qualify general compiler parity.

This pass changes CPU source/runtime lowering. Metal numerical correctness was rerun; GPU performance measurements remain in the [previous matrix/GPU report](optimization-2026-10-24.md). Linux and Windows execution were not rerun locally. Changes remain uncommitted on `native`.

## Reproduce

Use unused output paths:

```sh
ctest --test-dir build/native --output-on-failure -R "native-(tail-calls|tail-calls-software|total-hardware-casts|fast-calls)$"
python3 native/benchmarks/fair/source_run.py --output /tmp/fair-source-new.json
python3 native/benchmarks/optimization_controls.py --cpu-only --output /tmp/source-token-control-new.json
```

The frozen pre-pass compiler is optional for rerunning `TailCallTests.py --baseline <path>`; ordinary CTest runs retain independent reference and safety assertions without that binary. See the [fair suite guide](../../native/benchmarks/fair/README.md) for pinned host/toolchain prerequisites.
