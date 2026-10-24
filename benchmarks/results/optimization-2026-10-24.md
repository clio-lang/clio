# Checked calls and matrix optimization — 2026-10-24

Following the [fair benchmark](fair-benchmarks-2026-10-24.md) and [bottleneck investigation](bottlenecks-2026-10-24.md), this change reduces checked-call overhead, matrix reduction scratch traffic and Metal synchronization. Arithmetic, stack protection, logical call depth and cancellation remain enabled. This report retains the remaining gaps and does not claim the within-10% Rust/C++ compiler target has been met.

Apple M2 Max, macOS 27.2; three fresh measured processes per case, two warmups and seven measured batches, deterministic shuffled order and median of process medians. Builds, conformance and regression runs finished before final performance measurement. CPU source/numerical suites and controls ran sequentially. CPU affinity, frequency and unrelated host activity were not controlled. Before figures are the retained earlier fair run on the same host; both reports retain process medians and hashes.

## Equivalent source algorithms

The same recursive binary traversal and leaves run in Kalandra, C++, Rust, Go and Python. No tensor built-ins, closed-form replacement, changed arithmetic or numerical library is substituted. Kalandra retains its safety semantics; other languages retain normal compiler/runtime optimizations. These are narrow source/control-flow workloads, not a language-wide ranking. GPU general recursion remains unsupported.

| 16,384 leaves | Kalandra before µs | Kalandra after µs | Speedup | C++ after µs | Rust after µs | Go after µs | Python after µs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Polynomial | 398.228 | 121.598 | 3.27× | 38.241 | 40.800 | 34.217 | 2055.505 |
| Branches | 437.097 | 120.591 | 3.62× | 48.739 | 48.867 | 51.757 | 2358.321 |
| Euclid | 2251.964 | 900.626 | 2.50× | 118.606 | 155.040 | 157.436 | 6921.656 |

[All 30 source cases](fair-source-optimized-2026-10-24.md) · [raw source evidence](fair-source-optimized-2026-10-24.json).

## Complete numerical tasks

Packing, allocation/dispatch, normal cleanup and scalar completion/readback are included. Initialization/library loading are excluded. Each task has Kalandra CPU, resident GPU and upload-inclusive GPU results. CPU Kalandra uses one thread; OpenBLAS is queried at 1/12 threads and Accelerate at SINGLE/AUTO. Wrappers share the same OpenBLAS kernel and do not represent independent language implementations. Library reduction order/FMA can differ from Kalandra’s exact tree.

| Task / backend | Before ms | After ms | Speedup |
| --- | ---: | ---: | ---: |
| Float32 dot 4M, CPU | 0.9639 | 0.9713 | 0.99× |
| Float32 dot 4M, resident Metal | 1.1196 | 0.9040 | 1.24× |
| Float32 dot 4M, Metal with uploads | 5.5778 | 5.3483 | 1.04× |
| Float32 AXPY+sum 4M, CPU | 0.9644 | 0.9831 | 0.98× |
| Float32 AXPY+sum 4M, resident Metal | 0.9056 | 0.9059 | 1.00× |
| Float32 AXPY+sum 4M, Metal with uploads | 5.1536 | 5.5672 | 0.93× |
| Float32 matrix+sum 256², CPU | 3.2933 | 0.9440 | 3.49× |
| Float32 matrix+sum 256², resident Metal | 0.4655 | 0.3514 | 1.32× |
| Float32 matrix+sum 256², Metal with uploads | 0.9359 | 0.7036 | 1.33× |
| Float32 matrix+sum 512², CPU | 26.7679 | 7.2263 | 3.70× |
| Float32 matrix+sum 512², resident Metal | 1.2765 | 1.2709 | 1.00× |
| Float32 matrix+sum 512², Metal with uploads | 1.8871 | 1.8896 | 1.00× |
| Float32 matrix+sum 1024², CPU | 205.3793 | 57.2752 | 3.59× |
| Float32 matrix+sum 1024², resident Metal | 10.4237 | 2.5121 | 4.15× |
| Float32 matrix+sum 1024², Metal with uploads | 11.8582 | 3.8550 | 3.08× |
| Float64 dot 4M, CPU | 1.7116 | 1.6487 | 1.04× |
| Float64 dot 4M, resident Metal | 2.6418 | 2.7215 | 0.97× |
| Float64 dot 4M, Metal with uploads | 12.5372 | 11.6423 | 1.08× |
| Float64 AXPY+sum 4M, CPU | 1.6589 | 1.6564 | 1.00× |
| Float64 AXPY+sum 4M, resident Metal | 2.7497 | 2.7948 | 0.98× |
| Float64 AXPY+sum 4M, Metal with uploads | 12.6902 | 11.9177 | 1.06× |
| Float64 matrix+sum 512², CPU | 54.2402 | 16.2143 | 3.35× |
| Float64 matrix+sum 512², resident Metal | 21.2400 | 21.1713 | 1.00× |
| Float64 matrix+sum 512², Metal with uploads | 22.0434 | 22.0469 | 1.00× |

Float64 Metal is explicitly software fallback; float32 Metal and both CPU floating widths use hardware. Ratios below one are retained regressions, not omitted. Small differences must be interpreted with the raw process variability. No new vector kernel was introduced; vector timing changes are retained without attributing a causal speedup to this matrix optimization.

| Float32 1024² matrix+sum comparison | Thread / residency | After ms |
| --- | --- | ---: |
| Kalandra CPU | 1 | 57.2752 |
| Kalandra Metal | resident | 2.5121 |
| Kalandra Metal | with uploads | 3.8550 |
| C++/OpenBLAS | 1 | 22.1455 |
| C++/OpenBLAS | 12 | 4.5531 |
| C++/Accelerate | SINGLE | 1.7783 |
| C++/Accelerate | AUTO | 0.9251 |

