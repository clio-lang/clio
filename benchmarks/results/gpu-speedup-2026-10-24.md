# GPU speedup qualification — 2026-10-24

## Benchmark methodology correction

These measurements compare Kalandra built-in tensor operations with handwritten reference implementations. Kalandra benefits from built-in fusion, tiling and SIMD; the other implementations materialize intermediate arrays and use different matrix kernels. Matching mathematical expressions and reduction order does not make these equivalent compiler workloads. These results do not establish general compiler performance parity with Rust/C++, or performance against optimized numerical libraries. The numerical validation remains valid; the language-level performance conclusion is withdrawn.

See the [benchmark methodology](../../docs/design/benchmark-methodology.md) for the replacement comparison requirements.

Hardware float32 on Apple M2 Max, macOS 27.2. The GPU demonstrates real speedups over Kalandra’s own optimized single-threaded CPU tensor implementation: about 20× for the larger resident matrices, 13–18× for those matrices including uploads, and 1.29–1.31× for resident 16.8-million-element vectors. Transfer-heavy vector workloads still favor CPU.

All results below come from uninstrumented full runs: three fresh processes per cell, two warmup batches and seven measured batches per process, with a nominal 75 ms batch target. Values are medians of process medians. CPU and GPU compute identical source expressions with separately rounded products and the same adjacent-pair reduction tree.

| Program | Size | CPU (ms) | GPU resident (ms) | CPU / resident | GPU with uploads (ms) | CPU / with uploads |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| dot | 262,144 | 0.055 | 0.257 | 0.21× | 0.917 | 0.06× |
| dot | 1,048,576 | 0.222 | 0.394 | 0.56× | 1.714 | 0.13× |
| dot | 4,194,304 | 0.981 | 0.967 | 1.01× | 5.640 | 0.17× |
| dot | 16,777,216 | 3.979 | 3.095 | 1.29× | 20.475 | 0.19× |
| axpy + sum | 262,144 | 0.055 | 0.256 | 0.22× | 0.872 | 0.06× |
| axpy + sum | 1,048,576 | 0.228 | 0.362 | 0.63× | 1.730 | 0.13× |
| axpy + sum | 4,194,304 | 0.986 | 0.894 | 1.10× | 5.178 | 0.19× |
| axpy + sum | 16,777,216 | 3.987 | 3.046 | 1.31× | 20.244 | 0.20× |
| matrix + sum | 128 | 0.411 | 0.280 | 1.47× | 0.604 | 0.68× |
| matrix + sum | 256 | 3.299 | 0.481 | 6.86× | 0.906 | 3.64× |
| matrix + sum | 512 | 26.199 | 1.263 | 20.75× | 2.023 | 12.95× |
| matrix + sum | 1,024 | 209.653 | 10.467 | 20.03× | 11.776 | 17.80× |

A ratio above 1 means GPU is faster. Resident timings include dispatch, allocation, synchronization, scalar readback, task retirement and cleanup. The upload column additionally includes both input uploads and device-buffer retirement. Both exclude compilation, shader/pipeline loading, process startup and input initialization. Large vector runs explicitly raise the runtime memory budget to fit their input snapshots and workspace.

The two acceptance runs contain 72 cells and 216 fresh measured processes across Kalandra CPU, both GPU modes, C++, Go and Rust: 1,512 measured batches and 432 warmups, all checked against independent exact integer references. Python is omitted from the scaling suite because the largest interpreted cubic matrix cases exceed the process timeout.

Full comparison reports and raw JSON: [scaling](gpu-scaling-optimized-2026-10-24.md), [16.8-million-element vectors](gpu-vector-crossover-2026-10-24.md). Source, compiler and artifact hashes, commands, hardware metadata, per-process medians and every measured/warmup sample are retained in their adjacent JSON files. The compiler and numerical backend fingerprints are identical across both acceptance runs.

## Profile and production changes

The runtime now reduces 128 adjacent leaves within a threadgroup, submits pure map/matrix-plus-sum compositions in one command buffer, and packages a shared-memory hardware matrix tile. The previously qualified M2 Max register-quad entry remains selected in its measured crossover range. No fast math, FMA contraction, CPU arithmetic substitution or implicit software fallback was introduced.

The following instrumented diagnostics are normalized per invocation. They are separate from the uninstrumented acceptance runs above; timestamps cover GPU command execution, while encoding time covers host preparation/encoding before commit.

| Workload | Version | GPU command execution (µs) | Host encoding (µs) | Submissions | Dispatches |
| --- | --- | ---: | ---: | ---: | ---: |
| dot 4,194,304 | Before | 569.76 | 48.17 | 2 | 23 |
| dot 4,194,304 | After | 241.73 | 26.27 | 1 | 5 |
| matrix 512 | Before | 1006.27 | 40.95 | 2 | 19 |
| matrix 512 | After | 997.52 | 27.94 | 1 | 4 |

Raw profile evidence: [before](gpu-profile-before-2026-10-24.json), [after](gpu-scaling-profile-2026-10-24.json). The pre-optimization [scaling run](gpu-scaling-before-2026-10-24.md) and [intermediate blocked-kernel experiment](gpu-scaling-blocked-2026-10-24.md) are exploratory quick runs. They informed the changes and tile policy; the speedup claims use the full acceptance runs.

## Numerical and runtime qualification

`native-metal-gpu-optimization` passed 1,010 cases and 1,427,215 output comparisons per runtime variant: optimized, debug, address/undefined-sanitized and thread-sanitized. This is 5,708,860 checks across four variants, with Metal API and shader validation enabled. An additional optimized production-mode run without those validation layers also passed.

Independent LLVM APFloat references check seeded finite mantissas/exponents, rounding and FMA witnesses, balanced reduction boundaries, isolated exceptional operand pairs, signed zeros, infinities, NaNs, subnormals and empty axes. Hardware Metal flush-to-zero is applied at arithmetic boundaries; non-NaN results are compared bitwise, while NaN payloads may differ. Every output cell of the actual benchmark-input matrices at 128, 256, 512 and 1024 is additionally checked against an independent exact integer contraction reference.

Allocation injection, cancellation/deadlines with held completions, failed command completion, one-submit composition, immutable inputs and complete cleanup are checked. All 46 selected GPU/runtime regressions passed across the broad run and targeted reruns, including existing strict arithmetic, all numeric storage types and graph paths. A stale legacy admission test was corrected to verify supported rank-3/rank-8 reductions and reject rank nine. All eight benchmark reference/protocol unit tests passed. The complete native build passed; the final build check reported no work remaining.

Implementation and reproduction: [GPU optimization design](../../docs/design/gpu-optimization.md), [benchmark guide](../../native/benchmarks/languages/README.md).

These are local numerical-kernel measurements against straightforward compiled implementations, not a BLAS or model-inference ranking. CPU references are single-threaded; no machine isolation, affinity or frequency control was applied. Small workloads and fresh vector uploads still favor CPU. Metal float64 continues to require explicit software fallback and is outside this hardware-float32 speedup claim.
