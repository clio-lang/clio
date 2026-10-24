# Native tensor implementation comparison

Three verified numerical programs, each with **Kalandra CPU, Kalandra Apple Metal GPU, Go, standard-library Python, Rust, and C++** implementations. Kalandra uses built-in tensor kernels; the other implementations are handwritten references with different fusion, allocations and matrix strategies. This suite measures those implementations and does not qualify general compiler parity or optimized numerical-library performance. See the [benchmark methodology](../../../docs/design/benchmark-methodology.md).

| Program | Expression | Measured sizes |
| --- | --- | --- |
| Dot product | `reduceSum(a * b)` | 16,384 and 262,144 elements |
| Scaled vector addition + sum | `reduceSum(a * 3 + b)` | 16,384 and 262,144 elements |
| Matrix product + sum | `reduceSum(matmul(a, b))` | 48×48 and 96×96 matrices |

Compiled implementations use the selected `--dtype` (float32 by default); Python uses ordinary binary64 floats. Every implementation uses runtime-created inputs `(i % 17 - 8) / 8` and `(i % 13 - 6) / 8`, and adjacent-pair reductions. The small dyadic inputs keep products and all intermediate sums exactly representable in both binary32 and binary64. An independent Python integer reference checks the accumulated result of **every measured and warmup batch**, not only a final run. Singleton and odd sizes 1, 3 and 17 are checked for each program/mode before measurement. Inputs are checked unchanged after running. A failure aborts the run without a report.

Use the [fair comparison suite](../fair/README.md) for equivalent source algorithms and optimized numerical-library APIs.

## Run

Build the native compiler normally, then run from the repository root:

```sh
cmake --preset native
cmake --build --preset native --parallel 2
python3 native/benchmarks/languages/run.py
```

The full suite requires macOS with a supported Apple GPU, the pinned LLVM/Metal toolchains, Go, Rust and Python 3. Python needs no packages; Go and Rust need no external modules or crates. No dependencies are installed automatically. The runner looks for the native compiler in `build/native/native/kalandra`, Clang in the toolchain lock, Go/Rust on PATH, and also the local stable rustup toolchain. Override with `--compiler`, `--clang`, `--go`, `--rustc`, or `--python`.

```sh
# Build all implementations and check correctness without publishing timings:
python3 native/benchmarks/languages/run.py --verify-only
# Exploratory timing with one process and three rounds per cell:
python3 native/benchmarks/languages/run.py --quick
# Explicitly omit Metal on Linux/Windows or a machine without GPU access:
python3 native/benchmarks/languages/run.py --cpu-only
# Preserve a chosen output name (existing JSON/Markdown reports are not overwritten):
python3 native/benchmarks/languages/run.py --output benchmarks/results/my-comparison.json
```

The default arithmetic policy is hardware. To compare CPU hardware float64 with explicit Metal software fallback, run:

```sh
python3 native/benchmarks/languages/run.py --dtype float64 --arithmetic hardware-with-software-fallback
```

`--arithmetic software` requests the strict software implementation on both CPU and GPU. The runner verifies generated LLVM/MLIR before timing and records the actual floating-instruction evidence. CPU-only execution omits both GPU columns explicitly. The current build commands are qualified on macOS; other hosts may need tool-path/linker adjustments. This harness does not expand the distribution qualification boundary.

## Timing boundaries

All CPU kernels are single-threaded. C++ and Kalandra use Clang `-O2 -ffp-contract=off` without LTO, Rust uses optimization level 2 without LTO, Go uses its normal optimized compiler with `GOMAXPROCS=1`, and Python uses its ordinary interpreter. No fast math, BLAS, NumPy, JIT, affinity, or frequency controls are used. Go GC and Python reference counting remain enabled. These implementations intentionally materialize arithmetic results and use straightforward row/column/inner matrix loops; compare equivalent algorithms, not each ecosystem's fastest library.