[All 195 numerical cases and backends](fair-libraries-optimized-2026-10-24.md) · [raw numerical evidence](fair-libraries-optimized-2026-10-24.json).

## Checked cancellation control and device counters

A separate matched Kalandra control binds a non-cancelled atomic token to each invocation. Binding and acquire-load checks are timed. Correctness tests separately cancel this fast token path; no diagnostic poll counter is enabled in this performance control. It is not a cross-language ranking. Three fresh processes, two warmups and five measured batches per process.

| 16,384 leaves | No bound token µs | Bound token µs |
| --- | ---: | ---: |
| polynomial | 123.727 | 124.817 |
| branches | 123.756 | 125.313 |
| euclid | 910.745 | 964.088 |

GPU counters below are separate instrumented runs; device time covers the composed command buffer, not an isolated shader. Host encoding and device intervals can overlap and are not an exact additive decomposition.

| Float32 resident task | Wall ms | Device ms | Encoding ms | Submissions | Dispatches |
| --- | ---: | ---: | ---: | ---: | ---: |
| Dot 4M | 0.9102 | 0.2470 | 0.0279 | 1 | 5 |
| AXPY+sum 4M | 0.9082 | 0.2477 | 0.0277 | 1 | 5 |
| Matrix+sum 512² | 1.2717 | 0.9932 | 0.0268 | 1 | 4 |
| Matrix+sum 1024² | 2.5226 | 2.1592 | 0.0306 | 1 | 4 |

[Raw matched controls and GPU counters](optimization-controls-2026-10-24.json).

## Implementation and correctness

- Checked enter/leave/status fast paths are inlined. Clear calls and cancellation-bound calls have distinct fast paths; observers, faults and settlement preserve ordinary polling. Stack bounds are cached per physical pthread and leased only for a synchronous generated call chain, with a current-stack check at every entry. Leases unwind at their own logical entry depth, including when a host admission remains active. [Design and invariants](../../docs/design/checked-call-optimization.md).
- CPU matrix kernels compute sixteen-leaf subtrees in registers, reduce their roots in the original adjacent-pair order, and retain exact unpadded tails. Float32 uses 2×8 output tiles and float64 1×8. Large unit-column-stride inputs pack full eight-column RHS panels once; offsets, dynamic/reversed row strides and trailing columns retain descriptor semantics. Column-strided inputs retain a fallback. Packing costs are included.
- Generic hardware float32 Metal matrices use full 32-element contraction blocks where admitted, with two barriers per 32 elements instead of eight. Other contraction tails retain the eight-element implementation, and the existing quad profile is retained. No FMA or reassociation was enabled.
- Checked-call tests passed in debug, optimized, ASan/UBSan and TSan builds, including immediate/asynchronous cancellation, probe counters, fault priority, settlement, call limits, balanced unwinding, worker migration with existing manual depth and bounded native stacks.
- The expanded CPU suite passed 40 kernel/type/build variants plus higher-rank controls, with per-cell exact trees, exceptional values, stride/tile/panel edges, reversed rows, packed-operation allocation failures and cancellation. The actual benchmark matrices additionally passed **1,703,936 independent per-cell integer checks**, with immutable inputs and complete cleanup.
- Metal qualification passed **1,124 cases and 1,433,539 exact output comparisons per build variant**, including APFloat/FTZ cases and every cell of the benchmark matrices through 1024². All four runtime variants passed.
- All 450 independent numerical-library qualification workloads passed. Source edge workloads and every warmup/measured batch in both final fair suites were checked. Five benchmark-evidence integrity tests passed.
- The full native build completed, and the 189-case ownership/recursion/worker/numerical regression selection passed across the initial run and corrected-fixture reruns. Fourteen legacy negative fixtures had used now-supported TaskError capture as an unsafe example; the unchanged frontend accepted them without code generation. They now use genuinely unproven callback captures with the same required rejection codes. All 56 rejection/build-mode controls preserve existing artifacts; all 12 positive TaskError capture/worker/sanitizer controls pass. [Fixture audit](optimization-fixture-audit-2026-10-24.json).
- [Actual matrix frame audit](optimization-stack-audit-2026-10-24.json): all eight observed debug/optimized/sanitizer matrix leaf frames are below 16 KiB (maximum 7,440 bytes), with the 128 KiB runtime reserve retained. This is evidence for the recorded ARM64 build, not a platform-wide machine-code proof.

[Validation transcripts](optimization-validation-2026-10-24.json). Historical guard-elision diagnostics remain explicitly unsafe sensitivity experiments; no production guard was deleted.

## Remaining work

The remaining compiler gap is visible in the source table, especially GCD: 900.6 µs versus C++ 118.6 µs and Rust 155.0 µs. Checked tail-call lowering is a concrete next target; the recursive Kalandra path retains admission and unwind work while the comparators can turn GCD recursion into a loop. Further progress needs proof-based reduction of redundant checked-call work while retaining logical depth, cancellation and stack bounds. Matrix code still has a stricter arithmetic contract than numerical libraries; replacing it with an FMA/reassociated library kernel would require an explicit different numerical policy. GPU vectors still pay host/resource/completion costs and input uploads; larger resident graphs and fewer scalar boundaries are the next application-level throughput target.

Reproduce with the [fair benchmark guide](../../native/benchmarks/fair/README.md), using fresh output paths. After the source and numerical suites, run `python3 native/benchmarks/optimization_controls.py --output <unused.json>`. Qualification here is on the recorded M2 Max/macOS host; Linux and Windows execution was not rerun in this local session. The repository remains on `native`; work is uncommitted.
