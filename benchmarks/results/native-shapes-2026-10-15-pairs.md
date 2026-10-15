# Narrow matrix dispatch and two-lane tails

Width selection now happens once per matrix. One-column outputs use a scalar row kernel; two/three-column outputs use paired lanes with an optional scalar last column; wider outputs retain four-lane tiles with paired and scalar tails. Narrow rows never enter an empty four-column loop. Pair/singleton tails no longer require output-column loops.

Against the four-lane-only compiler, tall three-column work is **1.45–1.46× faster**, tall seven-column work **1.22–1.26×**, and tall one-column work **1.08–1.11×** across two complete experiments. The seven/eight-column cliff is reduced, not eliminated: confirmation takes 1,200.83 µs for seven columns versus 999.71 µs for eight, about 20% more despite less work. Seven columns still combine a four-lane tile, a pair, and a scalar column.

These are synthetic generated CPU kernels, not application traces, a BLAS comparison, or GPU performance. No scheduling policy, arithmetic contract, or source syntax changes.

## Correctness and storage

Each lane retains separately rounded float32 products and the same balanced adjacent-pair reduction tree. No padded contraction values, fused multiply-add, fast math, or horizontal lane reduction. Inputs need only float alignment. Scalar `reduceSum` is unchanged.

One invocation-local scratch buffer is reused across rows/tiles. For nonempty outputs it holds `K`, `2*K`, or `4*K` floats for widths one, two/three, or at least four: **`4*K`, `8*K`, or `16*K` bytes**, with checked size arithmetic. Two/three-column outputs therefore use twice the prior scalar scratch bytes, in exchange for evaluating two outputs together. Wider scratch is unchanged. Empty outputs use zero scratch and skip all rows. The projection benchmark still performs three managed allocations/releases per real invocation, including empty cases; the no-kernel control performs none.

The final compiler passes all **39 CTest tests**, including debug, optimized, ASan/UBSan, and separate TSan builds. The source suite checks 1,617 aggregate shape/content cases, 693 per-cell cases, and 24 shared-input cases (717 total per-cell/shared). Allocation-failure injection now covers scalar-only, pair-only, tiled, both tail forms, empty contractions/outputs, and shared-input cases. Generated LLVM and ARM64 assembly must contain strict two- and four-lane multiply/add instructions, with no fused arithmetic. Worker tests additionally cancel running kernels and trigger deadline cancellation at widths 1, 2, 3, 6, 7, and 256, verify independent work survives, and check unchanged inputs and complete cleanup. Generated sanitizer memory instrumentation is verified separately from C++ harness instrumentation.

## Measurement method

The unchanged [37-shape runner](../../native/benchmarks/shapes.py) rebuilds the four-lane-only LLVM from `cee47c6` against the same shape harness and runtime as current LLVM. Its baseline hash matches the [prior confirmation](native-shapes-2026-10-15-confirm.json). Current sources and compiler/LLVM/binary hashes, commands, raw samples, expected bits, and allocation diagnostics are retained in the [first final experiment](native-shapes-2026-10-15-pairs.json) and [confirmation](native-shapes-2026-10-15-pairs-confirm.json). The two final experiments use identical binaries.

Each experiment runs three fresh process pairs with alternating before/after order, identical seeded shape/mode shuffles, three warmup batches per configuration, and nine timed batches. A batch is sixteen operations, using shared immutable nonuniform inputs. Summary time is the median of three process medians. Direct and 1/2/4/8-worker modes produce 185 configurations. Numerical/resource checks verify both versions first; current generated-code ASan plus C++ ASan/UBSan verification finishes before performance timing. Compilation, startup, reference/input construction, warmup, allocation diagnostics, and quiescent statistics scans are excluded. Timed intervals include computation and the selected task lifecycle.

Apple M2 Max, 8 performance plus 4 efficiency cores, 96 GiB RAM; LLVM/Clang 22.1.8, C++23, `-O2 -DNDEBUG -ffp-contract=off`. No CPU affinity, thermal/frequency control, or cache control. The extra parked pools and shared input reuse remain part of the environment. Results from the two experiments are not pooled.

## Direct times

Microseconds per sixteen-operation batch, not per matmul:

| Case              | M×K×N     | First before → after (µs) | Confirmation before → after (µs) | Confirmation speedup |
| ----------------- | --------- | ------------------------: | -------------------------------: | -------------------: |
| tall-one          | 256×64×1  |           358.12 → 323.33 |                  344.29 → 319.54 |                1.08× |
| tall-three        | 256×64×3  |          1041.38 → 717.42 |                 1018.29 → 698.42 |                1.46× |
| tall-seven        | 256×64×7  |         1517.17 → 1244.17 |                1517.42 → 1200.83 |                1.26× |
| tall-eight        | 256×64×8  |         1043.96 → 1034.38 |                 1004.75 → 999.71 |                1.01× |
| deep-seven        | 4×8193×7  |         2739.96 → 2243.29 |                2704.04 → 2177.50 |                1.24× |
| deep-eight        | 4×8193×8  |         1929.12 → 1871.83 |                1817.42 → 1815.17 |                1.00× |
| row-one           | 1×513×1   |             15.29 → 12.71 |                    14.75 → 14.46 |                1.02× |
| row-three         | 1×513×3   |             31.58 → 24.17 |                    30.12 → 23.38 |                1.29× |
| row-six           | 1×513×6   |             39.58 → 28.54 |                    35.88 → 29.58 |                1.21× |
| row-seven         | 1×513×7   |             44.58 → 40.42 |                    47.12 → 40.17 |                1.17× |
| rect-tail-two     | 32×129×66 |         2063.96 → 2013.00 |                2041.50 → 1973.92 |                1.03× |
| rect-tail-three   | 32×129×67 |         2174.38 → 2071.54 |                2099.00 → 2029.08 |                1.03× |
| square-thirty-two | 32×32×32  |           293.04 → 320.54 |                  292.92 → 291.17 |                1.01× |
| square-ninety-six | 96×96×96  |         6208.54 → 6378.54 |                6266.38 → 6210.88 |                1.01× |
| wide              | 8×64×256  |          996.17 → 1018.08 |                  978.54 → 985.42 |                0.99× |
| wide-tail         | 8×64×257  |         1003.37 → 1016.25 |                1006.63 → 1000.38 |                1.01× |

