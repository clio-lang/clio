# Bottleneck investigation — 2026-10-24

The source-level and numerical benchmarks have different bottlenecks. On this M2 Max, recursive source workloads are dominated by checked call admission and its optimization barriers; CPU matrices spend their time in scratch-based matrix reduction; large GPU matrices spend nearly all wall time executing on the device; smaller GPU vector tasks have substantial host/driver/completion latency.

## Recursive source programs: call admission dominates

Four-second macOS `sample` captures identify `Invocation::enterCall`, `pthread_self`, `pthread_get_stackaddr_np`, `pthread_get_stacksize_np`, poll and leave helpers as major leaf-frame samples. Every admitted recursive call performs depth/cancellation checks and re-queries physical thread stack boundaries. The depth-14 binary traversal alone enters 32,767 source calls; each entry makes two `pthread_self` calls and two stack-bound queries. GCD adds its own recursive calls.

Isolated diagnostic copies retain the same benchmark harness, input, hardware arithmetic and exact checksums. Three fresh processes, two warmups and five measured batches per process; median of process medians, 50 ms target. These ablations are **not production optimizations**: removing guards disables required cancellation/stack protection and permits optimizations unavailable across external guard calls. The differences are not additive exclusive cost attribution.

| Diagnostic, 16,384 leaves | Polynomial µs | Branches µs | GCD µs |
| --- | ---: | ---: | ---: |
| Unchanged Kalandra | 399.890 | 435.349 | 2250.831 |
| Only remove per-call macOS stack queries | 166.008 | 179.160 | 1186.227 |
| Only simplify int64→float64 admission | 403.428 | 428.357 | 2220.558 |
| Remove enter/leave/post-call poll guards | 41.460 | 53.412 | 210.394 |
| Remove guards and simplify conversion admission | 41.814 | 53.388 | 209.842 |
| Above, also permit function inlining | 42.173 | 55.313 | 134.403 |

Removing just stack-bound queries cuts polynomial/branch time by about 58–59% and GCD by 47%. Removing call guards drops polynomial from 400 to 41 µs and GCD from 2,251 to 210 µs. Permitting inlining in the guard-free diagnostic reduces GCD further to 134 µs; the fair C++ GCD reference was 122 µs. Polynomial is already close to its fair C++ 40 µs reference in the guard-free diagnostic. This locates a large recoverable compiler/runtime cost; it does not demonstrate a safe production fix or qualify performance parity.

The initially suspicious 128-bit integer-to-float admission sequence in emitted LLVM is **not a material measured bottleneck here**. Final Clang code generation eliminates it: the actual polynomial leaf contains hardware `scvtf`, `fadd` and `fmul`. Simplifying its admission alone does not materially improve these timings. Inspecting intermediate IR alone would have led to the wrong conclusion.

Likely safe work: discover stack metadata at a proven thread/worker boundary instead of querying it on every call, preserve a current-stack reserve check and call-depth limit, inline fast status/cancellation checks with cold fault paths, and permit inlining where stack accounting remains valid. Context migration and cancellation behavior must stay covered by tests. A thread-aware cache/hoist requires proof for every supported entry path; deleting checks is not the proposed fix.

## CPU matrices: reduction scratch traffic and kernel structure

3,347 of 3,376 top-frame samples (99.1%) are inside `kalandra_fn_matmul_wide_0`. Allocator and invocation helpers do not dominate this profile. Sampled PCs include the vector reduction loop: repeated SIMD loads, pairwise `fadd`, stores back to scratch, and loop control. The generated backend computes product blocks into scratch, then repeatedly reads/reduces/writes those products. Operand reuse and SIMD exist, but the arithmetic tree is still materialized in memory.

| Float32 1024² matrix+sum diagnostic | Wall ms |
| --- | ---: |
| Unchanged | 207.530 |
| Remove loop polling only | 208.175 |

Eliminating loop polling does not improve matrix throughput. The next target is a register-resident microkernel that preserves the specified adjacent-pair reduction tree while avoiding product/reduction scratch traffic, followed by cache/blocking work. These samples identify the kernel and its hot instructions; they do not distinguish cache-level bandwidth limits from instruction throughput without hardware counters.

Accelerate is a different optimized numerical API and can choose a different arithmetic tree/FMA/internal hardware path. Its speed does not prove that the entire gap can be closed while preserving Kalandra’s current exact reduction contract. Do not silently change that contract or call a relaxed library implementation a strict-codegen optimization.

## GPU: large matrices versus vectors

