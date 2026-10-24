# Native language kernel comparison

**Methodology correction:** Kalandra built-ins and the handwritten language references use different fusion, allocation and matrix strategies. These measurements do not establish compiler-performance parity or performance against optimized numerical libraries. CPU/GPU comparisons within Kalandra describe its own tensor backends. See the [audit and replacement requirements](../../docs/design/benchmark-methodology.md).

Recorded: 2026-10-23T22:11:48.979986+00:00. macOS-27.2-arm64-arm-64bit-Mach-O.

Float64 kernels. CPU cases are single-threaded; Metal uses the GPU. Times are microseconds per invocation, including intermediate allocation, result reduction and cleanup. Process startup, shader loading, compilation and input initialization are excluded. Python is the standard-library interpreter baseline, without NumPy/BLAS.

| Case | Size | Kalandra CPU | Metal resident | Metal transfers | C++ | Go | Rust | Python |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| dot | 16384 | 912.04 | 465.66 | 854.90 | 8.66 | 24.10 | 13.92 | 1031.81 |
| dot | 262144 | 15323.31 | 619.81 | 1412.30 | 129.48 | 350.67 | 209.87 | 17815.12 |
| axpy | 16384 | 1161.01 | 465.38 | 851.85 | 11.72 | 32.73 | 19.52 | 1270.61 |
| axpy | 262144 | 17944.42 | 620.92 | 1432.29 | 168.28 | 482.12 | 290.26 | 22594.99 |
| matrix | 48 | 6021.22 | 578.58 | 897.54 | 70.75 | 157.32 | 125.53 | 8630.06 |
| matrix | 96 | 48504.90 | 708.23 | 1090.78 | 486.75 | 1263.36 | 898.03 | 65387.25 |

Each cell is the median of fresh-process medians; raw samples and commands are in the adjacent JSON. Different languages calibrate their batch iteration counts to the same target duration. These are straightforward equivalent algorithms, not optimized BLAS or end-to-end application rankings.

Kalandra uses the compiler’s private test-entry adapter to accept runtime inputs. Its C++ driver only times calls and validates cleanup; the numerical kernels come from kernels.k. CPU uses no source-level tasks. Invocation setup/status/settle checks are included. GPU columns execute the same source expressions through the native Metal runtime. Resident excludes uploads but includes dispatch, synchronization and scalar readback; transfers also includes both uploads. Both include task-group retirement. Host buffer wrapping and shader/pipeline loading are outside both GPU timings. Apple Metal float64 uses Kalandra’s strict software arithmetic, not hardware FP64.

No machine isolation, affinity or frequency control was applied. Allocation strategies, compiler transformations, bounds checks and Go GC may differ. Do not generalize one host’s results to language-wide performance.

## CPU float64 implementation note

Inspection of the emitted `dot.ll` confirms that this Kalandra build lowers float64 multiplication and reduction to integer-based strict arithmetic (`i128` operations), rather than hardware `fmul`/`fadd`. Metal also uses software float64. The C++/Go/Rust/Python baselines use their ordinary float64 operations. This is an important explanation for the current CPU gap: the table measures the language's present implementation and guarantees, not equivalent machine instructions. It does not establish float32 performance. This explanatory note was added after measurement; no timing samples were changed.
