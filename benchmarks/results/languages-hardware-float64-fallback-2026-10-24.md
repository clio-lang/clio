# Native language kernel comparison

**Methodology correction:** Kalandra built-ins and the handwritten language references use different fusion, allocation and matrix strategies. These measurements do not establish compiler-performance parity or performance against optimized numerical libraries. CPU/GPU comparisons within Kalandra describe its own tensor backends. See the [audit and replacement requirements](../../docs/design/benchmark-methodology.md).

Recorded: 2026-10-23T23:20:08.980584+00:00. macOS-27.2-arm64-arm-64bit-Mach-O.

float64 kernels, arithmetic policy `hardware-with-software-fallback`. CPU cases are single-threaded; Metal uses the GPU. Times are microseconds per invocation, including intermediate allocation, result reduction and cleanup. Process startup, shader loading, compilation and input initialization are excluded. Python is the standard-library interpreter baseline, without NumPy/BLAS. It uses Python float (binary64); all chosen inputs, products and sums are exactly representable in both binary32 and binary64.

| Case | Size | Kalandra CPU (hardware) | Metal resident (software) | Metal transfers (software) | C++ | Go | Rust | Python |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| dot | 16384 | 37.56 | 462.93 | 860.67 | 8.70 | 24.00 | 13.90 | 1015.01 |
| dot | 262144 | 565.56 | 614.02 | 1447.48 | 140.03 | 360.34 | 209.13 | 17590.71 |
| axpy | 16384 | 51.31 | 468.30 | 847.05 | 12.37 | 33.04 | 19.44 | 1284.64 |
| axpy | 262144 | 809.19 | 615.25 | 1596.65 | 173.90 | 473.83 | 295.20 | 22441.86 |
| matrix | 48 | 191.16 | 561.95 | 950.97 | 70.80 | 156.31 | 125.18 | 8613.66 |
| matrix | 96 | 1434.34 | 680.18 | 1065.12 | 487.32 | 1263.77 | 894.12 | 65271.62 |

Each cell is the median of fresh-process medians; raw samples and commands are in the adjacent JSON. Different languages calibrate their batch iteration counts to the same target duration. These are straightforward equivalent algorithms, not optimized BLAS or end-to-end application rankings.

Kalandra uses the compiler’s private test-entry adapter to accept runtime inputs. Its C++ driver only times calls and validates cleanup; the numerical kernels come from kernels.k. CPU uses no source-level tasks. Invocation setup/status/settle checks are included. GPU columns execute the same source expressions through the native Metal runtime. Resident excludes uploads but includes dispatch, synchronization and scalar readback; transfers also includes both uploads. Both include task-group retirement. Host buffer wrapping and shader/pipeline loading are outside both GPU timings. The hardware policy uses CPU/Metal floating instructions where supported. Metal float64 is available only with explicit software fallback; hardware-with-software-fallback retains hardware CPU float64 and Metal float32.

No machine isolation, affinity or frequency control was applied. Allocation strategies, compiler transformations, bounds checks and Go GC may differ. Do not generalize one host’s results to language-wide performance.
