# Strict GPU matmul layout study — 2026-10-15

Register tiling improves the larger dense matrices tested, but none of these candidates is a safe universal replacement for the current scalar-per-lane kernel. The production compiler, shader and runtime remain unchanged. The [raw results](native-gpu-2026-10-15-tiling.json) retain executable/shader/source hashes, qualification results and all timed samples.

The study compares four strict MLIR/SPIR-V/Metal implementations on the Apple M2 Max (96 GiB memory). It uses revision `c5d51d5` plus the research sources hashed in JSON. All variants retain integer binary32 arithmetic, separately rounded products, and the accepted adjacent-pair reduction tree. No relaxed numeric policy, hardware float32, FMA, vendor math library or CPU fallback is used.

## Results

Preallocated GPU compute-command milliseconds, median of three process medians. Square names use equal M/K/N. The deep-tail shape is `32 × 1025 × 65`; wide is `128 × 256 × 512`; tall is `512 × 256 × 128`.

| Workload         | Current scalar | Shared 8×8 | Register 2×2 | Register 2×1 |
| ---------------- | -------------: | ---------: | -----------: | -----------: |
| matmul-8         |         0.0286 |     0.0522 |       0.0524 |       0.0331 |
| matmul-32        |         0.0579 |     0.1036 |       0.1623 |       0.0779 |
| matmul-96        |         0.2058 |     0.2479 |       0.4650 |       0.2626 |
| matmul-256       |         2.4980 |     2.9422 |       2.2936 |       2.2457 |
| matmul-512       |        19.2336 |    22.1486 |      15.1074 |      16.1721 |
| matmul-deep-tail |         1.1880 |     2.2718 |       4.7450 |       1.8084 |
| matmul-wide      |         2.4988 |     2.9470 |       2.2909 |       2.2479 |
| matmul-tall      |         2.4965 |     3.0200 |       2.2949 |       2.2471 |

At 256-square, the two-row register tile improves the command interval **1.11×**, from 2.498 to 2.246 ms. Its three process medians are 2.245, 2.246, 2.246 ms, versus scalar 2.496, 2.498, 2.499 ms. The same tile improves the tested wide and tall cases by about 1.11×.

At 512-square, the 2×2 register tile improves the command interval **1.27×**, from 19.234 to 15.107 ms. Scalar samples span 18.995–19.752 ms and register samples 15.041–15.989 ms. The improvement is present in all three processes.

The regressions are also substantial. The 2×2 tile takes 4.745 ms versus scalar 1.188 ms for the deep-tail shape, about **3.99× the latency**. It loses at 8/32/96-square too. The two-row tile loses those small/narrow cases; the shared-memory candidate loses every shape in this study. These results do not support a universal tiled kernel or a threshold inferred from matrix size alone.

## Implemented candidates

- **Scalar control:** the actual current compiler-generated one-output-cell-per-lane kernel, including the five-stage strict normalization optimization. It streams products through a private binary-counter root stack and folds roots from low to high.
- **Shared 8×8:** a 64-thread group computes an 8×8 output tile. Threads cooperatively load two 8×8 input tiles into 512 bytes of workgroup storage, with a barrier before use and before reuse. Each valid lane reduces an aligned eight-product subtree in SSA, then carries its root into the private stack at level three. The final contraction tail uses the original per-product stack algorithm. All lanes participate in barriers, including partial row/column tiles; no zero-padded term enters a valid result's tree. Workgroup storage is explicit SPIR-V dialect IR inside the GPU module, not patched or handwritten MSL.
- **Register 2×2:** each lane computes up to four output cells, reusing two left and two right input values. The four independent root stacks share carry-loop and final-fold control. Row/column tails guard input reads and output writes. Grid size follows the number of register tiles.
- **Register 2×1:** each lane computes up to two rows at one output column, reusing the right input. The two root stacks share control. Odd final rows are guarded. Grid size follows row pairs times columns.

The [research MLIR](../../native/benchmarks/gpu-tiling/) and [direct Metal harness](../../native/benchmarks/GpuTiling.mm) are separate from production selection. The managed runtime's existing matmul ABI/geometry is unchanged; the study harness supplies each candidate's matching entry and grid. These files are experiments, not additional language features or supported runtime kernels.

The shared candidate combines cooperative loads with an eight-product subtree; it is not a controlled isolation of shared memory alone. The register candidates combine operand reuse, shared control and fewer output lanes. No hardware counters, measured occupancy, register-spill counters or barrier timings were collected. Increased register pressure, synchronization, code size and reduced output parallelism are hypotheses to investigate, not measured explanations. The preliminary one-sample smoke runs were misleading for register tiles; the table uses the interleaved repeated experiment instead.