Kalandra CPU kernels are compiled from **kernels.k** through the existing private `--test-entry` ABI. The C++ timing adapter supplies dynamic input descriptors and consumes the scalar result; it does not implement Kalandra's arithmetic. Invocation creation, status checks, settlement and cleanup checks are timed. This avoids constant-folding a literal main and avoids comparing interpreter startup against native kernel execution. This is not a public C++ interop promise or a source-level spawn/await benchmark.

GPU shaders are generated from **gpu.k**, which contains the same expressions. Two GPU modes are reported for **every program and size**:

- **Metal resident:** inputs are uploaded before warmup. Wall time includes native runtime dispatch, scheduling, intermediate GPU allocations, reduction, synchronization, scalar readback, task retirement and cleanup.
- **Metal transfers:** the same work, plus both input uploads and release of their device buffers on every invocation. Host input wrapping is outside timing. The output is a scalar and is already read back by the reduction; there is no additional tensor download to omit.

Both GPU columns exclude runtime/pool creation, shader/pipeline loading and input initialization. CPU and GPU numerical results agree exactly on these inputs. **Float32 uses hardware CPU/Metal arithmetic by default. Apple Metal float64 requires explicit software fallback; CPU float64 remains hardware under that fallback policy.** Python uses binary64 in both profiles and is labeled accordingly. GPU validation/injection must be disabled for timing; the runner rejects enabled `MTL_DEBUG_LAYER`, `MTL_SHADER_VALIDATION`, or `DYLD_INSERT_LIBRARIES`.

Every invocation's result contributes to an observed batch checksum. The C++ kernel is a separate translation unit without LTO; Rust uses `black_box` and a non-inlined kernel; Go disables kernel inlining. These measures keep the workload observable. Setup/compilation/process startup are excluded. Allocation and result reduction are included, but compiler/runtime allocation strategies differ.

## Sampling and evidence

The default run calibrates each cell to a nominal 75ms batch, with at least one invocation and at most 100,000. It then executes **three fresh processes per cell**, each with **two warmup batches and seven measured batches**. Cell order is deterministically shuffled each process pass (seed 20261024). Processes run sequentially. The reported value is the median of the three process medians, divided by batch iterations. There is no fastest-sample selection or timer subtraction. Different iteration counts, kernel caches, garbage collection, desktop activity and thermal state can affect comparisons. The nominal target is approximate, especially for a single slow invocation.

JSON retains every warmup/measured batch, iteration counts, per-process medians, extrema, expected checksums, versions, commands, compiler/source/artifact hashes, CPU/GPU metadata, revision and worktree status. The adjacent Markdown report gives timings in microseconds. Reports use unique UTC timestamps by default and live in `benchmarks/results`. Binaries, Go caches, generated LLVM and Metal artifacts live in ignored `benchmarks/.build/languages/<dtype>-<policy>` and can be deleted/recreated. No large input datasets are checked in, and timing thresholds are not added to CI.

## GPU scaling and profiling

Use `--suite gpu-scaling --languages kalandra kalandra_gpu_resident kalandra_gpu_transfers` to measure vectors of 262,144, 1,048,576 and 4,194,304 elements, plus square matrices of 128, 256, 512 and 1024. The scaling suite omits the Python interpreter by default because its largest cubic matrix workloads exceed the per-process timeout; select languages explicitly to choose a different subset. The GPU driver explicitly sizes its runtime byte budget for the larger input snapshots and intermediate storage. Compilation/loading boundaries and the full three-process sampling protocol are unchanged. An independent exact integer matrix checksum uses distributivity to avoid a cubic Python reference; unit tests compare it with the original cubic definition.

Add `--profile` to retain Metal command execution timestamps, CPU encoding nanoseconds and submission/dispatch counts in each GPU sample. This enables instrumentation explicitly; use a separate run without `--profile` for speedup claims. `--quick` remains exploratory. The [GPU optimization qualification](../../../docs/design/gpu-optimization.md) describes independent per-cell numerical checks and the production compiler/runtime changes.

Use `--suite gpu-vectors` to extend the vector crossover check to 16,777,216 elements, retaining the same CPU/GPU/compiled-language comparisons and full sampling protocol.