The narrow/tail-heavy gains repeat. Broad/control differences are smaller and inconsistent: the first final experiment's 32-square case is about 9% slower, versus approximately unchanged in confirmation. The 96-square case changes from about 3% slower to 1% faster. Wide output is about 2% slower initially and 1% slower in confirmation. These remain limitations to track, not evidence that every shape improves or that regressions are impossible. Tiny and threaded samples have higher relative noise. Do not multiply speedups from different reports/environments into a new benchmark claim.

## Worker-mode observations

Speedups compare versions within each experiment. These are sixteen-job batches, not individual-call latencies:

| Case              | Workers | First speedup | Confirmation speedup | Confirmation before → after (µs) |
| ----------------- | ------: | ------------: | -------------------: | -------------------------------: |
| tall-three        |       2 |         1.39× |                1.43× |                  528.00 → 368.21 |
| tall-three        |       4 |         1.32× |                1.38× |                  303.54 → 219.62 |
| tall-three        |       8 |         1.27× |                1.25× |                  251.75 → 201.58 |
| tall-seven        |       4 |         1.15× |                1.22× |                  419.75 → 344.50 |
| deep-seven        |       4 |         1.17× |                1.19× |                  735.08 → 617.21 |
| square-ninety-six |       8 |         0.93× |                1.05× |                1067.88 → 1017.50 |
| row-three         |       4 |         0.66× |                1.07× |                    50.96 → 47.46 |
| control           |       4 |         0.69× |                0.91× |                    25.75 → 28.29 |

Small threaded cases can be slower despite a faster direct kernel: four-worker `row-three` changes from 55.00 to 83.17 µs in the first experiment. The no-kernel four-worker control also slows, showing substantial variation even without matrix arithmetic. These observations do not justify changing `spawn` behavior or discarding slower samples. Raw results include every configuration.

## Separate poll evidence

The [untimed probe results](native-shapes-2026-10-15-pairs-polls.json) use all-one inputs and exact results. Atomic counting is excluded from throughput runs. The same probe/runtime is rebuilt with the exact LLVM used in both performance variants.

| M×K×N    | Four-lane-only polls | Current polls |
| -------- | -------------------: | ------------: |
| 256×64×1 |                2,588 |         2,076 |
| 256×64×2 |                4,639 |         2,079 |
| 256×64×3 |                6,689 |         4,129 |
| 256×64×4 |                2,596 |         2,340 |
| 256×64×6 |                6,696 |         4,392 |
| 256×64×7 |                8,745 |         6,441 |
| 256×64×8 |                4,653 |         4,397 |
| 4×8193×7 |                1,295 |           975 |
| 4×8193×8 |                  663 |           659 |

One-column rows remove both the empty tile-loop entry and scalar output-loop entry, reducing polls by two per row. Pair kernels combine two scalar trees and avoid their output-loop overhead. Conditional tails also remove empty scalar-loop entry polls on multiples of four. Poll reductions explain structural work removed; they do not attribute percentages of wall time. Contraction/reduction loops still poll and retain the cancellation budget (at most 256 generated loop iterations between polls).

## Refinement and retained evidence

The initial implementation selected tile/pair/scalar regions inside every row. It improved pair-heavy cases but both runs showed a one-row/one-column slowdown and small broad-output slowdowns. That motivated the final once-per-matrix dispatch. Its [initial measurements](native-shapes-2026-10-15-pairs-row-dispatch.json), [confirmation](native-shapes-2026-10-15-pairs-row-dispatch-confirm.json), and [poll data](native-shapes-2026-10-15-pairs-row-dispatch-polls.json) remain available. The [reconstruction patch](native-shapes-2026-10-15-pairs-row-dispatch.patch), applied to this commit's `native/lib/Backend.cpp`, reproduces the intermediate backend source hash. These intermediate measurements are not mixed into final summaries.

## Next work

The specific narrow/tail specialization is complete. The next kernel experiment should evaluate bounded cache blocking on larger rectangular workloads, with an independent library/reference baseline and explicit scratch/cache footprint measurements. Keep strict reduction order unless a separate numeric policy is designed and accepted. Existing tiny-work overhead also remains; these results do not establish a portable automatic spawning threshold. GPU/remote execution remain separate compiler/runtime milestones.

## Reproduce

Generate the old dynamic projection LLVM using the compiler from `cee47c6`, then run with the final compiler built:

```sh
python3 native/benchmarks/shapes.py \
  --baseline-llvm /path/to/four-lane-baseline.ll \
  --sanitize-check \
  --output benchmarks/results/native-shapes-pairs-reproduction.json
```

The saved baseline was generated with the dynamic projection fixture, `--test-entry reference`, `--emit-llvm`, and `-O2`. Stop other CPU-heavy work first. The runner rebuilds both timing executables; a saved square-only executable is not a substitute.
