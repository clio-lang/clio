# Native language kernel comparison

**Methodology correction:** Kalandra built-ins and the handwritten language references use different fusion, allocation and matrix strategies. These measurements do not establish compiler-performance parity or performance against optimized numerical libraries. CPU/GPU comparisons within Kalandra describe its own tensor backends. See the [audit and replacement requirements](../../docs/design/benchmark-methodology.md).

Recorded: 2026-10-24T00:46:05.455106+00:00. macOS-27.2-arm64-arm-64bit-Mach-O.

float32 kernels, arithmetic policy `hardware`. CPU cases are single-threaded; Metal uses the GPU. Times are microseconds per invocation, including intermediate allocation, result reduction and cleanup. Process startup, shader loading, compilation and input initialization are excluded. Python is the standard-library interpreter baseline, without NumPy/BLAS. It uses Python float (binary64); all chosen inputs, products and sums are exactly representable in both binary32 and binary64.

| Case | Size | Kalandra CPU (hardware) | Metal resident (hardware) | Metal transfers (hardware) | C++ | Go | Rust | Python |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| dot | 262144 | 54.94 | 256.72 | 917.24 | 81.42 | 345.55 | 170.57 | omitted |
| dot | 1048576 | 221.88 | 393.85 | 1713.86 | 362.14 | 1314.79 | 680.36 | omitted |
| dot | 4194304 | 981.34 | 966.96 | 5639.51 | 1539.26 | 5109.54 | 2722.76 | omitted |
| axpy | 262144 | 55.38 | 256.14 | 872.35 | 106.18 | 444.21 | 228.42 | omitted |
| axpy | 1048576 | 228.04 | 362.02 | 1729.87 | 466.23 | 1770.07 | 932.01 | omitted |
| axpy | 4194304 | 985.78 | 894.16 | 5178.39 | 2196.59 | 6657.65 | 3925.18 | omitted |
| matrix | 128 | 410.93 | 280.25 | 603.91 | 1105.32 | 3123.08 | 2205.86 | omitted |
| matrix | 256 | 3299.48 | 481.01 | 905.85 | 13539.52 | 25810.17 | 16679.72 | omitted |
| matrix | 512 | 26199.32 | 1262.61 | 2022.65 | 111013.38 | 212651.29 | 124006.62 | omitted |
| matrix | 1024 | 209652.54 | 10467.12 | 11775.55 | 1129328.83 | 2003781.79 | 1150629.88 | omitted |

Each cell is the median of fresh-process medians; raw samples and commands are in the adjacent JSON. Different languages calibrate their batch iteration counts to the same target duration. These are straightforward equivalent algorithms, not optimized BLAS or end-to-end application rankings.

Kalandra uses the compiler’s private test-entry adapter to accept runtime inputs. Its C++ driver only times calls and validates cleanup; the numerical kernels come from kernels.k. CPU uses no source-level tasks. Invocation setup/status/settle checks are included. GPU columns execute the same source expressions through the native Metal runtime. Resident excludes uploads but includes dispatch, synchronization and scalar readback; transfers also includes both uploads. Both include task-group retirement. Host buffer wrapping and shader/pipeline loading are outside both GPU timings. The hardware policy uses CPU/Metal floating instructions where supported. Metal float64 is available only with explicit software fallback; hardware-with-software-fallback retains hardware CPU float64 and Metal float32.

No machine isolation, affinity or frequency control was applied. Allocation strategies, compiler transformations, bounds checks and Go GC may differ. Do not generalize one host’s results to language-wide performance.
