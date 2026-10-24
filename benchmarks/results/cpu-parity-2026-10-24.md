# CPU tensor implementation comparison — 2026-10-24

## Benchmark methodology correction

These measurements compare Kalandra built-in tensor operations with handwritten reference implementations. Kalandra benefits from built-in fusion, tiling and SIMD; the other implementations materialize intermediate arrays and use different matrix kernels. Matching mathematical expressions and reduction order does not make these equivalent compiler workloads. These results do not establish general compiler performance parity with Rust/C++, or performance against optimized numerical libraries. The numerical validation remains valid; the language-level performance conclusion is withdrawn.

See the [benchmark methodology](../../docs/design/benchmark-methodology.md) for the replacement comparison requirements.

Host: Apple M2 Max, macOS 27.2. CPU kernels are single-threaded.

The historical 1.10× threshold was met against these reference implementations in all 12 cases. This does not qualify the requested Rust/C++ compiler-performance target; that target remains unestablished by this suite. Both profiles use hardware CPU arithmetic. The float64 profile explicitly enables software arithmetic only for unsupported Metal float64 operations.

Full reports: [float32](languages-optimized-float32-2026-10-24.md), [float64 with explicit GPU fallback](languages-optimized-float64-fallback-2026-10-24.md). Each report retains resident/transfer GPU timings and has adjacent raw JSON.

| Type | Case | Size | Kalandra CPU (µs) | C++ (µs) | Rust (µs) | Kalandra / faster baseline | Target |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| float32 | dot | 16384 | 3.82 | 5.82 | 11.17 | 0.656× | Pass |
| float32 | dot | 262144 | 54.82 | 80.63 | 166.71 | 0.680× | Pass |
| float32 | axpy | 16384 | 3.77 | 7.91 | 15.15 | 0.476× | Pass |
| float32 | axpy | 262144 | 55.59 | 104.41 | 224.61 | 0.532× | Pass |
| float32 | matrix | 48 | 22.79 | 55.77 | 126.99 | 0.409× | Pass |
| float32 | matrix | 96 | 172.56 | 387.26 | 890.53 | 0.446× | Pass |
| float64 | dot | 16384 | 5.53 | 8.60 | 13.80 | 0.643× | Pass |
| float64 | dot | 262144 | 90.26 | 128.47 | 207.59 | 0.703× | Pass |
| float64 | axpy | 16384 | 5.53 | 11.54 | 19.35 | 0.479× | Pass |
| float64 | axpy | 262144 | 90.06 | 172.83 | 286.22 | 0.521× | Pass |
| float64 | matrix | 48 | 42.12 | 70.19 | 124.11 | 0.600× | Pass |
| float64 | matrix | 96 | 346.76 | 459.26 | 888.08 | 0.755× | Pass |

Kalandra’s built-in tensor implementations measured 24.5–59.1% lower latency than these particular handwritten reference implementations. This is an implementation comparison, not evidence that Kalandra generally compiles programs faster than Rust or C++.

Each timing is the median of three fresh-process medians, each with seven measured batches after two warmups. Every batch checksum and the singleton/odd-size controls passed. Compiler and source fingerprints, commands, runtime boundaries and all samples are retained in the raw reports. Comparator implementations, tool versions and sampling protocol are unchanged from the preceding hardware-policy runs.

Compiler changes: bounded polling between vectorizable chunks, pure map/first-level reduction fusion with half-sized scratch, a checked contiguous-input path with general strided fallback, simpler row-major indexing, and SIMD float64 matrix lowering. Separate products/additions and the adjacent-pair tree remain intact.

The complete native build passed. Across the broad regression run and targeted reruns, 144 distinct native tests passed; the new optimization test covers 32 type/kernel/build combinations plus higher-rank and long-expression controls. All 39 extracted documentation blocks passed verification. Cancellation tests now synchronize sender startup and keep the sender active until its chosen poll point; their publication and cleanup assertions remain unchanged.

These are equivalent straightforward kernel implementations, not optimized BLAS libraries or language-wide rankings. Kalandra’s compiler removes intermediate tensors that the comparator implementations materialize. GPU dispatch/transfers continue to dominate several of these small workloads. No machine isolation, affinity, or frequency control was applied.
