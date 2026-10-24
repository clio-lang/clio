# Native language kernel comparison

**Methodology correction:** Kalandra built-ins and the handwritten language references use different fusion, allocation and matrix strategies. These measurements do not establish compiler-performance parity or performance against optimized numerical libraries. CPU/GPU comparisons within Kalandra describe its own tensor backends. See the [audit and replacement requirements](../../docs/design/benchmark-methodology.md).

Recorded: 2026-10-23T23:18:12.815388+00:00. macOS-27.2-arm64-arm-64bit-Mach-O.

float32 kernels, arithmetic policy `hardware`. CPU cases are single-threaded; Metal uses the GPU. Times are microseconds per invocation, including intermediate allocation, result reduction and cleanup. Process startup, shader loading, compilation and input initialization are excluded. Python is the standard-library interpreter baseline, without NumPy/BLAS. It uses Python float (binary64); all chosen inputs, products and sums are exactly representable in both binary32 and binary64.

| Case | Size | Kalandra CPU (hardware) | Metal resident (hardware) | Metal transfers (hardware) | C++ | Go | Rust | Python |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| dot | 16384 | 36.10 | 420.42 | 734.10 | 5.87 | 22.53 | 11.19 | 1025.08 |
| dot | 262144 | 574.74 | 495.17 | 1075.88 | 86.14 | 359.07 | 171.09 | 18071.81 |
| axpy | 16384 | 46.88 | 416.42 | 752.21 | 8.00 | 29.15 | 15.31 | 1288.29 |
| axpy | 262144 | 739.51 | 485.79 | 1068.64 | 107.50 | 449.57 | 226.58 | 22400.84 |
| matrix | 48 | 25.94 | 412.42 | 670.15 | 56.85 | 159.46 | 127.18 | 8690.94 |
| matrix | 96 | 191.31 | 430.72 | 749.10 | 385.96 | 1272.27 | 905.28 | 66452.38 |

Each cell is the median of fresh-process medians; raw samples and commands are in the adjacent JSON. Different languages calibrate their batch iteration counts to the same target duration. These are straightforward equivalent algorithms, not optimized BLAS or end-to-end application rankings.

Kalandra uses the compiler’s private test-entry adapter to accept runtime inputs. Its C++ driver only times calls and validates cleanup; the numerical kernels come from kernels.k. CPU uses no source-level tasks. Invocation setup/status/settle checks are included. GPU columns execute the same source expressions through the native Metal runtime. Resident excludes uploads but includes dispatch, synchronization and scalar readback; transfers also includes both uploads. Both include task-group retirement. Host buffer wrapping and shader/pipeline loading are outside both GPU timings. The hardware policy uses CPU/Metal floating instructions where supported. Metal float64 is available only with explicit software fallback; hardware-with-software-fallback retains hardware CPU float64 and Metal float32.

No machine isolation, affinity or frequency control was applied. Allocation strategies, compiler transformations, bounds checks and Go GC may differ. Do not generalize one host’s results to language-wide performance.