Opt-in command-buffer timestamps and host encoding counters, three processes, two warmups and five measured batches. Values below are medians of process medians per operation. These instrumented diagnostic timings are separate from the uninstrumented fair-suite acceptance results. Device durations include the whole composed command buffer, not an individual shader counter.

| Float32 workload | Input mode | Wall ms | Device ms | Host encoding ms | Submissions | Dispatches |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Dot 4,194,304 | Resident | 0.8882 | 0.2385 | 0.0295 | 1 | 5 |
| Dot 4,194,304 | With uploads | 5.4901 | 0.5428 | 2.5728 | 3 | 5 |
| AXPY+sum 4,194,304 | Resident | 0.8871 | 0.2402 | 0.0293 | 1 | 5 |
| AXPY+sum 4,194,304 | With uploads | 5.4083 | 0.5309 | 2.5660 | 3 | 5 |
| Matrix+sum 512² | Resident | 1.4129 | 1.0840 | 0.0265 | 1 | 4 |
| Matrix+sum 512² | With uploads | 1.9644 | 1.0028 | 0.2286 | 3 | 4 |
| Matrix+sum 1024² | Resident | 10.4674 | 10.0645 | 0.0446 | 1 | 4 |
| Matrix+sum 1024² | With uploads | 11.8589 | 10.0745 | 0.7352 | 3 | 4 |

For resident 1024² matrices, device execution is about 96% of wall time. Eliminating all non-device time would save only about 0.4 ms; it cannot close the roughly 10× gap to Accelerate AUTO. The selected generic 8×8 Metal tile computes one output per lane, uses explicit separately rounded products and pairwise sums, maintains a per-thread reduction stack, and performs two threadgroup barriers for every eight contraction elements (256 barriers for k=1024). It uses neither matrix intrinsics nor FMA. These are concrete kernel constraints and optimization candidates; no GPU occupancy/register-spill counters were collected, so register spilling is not a confirmed diagnosis. The 512² case uses the existing quad profile instead.

For resident 4M vectors, the device takes about 0.24 ms while the complete call takes about 0.89 ms. There is already just one submission per task. Larger fused graphs, buffer reuse, batching and less frequent scalar readback/completion boundaries are more relevant here than another submission-count reduction. A separate host sample has 1,559 of 2,279 controller-thread samples inside `TaskCore::drain` waiting on completion, and also shows Metal resource creation/driver calls. That wait includes real GPU/queue execution; it does not prove all remaining latency belongs to our scheduler.

Fresh uploads raise vector wall time to about 5.4–5.5 ms; host encoding/allocation/staging and transfer/completion work are significant. Keeping tensors resident is essential for these short kernels. Host encoding and device timestamps are different intervals that may overlap; subtracting their medians is not an exact decomposition. GPU binary64 remains an explicit software fallback and is not the hardware float32 optimization target.

## Priority

1. Make checked source calls cheap without weakening stack/cancellation semantics; this is the clearest cause of the scalar compiler gap.
2. Replace memory-materialized strict matrix reductions with a register-resident implementation on CPU, then improve Metal matrix tile/register use while retaining arithmetic conformance.
3. Reduce vector task/readback granularity and temporary resource churn; benchmark complete resident graphs and transfer-inclusive execution separately.

No production compiler/runtime safety or numerical semantics were changed by this investigation. Diagnostic variants pass exact checksums on the recorded benchmark inputs; they deliberately do not claim general semantic conformance.

## Evidence and reproduction

- [Raw diagnostic measurements, commands and artifact hashes](bottlenecks-2026-10-24.json).
- [Sample call graphs and GPU-vector sample outputs](bottleneck-samples-2026-10-24.json); binary-image inventories omitted from saved text.
- [Diagnostic runner](../../native/benchmarks/bottlenecks.py); requires artifacts from the [fair suite](../../native/benchmarks/fair/README.md).
- [Uninstrumented fair comparison](fair-benchmarks-2026-10-24.md).

Run `python3 native/benchmarks/bottlenecks.py --output <unused-path.json>` on the same Mac. Sample commands are `sample BENCHMARK_PID 4 -file <path>` while running `kalandra-euclid 2 14 1000 1 17`, `kalandra-polynomial 0 14 6000 1 17`, or float32 `kalandra-matrix 2 1024 12 1` from the ignored fair build. The vector sample command is retained with its outputs in the sample JSON. Inspect generated matrix/polynomial instructions with `llvm-objdump --disassemble-symbols=_kalandra_fn_matmul_wide_0 <matrix-binary>` and `--disassemble-symbols=_kalandra_fn_1 <polynomial-binary>`. All scratch IR/runtime variants stay under ignored `benchmarks/.build/bottlenecks`.
