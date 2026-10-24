# Native language kernel comparison

**Methodology correction:** Kalandra built-ins and the handwritten language references use different fusion, allocation and matrix strategies. These measurements do not establish compiler-performance parity or performance against optimized numerical libraries. CPU/GPU comparisons within Kalandra describe its own tensor backends. See the [audit and replacement requirements](../../docs/design/benchmark-methodology.md).

Recorded: 2026-10-23T23:58:56.418135+00:00. macOS-27.2-arm64-arm-64bit-Mach-O.

float64 kernels, arithmetic policy `hardware-with-software-fallback`. CPU cases are single-threaded; Metal uses the GPU. Times are microseconds per invocation, including intermediate allocation, result reduction and cleanup. Process startup, shader loading, compilation and input initialization are excluded. Python is the standard-library interpreter baseline, without NumPy/BLAS. It uses Python float (binary64); all chosen inputs, products and sums are exactly representable in both binary32 and binary64.

| Case | Size | Kalandra CPU (hardware) | Metal resident (software) | Metal transfers (software) | C++ | Go | Rust | Python |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| dot | 16384 | 5.53 | 457.12 | 841.92 | 8.60 | 23.87 | 13.80 | 1022.85 |
| dot | 262144 | 90.26 | 611.19 | 1431.12 | 128.47 | 353.44 | 207.59 | 17808.03 |
| axpy | 16384 | 5.53 | 458.75 | 847.38 | 11.54 | 33.35 | 19.35 | 1265.49 |
| axpy | 262144 | 90.06 | 619.79 | 1450.26 | 172.83 | 462.29 | 286.22 | 22369.61 |
| matrix | 48 | 42.12 | 509.64 | 855.31 | 70.19 | 155.65 | 124.11 | 8563.21 |
| matrix | 96 | 346.76 | 700.19 | 1060.32 | 459.26 | 1248.83 | 888.08 | 64947.44 |

Each cell is the median of fresh-process medians; raw samples and commands are in the adjacent JSON. Different languages calibrate their batch iteration counts to the same target duration. These are straightforward equivalent algorithms, not optimized BLAS or end-to-end application rankings.

Kalandra uses the compiler’s private test-entry adapter to accept runtime inputs. Its C++ driver only times calls and validates cleanup; the numerical kernels come from kernels.k. CPU uses no source-level tasks. Invocation setup/status/settle checks are included. GPU columns execute the same source expressions through the native Metal runtime. Resident excludes uploads but includes dispatch, synchronization and scalar readback; transfers also includes both uploads. Both include task-group retirement. Host buffer wrapping and shader/pipeline loading are outside both GPU timings. The hardware policy uses CPU/Metal floating instructions where supported. Metal float64 is available only with explicit software fallback; hardware-with-software-fallback retains hardware CPU float64 and Metal float32.

No machine isolation, affinity or frequency control was applied. Allocation strategies, compiler transformations, bounds checks and Go GC may differ. Do not generalize one host’s results to language-wide performance.
