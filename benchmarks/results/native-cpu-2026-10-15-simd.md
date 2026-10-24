# Native CPU: four-column SIMD microtiles

Follow-up: [rectangular, tiny, and tail-heavy measurements](native-shapes-2026-10-15.md) extend this square-only comparison and identify the next specialization. This report retains its original observations.

The compiler now emits a 1×4 column tile for float32 matrix multiplication. On the measured Apple M2 Max, a sixteen-projection 96×96 batch improves **16.12 → 6.27 ms** directly (**2.57×**) and **2.55 → 1.01 ms** with eight workers (**2.53×**). Strict per-cell arithmetic, cancellation, and ownership checks pass. The measured projection still uses three managed allocations, with larger bounded scratch for SIMD tiles.

## What changed

Each SIMD lane computes a different output column in the same row. For every contraction element, the left value is broadcast and four logically adjacent right values are packed. Four-lane multiplication materializes separately rounded float32 products in interleaved scratch. Adjacent contraction pairs are then added lane by lane; an odd contraction tail is copied unchanged. The tree within every lane is identical to the scalar tree. This does not use a horizontal SIMD reduction, reassociation, fast math, or fused multiply-add. Singleton negative zero and empty positive zero retain their existing rules.

Full tiles cover multiples of four columns. Up to three remaining columns use the existing scalar reduction on the same buffer. Rows and tiles are serial within an invocation; independent tasks still own separate scratch. Output-empty shapes use zero scratch and skip rows, including otherwise very large unused extents. Allocation arithmetic is checked before any buffer is accessed. The general scalar `reduceSum` algorithm is unchanged.

Scratch remains one managed allocation per matmul. A tile needs `4 * inner` floats, compared with the previous `inner` floats; fewer than four output columns retain scalar scratch. At inner extent 96, this is **384 → 1,536 bytes** of matmul scratch. Output/reduceSum buffers and the number of managed allocations are unchanged. This is a bounded memory-for-throughput tradeoff, not an allocation-count reduction. Counters do not include every allocator/bookkeeping allocation in the process.

MLIR emits explicit vector operations and lowers them through `convert-vector-to-llvm`. The pinned ARM64 compiler produces `fmul.4s` and `fadd.4s`. Optimized conformance checks those instructions and rejects fused instructions. This is the first column microtile, not a tuned blocked GEMM, BLAS backend, or GPU implementation. General M/K cache blocking, wider tiles, packing, and target selection remain separate work.

## Correctness and safety gates

All **39 native tests pass**, including debug, optimized, ASan/UBSan, and separate TSan coverage of runtime/generated kernels. After refining the per-cell test interface, the three source conformance variants were reverified separately; the other 36 passing suites use the same final compiler implementation.

The aggregate runtime-input sweep expands from 1,029 to **1,617 shape/content cases per build variant**, each repeated twice. Rows are {0,1,2,3,5,8,17}, contraction lengths {0,1,2,3,7,16,33}, and columns {0,1,2,3,4,5,6,7,8,9,17}; modes cover sequential values, seeded finite data, and IEEE edge mixtures. All scalar-tail widths are exercised. Existing fixed IEEE references, shape/size guards, empty huge extents, allocation failure at every generated position, shared tensor lifetimes, and evaluation order remain gates.

A final aggregate sum could hide a lane permutation. The private test wrapper therefore also supports tensor results, returning their descriptor through an output pointer while storage stays owned by the invocation. The [new harness](../../native/tests/MatrixHarness.cpp) compares every output cell against independently materialized, separately rounded products and a host adjacent-pair tree:

- **693** general shape/content cases, each repeated, covering empty contractions/outputs, tile boundaries, tails, finite rounding, subnormals, signed zero, infinities, and NaNs.
- **12** square cases using the same tensor twice **inside Kalandra source**, each repeated. Wrapper inputs remain independently owned; these checks do not violate bufferization's restricted-input convention.
- Float-aligned inputs without a vector-alignment promise, input sentinels and unchanged-bit checks, all allocation-failure positions for representative general/shared outputs, and pre-cancelled entry with zero allocation.

Non-NaN results compare by float32 bits; NaN payload identity is excluded. Returned storage is read before invocation settlement and all owners are subsequently released. This private descriptor interface is not a public FFI or validation of arbitrary external pointers/views.

Existing compiled-worker tests execute real vectorized kernels concurrently, cancel/deadline them after observing in-loop polls, propagate shape faults, preserve sibling inputs/results, and verify cleanup. Separate TSan and ASan instrumentation remains active in emitted LLVM. Polling still occurs at entry/call boundaries and at most every 256 generated-loop iterations; a vector iteration can process four lanes, so this is not a 256-scalar-operation bound or a wall-clock guarantee.

## Paired performance experiment

The saved baseline comes from **`0fac4c0`**. Its executable hash matches the preceding task-maintenance report; its generated LLVM was saved separately and matches that report too. Runtime, scheduler, checked invocation ABI, benchmark harness, and workload sources are unchanged. This comparison changes code generation, not scheduler behavior.

