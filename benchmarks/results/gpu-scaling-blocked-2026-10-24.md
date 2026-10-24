# Native language kernel comparison

**Methodology correction:** Kalandra built-ins and the handwritten language references use different fusion, allocation and matrix strategies. These measurements do not establish compiler-performance parity or performance against optimized numerical libraries. CPU/GPU comparisons within Kalandra describe its own tensor backends. See the [audit and replacement requirements](../../docs/design/benchmark-methodology.md).

Recorded: 2026-10-24T00:24:10.861155+00:00. macOS-27.2-arm64-arm-64bit-Mach-O.

float32 kernels, arithmetic policy `hardware`. CPU cases are single-threaded; Metal uses the GPU. Times are microseconds per invocation, including intermediate allocation, result reduction and cleanup. Process startup, shader loading, compilation and input initialization are excluded. Python is the standard-library interpreter baseline, without NumPy/BLAS. It uses Python float (binary64); all chosen inputs, products and sums are exactly representable in both binary32 and binary64.

| Case | Size | Kalandra CPU (hardware) | Metal resident (hardware) | Metal transfers (hardware) | C++ | Go | Rust | Python |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| dot | 262144 | 55.18 | 426.45 | 1031.09 | omitted | omitted | omitted | omitted |
| dot | 1048576 | 227.52 | 568.11 | 1946.47 | omitted | omitted | omitted | omitted |
| dot | 4194304 | 1011.14 | 1144.01 | 5205.14 | omitted | omitted | omitted | omitted |
| axpy | 262144 | 55.28 | 432.56 | 1077.06 | omitted | omitted | omitted | omitted |
| axpy | 1048576 | 231.52 | 552.70 | 2518.19 | omitted | omitted | omitted | omitted |
| axpy | 4194304 | 983.40 | 1079.72 | 5664.64 | omitted | omitted | omitted | omitted |
| matrix | 128 | 409.84 | 413.03 | 880.84 | omitted | omitted | omitted | omitted |
| matrix | 256 | 3307.28 | 626.45 | 1074.52 | omitted | omitted | omitted | omitted |
| matrix | 512 | 26420.75 | 1828.86 | 2381.37 | omitted | omitted | omitted | omitted |
| matrix | 1024 | 209559.33 | 10546.65 | 11853.65 | omitted | omitted | omitted | omitted |

Each cell is the median of fresh-process medians; raw samples and commands are in the adjacent JSON. Different languages calibrate their batch iteration counts to the same target duration. These are straightforward equivalent algorithms, not optimized BLAS or end-to-end application rankings.

Kalandra uses the compiler’s private test-entry adapter to accept runtime inputs. Its C++ driver only times calls and validates cleanup; the numerical kernels come from kernels.k. CPU uses no source-level tasks. Invocation setup/status/settle checks are included. GPU columns execute the same source expressions through the native Metal runtime. Resident excludes uploads but includes dispatch, synchronization and scalar readback; transfers also includes both uploads. Both include task-group retirement. Host buffer wrapping and shader/pipeline loading are outside both GPU timings. The hardware policy uses CPU/Metal floating instructions where supported. Metal float64 is available only with explicit software fallback; hardware-with-software-fallback retains hardware CPU float64 and Metal float32.

No machine isolation, affinity or frequency control was applied. Allocation strategies, compiler transformations, bounds checks and Go GC may differ. Do not generalize one host’s results to language-wide performance.