## Numerical qualification

Each of the four variants passes **2,485 shape/pattern cases, 161,857 output-cell comparisons and 4,735,946 separately rounded products** against an independent LLVM APFloat implementation of the tree. The same qualification repeats in an ASan/UBSan host build, with Metal API validation enabled in both runs. There are zero mismatches. Arithmetic NaNs compare by classification; other outputs compare exact bits.

Coverage includes contraction lengths from zero through 1,025 around odd/power-of-two boundaries, every combination of output rows/columns in `1,2,3,7,8,9,15,16,17` at several short contractions, partial threadgroups, negative zero, subnormals, finite cancellation, overflow, infinities, quiet/signaling NaNs, deterministic arbitrary bit patterns and a fusion-sensitive case. Empty contractions bind nonempty NaN-sentinel dummy buffers while retaining K=0, exposing unintended product evaluation. Zero-output dispatch omission belongs to the unchanged managed runtime and is not measured by this direct research harness.

Qualification poisons every output cell and a 64-byte suffix guard before dispatch, then checks both the result and the untouched guard. This catches missing zero-result writes and adjacent-storage overruns. Input buffers are downloaded and checked byte-identical after qualification and after each timing workload. Every measured call and excluded warmup checks its output. All generated candidate SPIR-V modules pass validation; the runner’s post-build audit rejects floating add/multiply/divide, FMA or fast-math decorations in the extracted modules. Host sanitizers do not instrument GPU instructions or the prebuilt LLVM reference library. Metal API validation is enabled, but GPU shader instrumentation is not claimed.

## Protocol and reproduction

```sh
cmake --preset native -DKALANDRA_BUILD_METAL_RUNTIME=ON -DKALANDRA_BUILD_METAL_PROOF=ON
cmake --build --preset native
python3 native/benchmarks/gpu_tiling.py \
  --output benchmarks/results/gpu-tiling-reproduction.json
```

Python 3, the pinned compiler/shader dependencies and an actual Apple GPU are required. Existing reports are not overwritten. The runner compiles the scalar control from the current compiler, compiles the three research MLIR files through the same strict lowering, and builds optimized and host-sanitized harnesses. All build commands and source/artifact hashes are recorded. The harness reuses the original benchmark's buffers and data helpers. CPU control functions and runtime code are linked but unused by measured calls; this study measures neither CPU performance nor managed tasks.

The optimized timing executable runs three fresh processes. Eight workloads and four variants are shuffled with fixed seeds; each cell has two excluded warmups and seven recorded samples per process: **672 timed samples and 192 warmup calls**. Variant order is shuffled inside every round. Each variant has persistent private input/output buffers and its own command queue, with no concurrent dispatches. Readback and reference checking use a separate command after both timestamps. Shader compilation, pipeline creation, reference construction, allocation and initial uploads are outside timing. Metal GPUStartTime/GPUEndTime measure the compute-command interval; JSON also retains encode/submit/wait wall time.

There is no language JIT, timer subtraction, sample rejection, sanitizer, profiling macro or Metal validation in timed processes. Inputs are exactly representable nonuniform dyadic fractions; all products and subtree sums fit float32 exactly, so the independent double reference used for timing inputs matches the strict tree. The separate APFloat qualification tests IEEE behavior. These are warmed reused inputs, not a controlled cold-cache experiment. CPU placement, frequency, thermal state and desktop load are uncontrolled. Qualification finishes before timing; no build/test jobs run concurrently with measurements.

The GPU intervals cannot be presented as end-to-end application or managed-task speedups. Transfer costs, task admission/observation, cancellation, ownership budgets, source continuations and concurrent jobs are outside this experiment. Those semantics remain covered by the production tests, whose implementation is unchanged. After restoring the production build, all five matmul/CLI CTest checks pass again (debug, optimized, ASan/UBSan and TSan host/runtime variants plus CLI; 33.26 seconds).

## Decision and next gate

Keep the scalar kernel as the production default. Retain the register candidates as qualified experiments and reject the shared-memory candidate for adoption based on these results. The next integration gate is a broader shape sweep around the observed crossovers, including odd larger outputs, long contractions, short/wide/tall extremes and target resource limits. A shape-aware choice needs evidence for its boundaries, followed by managed task/transfer measurements and the existing lifecycle/ABI gates. The current eight timing shapes do not justify a universal rule. GPU-ABI-001 remains open.
