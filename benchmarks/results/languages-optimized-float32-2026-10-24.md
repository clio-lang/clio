# Native language kernel comparison

**Methodology correction:** Kalandra built-ins and the handwritten language references use different fusion, allocation and matrix strategies. These measurements do not establish compiler-performance parity or performance against optimized numerical libraries. CPU/GPU comparisons within Kalandra describe its own tensor backends. See the [audit and replacement requirements](../../docs/design/benchmark-methodology.md).

Recorded: 2026-10-23T23:56:54.051166+00:00. macOS-27.2-arm64-arm-64bit-Mach-O.

float32 kernels, arithmetic policy `hardware`. CPU cases are single-threaded; Metal uses the GPU. Times are microseconds per invocation, including intermediate allocation, result reduction and cleanup. Process startup, shader loading, compilation and input initialization are excluded. Python is the standard-library interpreter baseline, without NumPy/BLAS. It uses Python float (binary64); all chosen inputs, products and sums are exactly representable in both binary32 and binary64.

| Case | Size | Kalandra CPU (hardware) | Metal resident (hardware) | Metal transfers (hardware) | C++ | Go | Rust | Python |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| dot | 16384 | 3.82 | 416.38 | 874.98 | 5.82 | 22.00 | 11.17 | 1020.70 |
| dot | 262144 | 54.82 | 490.05 | 1118.91 | 80.63 | 343.43 | 166.71 | 17874.53 |
| axpy | 16384 | 3.77 | 445.99 | 730.18 | 7.91 | 29.32 | 15.15 | 1277.72 |
| axpy | 262144 | 55.59 | 505.54 | 1064.06 | 104.41 | 467.88 | 224.61 | 22712.36 |
| matrix | 48 | 22.79 | 376.42 | 670.88 | 55.77 | 156.34 | 126.99 | 8568.28 |
| matrix | 96 | 172.56 | 623.75 | 924.07 | 387.26 | 1267.37 | 890.53 | 65609.19 |

Each cell is the median of fresh-process medians; raw samples and commands are in the adjacent JSON. Different languages calibrate their batch iteration counts to the same target duration. These are straightforward equivalent algorithms, not optimized BLAS or end-to-end application rankings.

Kalandra uses the compiler’s private test-entry adapter to accept runtime inputs. Its C++ driver only times calls and validates cleanup; the numerical kernels come from kernels.k. CPU uses no source-level tasks. Invocation setup/status/settle checks are included. GPU columns execute the same source expressions through the native Metal runtime. Resident excludes uploads but includes dispatch, synchronization and scalar readback; transfers also includes both uploads. Both include task-group retirement. Host buffer wrapping and shader/pipeline loading are outside both GPU timings. The hardware policy uses CPU/Metal floating instructions where supported. Metal float64 is available only with explicit software fallback; hardware-with-software-fallback retains hardware CPU float64 and Metal float32.

No machine isolation, affinity or frequency control was applied. Allocation strategies, compiler transformations, bounds checks and Go GC may differ. Do not generalize one host’s results to language-wide performance.
