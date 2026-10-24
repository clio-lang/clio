# Fair benchmark results — 2026-10-24

Apple M2 Max, macOS 27.2. Native Kalandra on the `native` worktree, LLVM/Clang 23.1.3, optimized Kalandra runtime. The adjacent JSON files retain compiler/library versions, source and artifact hashes, actual build/run commands, every warmup/measured sample and verification errors. The worktree was uncommitted; revision alone does not identify these sources.

The earlier tensor-versus-handwritten-loop results did not establish compiler parity. The corrected source comparison shows substantial Kalandra overhead. The numerical comparison measures complete optimized APIs and retains every backend, precision, thread mode and GPU residency boundary. The requested within-10% Rust/C++ compiler target has not been met.

For float32 1024×1024 matrix-plus-sum, Kalandra CPU takes **205.38 ms**, resident Metal **10.42 ms**, upload-inclusive Metal **11.86 ms**, C++/OpenBLAS with 12 configured threads **6.62 ms**, and C++/Accelerate AUTO **1.05 ms**. Metal is about 19.7× faster than Kalandra CPU, but about 10× slower than Accelerate AUTO. Kalandra’s fused float32 AXPY-plus-sum on 4,194,304 elements is **0.964 ms** on CPU versus **1.568 ms** for single-thread C++/OpenBLAS; its dot product is slower (**0.964 ms** versus **0.532 ms**). These are different workloads with different winners, not an overall score.

## Equivalent source algorithms

Same recursive binary traversal, leaf arithmetic/branches/GCD and runtime inputs in all five languages, without tensor or numerical-library built-ins. Kalandra retains checked arithmetic and invocation/depth/cancellation guards. Other compilers retain normal recursion optimizations and default safety rules; actual integer inputs cannot overflow. These three microbenchmarks expose recursion/control-flow costs, not a language-wide ranking. GPU general recursion is unsupported, and has no substituted built-in score.

| Algorithm, 16,384 leaves | Kalandra µs | C++ µs | Rust µs | Go µs | Python µs |
| --- | ---: | ---: | ---: | ---: | ---: |
| Polynomial | 398.228 | 39.558 | 42.084 | 34.253 | 2080.207 |
| Branches | 437.097 | 49.133 | 49.249 | 53.530 | 2384.135 |
| Euclid | 2251.964 | 122.387 | 159.448 | 163.057 | 6978.298 |

[All source sizes and protocol](fair-source-2026-10-24.md) · [raw source evidence](fair-source-2026-10-24.json).

## Optimized numerical APIs

Complete tasks: dot; `sum(3*a+b)`; `sum(matmul(a,b))`. Allocation/dispatch and completion are timed; input initialization and library loading are excluded. CPU Kalandra uses one thread. OpenBLAS is explicitly configured and queried at 1 and 12 threads; Accelerate SINGLE and AUTO are queried (AUTO is not a fixed worker count). CPU core affinity/frequency and machine isolation were not controlled. Accelerate thread mode constrains its threading API; its internal kernel/hardware selection was not traced.

C++, Go, Rust, Python ctypes and this NumPy installation use the same OpenBLAS 0.3.34 kernel. These are binding/API comparisons, not five independent language kernels. NumPy 2.5.4 uses its own vector expression and reduction API; C++ also tests modern Apple Accelerate. Library FMA and reduction order may differ from Kalandra’s arithmetic contract. Float64 CPU uses hardware; float64 Metal is explicitly software fallback.

Fresh outputs and natural destruction/GC are included. C++/Rust/Python use uninitialized output where permitted; Go uses zero-initialized allocation. BLAS wrappers use copy+AXPY then dot-with-ones; NumPy uses multiply+add then sum; Kalandra may fuse its built-ins. GPU results include scalar readback/completion, with input uploads included only in the upload-inclusive mode. These are disclosed implementation choices for the same complete task.

### Float32, larger workloads

| API / backend | CPU thread mode | Dot 4,194,304 µs | AXPY+sum 4,194,304 µs | Matrix+sum 1024² µs |
| --- | --- | ---: | ---: | ---: |
| Kalandra CPU | 1 | 963.916 | 964.354 | 205379.333 |
| Kalandra Metal resident | GPU | 1119.621 | 905.578 | 10423.692 |
| Kalandra Metal with uploads | GPU | 5577.764 | 5153.597 | 11858.200 |
| C++ OpenBLAS | 1 | 531.687 | 1568.143 | 22037.333 |
| C++ OpenBLAS | 12 | 243.536 | 833.950 | 6624.371 |
| Go OpenBLAS | 1 | 547.127 | 1768.018 | 22875.945 |
| Go OpenBLAS | 12 | 237.360 | 1109.278 | 5167.447 |
| Rust OpenBLAS | 1 | 530.742 | 1574.577 | 22296.972 |
| Rust OpenBLAS | 12 | 230.642 | 839.865 | 5530.417 |
| Python ctypes OpenBLAS | 1 | 558.735 | 1607.419 | 23060.069 |
| Python ctypes OpenBLAS | 12 | 248.922 | 988.489 | 4836.420 |
| NumPy/OpenBLAS | 1 | 546.053 | 1613.756 | 22334.028 |
| NumPy/OpenBLAS | 12 | 238.226 | 1622.273 | 5478.818 |
| C++ Accelerate | 1 | 398.704 | 1269.132 | 1767.214 |
| C++ Accelerate | AUTO | 465.416 | 1291.715 | 1047.160 |