Machine: Apple M2 Max, 8 performance plus 4 efficiency cores, 96 GiB RAM; pinned Clang/LLVM 22.1.8, C++23, `-O2 -DNDEBUG -ffp-contract=off`. No BLAS, LTO, fast math, sanitizer, GPU, Bun, or Node in the performance build.

Each batch runs sixteen independent matrix multiplications followed by row-major balanced reductions. Nonuniform binary-fraction inputs avoid a uniform-value shortcut and have independently checked expected results. The dimension-zero control returns 1 without entering generated code; it measures task lifecycle, not empty-matrix arithmetic.

Three fresh baseline/current process pairs alternate order. Each process creates persistent 1/2/4/8-worker pools; direct calls use no scheduler. Inputs, allocator state, and pools warm for three batches per configuration before nine measured batches with shuffled configuration order. Values below are milliseconds per batch, median of three process medians. Timing includes computation and the task lifecycle, excluding compilation, process/pool startup, input/reference construction, warmup, allocation diagnostics, and quiescent stats scans. Correctness suites stopped before measurement.

| Matrix size / execution | Before (ms) | SIMD tile (ms) | Before / after |
| ----------------------- | ----------: | -------------: | -------------: |
| 0×0 / direct            |      0.0013 |         0.0012 |          1.10× |
| 0×0 / 1 workers         |      0.0087 |         0.0083 |          1.05× |
| 0×0 / 2 workers         |      0.0207 |         0.0172 |          1.20× |
| 0×0 / 4 workers         |      0.0403 |         0.0280 |          1.44× |
| 0×0 / 8 workers         |      0.0949 |         0.0856 |          1.11× |
| 8×8 / direct            |      0.0324 |         0.0143 |          2.27× |
| 8×8 / 1 workers         |      0.0387 |         0.0192 |          2.01× |
| 8×8 / 2 workers         |      0.0368 |         0.0330 |          1.11× |
| 8×8 / 4 workers         |      0.0540 |         0.0650 |          0.83× |
| 8×8 / 8 workers         |      0.1461 |         0.1300 |          1.12× |
| 32×32 / direct          |      0.7703 |         0.2939 |          2.62× |
| 32×32 / 1 workers       |      0.7398 |         0.2897 |          2.55× |
| 32×32 / 2 workers       |      0.3917 |         0.1695 |          2.31× |
| 32×32 / 4 workers       |      0.2357 |         0.1161 |          2.03× |
| 32×32 / 8 workers       |      0.2173 |         0.1638 |          1.33× |
| 96×96 / direct          |     16.1174 |         6.2743 |          2.57× |
| 96×96 / 1 workers       |     15.8314 |         6.1728 |          2.56× |
| 96×96 / 2 workers       |      8.0906 |         3.2008 |          2.53× |
| 96×96 / 4 workers       |      4.7618 |         1.6910 |          2.82× |
| 96×96 / 8 workers       |      2.5526 |         1.0100 |          2.53× |

At 96×96, direct process medians are **16.158, 16.117, 16.077 ms** before and **6.227, 6.280, 6.274 ms** after. Eight-worker medians are **2.553, 2.517, 2.572 ms** before and **1.010, 1.011, 0.998 ms** after. The gain is consistent across these process pairs.

Small threaded batches are mixed. The 8×8/four-worker median is slower (0.054 → 0.065 ms), with baseline process medians 0.123, 0.053, 0.054 ms and current 0.108, 0.045, 0.065 ms. Their ranges overlap substantially. The no-kernel control also moves despite unchanged scheduling code. Those observations should not be attributed to SIMD or sold as a universal scheduling improvement.

CPU affinity, mixed core placement, thermal/frequency state, caches, binary layout, and background activity are uncontrolled. All observations are retained; no minimum/fastest-run selection or timing threshold is used. The experiment covers square dimensions 8/32/96, not general rectangular or tail-heavy throughput. Tail correctness is covered separately; its performance still needs application-shaped measurements.

## Reproduce and next work

Save the preceding executable before rebuilding, or recreate it from `0fac4c0` with the pinned toolchain:

```sh
python3 native/benchmarks/run.py \
  --baseline benchmarks/.build/native-cpu/scaling-before-simd \
  --output benchmarks/results/native-cpu-2026-10-15-simd.json
```

The runner compiles the generated LLVM and current runtime together at `-O2`; it does not time the normal Debug CMake runtime archive. Saved executables/LLVM/assembly are ignored local artifacts. JSON retains exact compiler/link commands, source/compiler/executable hashes, machine metadata, process medians, and complete raw trials. No CTest performance thresholds are introduced.

Next use rectangular and tail-heavy workload measurements to select broader CPU tiling or specialization. Preserve the adjacent-pair tree, separately rounded products, bounded scratch, cooperative cancellation, and immutable ownership. GPU and remote execution remain separate backend/runtime capabilities.

[Raw paired samples](native-cpu-2026-10-15-simd.json) · [Protocol](../../native/benchmarks/README.md) · [Code generation](../../docs/design/native-codegen.md#four-column-cpu-microtiles)