### Float64, larger workloads

Metal binary64 is software fallback; it is not a hardware float64 GPU comparison.

| API / backend | CPU thread mode | Dot 4,194,304 µs | AXPY+sum 4,194,304 µs | Matrix+sum 512² µs |
| --- | --- | ---: | ---: | ---: |
| Kalandra CPU | 1 | 1711.635 | 1658.904 | 54240.208 |
| Kalandra Metal resident | GPU | 2641.777 | 2749.735 | 21240.028 |
| Kalandra Metal with uploads | GPU | 12537.208 | 12690.217 | 22043.417 |
| C++ OpenBLAS | 1 | 1091.739 | 3082.453 | 5613.450 |
| C++ OpenBLAS | 12 | 584.938 | 1748.862 | 1482.232 |
| Go OpenBLAS | 1 | 1101.081 | 3354.514 | 5645.801 |
| Go OpenBLAS | 12 | 595.194 | 2166.875 | 1421.885 |
| Rust OpenBLAS | 1 | 1087.617 | 2992.098 | 5534.250 |
| Rust OpenBLAS | 12 | 580.796 | 1709.700 | 1561.443 |
| Python ctypes OpenBLAS | 1 | 1110.294 | 3045.039 | 5892.333 |
| Python ctypes OpenBLAS | 12 | 601.590 | 1747.869 | 1388.088 |
| NumPy/OpenBLAS | 1 | 1121.690 | 2716.711 | 5548.992 |
| NumPy/OpenBLAS | 12 | 591.694 | 2736.060 | 1738.059 |
| C++ Accelerate | 1 | 1095.812 | 3142.438 | 776.328 |
| C++ Accelerate | AUTO | 1030.963 | 2997.302 | 433.260 |

[All 195 numerical cases](fair-libraries-2026-10-24.md) · [raw numerical evidence](fair-libraries-2026-10-24.json).

## Correctness and reproducibility

- 180 source edge/reference workloads passed. All 810 timed/warmup source batches matched independent closed-form integer/Fraction/GCD references exactly.
- 450 numerical qualification workloads passed, including singleton, odd dimensions and non-dyadic data; 15,312 library output cells were checked individually. Exact Decimal products/sums and gamma-based forward-error bounds distinguish rounding differences from incorrect results. Kalandra benchmark adapters expose scalar results; its separate CPU/Metal APFloat conformance tests cover per-cell behavior.
- All 5,265 measured/warmup numerical batches matched independent exact integer references on the timed dyadic inputs. Small non-dyadic qualification and exact aggregate checks on the large timed data are complementary evidence, not an exhaustive proof for arbitrary inputs.
- Independent CPU numerical conformance and physical Metal numerical conformance both passed (98.65 s total). These retain strict arithmetic/exceptional-value/shape/stride/cancellation and sanitizer checks; language arithmetic semantics were not relaxed for BLAS.
- Five benchmark-evidence unit tests passed, including corrupted warmups, missing samples, invalid timings, wrong/reordered cells, independent matrix references and float64 JSON round-tripping. Registered as `native-fair-benchmark-evidence` in CTest.

Both suites use three fresh measured processes per case, two warmup and seven measured batches, a 50 ms calibration target and deterministic shuffled case order. Reported values are medians of process medians. Compiler builds and conformance tests completed before timing; suites ran sequentially. All source hashes were checked unchanged during measurement. The raw process medians expose variability: 11 of 195 numerical cases had a maximum/minimum process-median ratio above 1.25 (the largest was 2.29). For example, float32 1024² C++/OpenBLAS with 12 threads had process medians of 5.12, 7.97 and 6.62 ms. Small differences and wrapper ordering are not significance claims.

Reproduce with the [fair-suite instructions](../../native/benchmarks/fair/README.md). Historical results retain the [methodology correction](../../docs/design/benchmark-methodology.md); do not use them to claim general compiler parity.

[Validation transcript and Python/macOS versions](fair-validation-2026-10-24.json).
