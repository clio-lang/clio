# Native matrix shapes: narrow dispatch and tails before larger cache blocks

The 37-shape benchmark preserves the broad **~2.5×** SIMD gain for wide, tall/wide, and balanced rectangular work. It also exposes two concrete gaps: scalar-only narrow outputs can regress, and three scalar tail columns can make a seven-column matrix slower than an eight-column matrix. **The next compiler step should be narrow-column dispatch and two-lane output/tail kernels, before broader cache blocking.**

This change adds a benchmark, an untimed diagnostic probe, and documentation. Compiler and runtime implementation sources remain unchanged. These are synthetic kernel shapes, not application traces or a comparison with BLAS/GPU libraries.

## Method and correctness

The suite measures `(M×K) @ (K×N)`, followed by the existing row-major balanced `reduceSum`, for **37 shapes × five execution modes = 185 configurations**. Modes are direct calls and 1/2/4/8-worker pools. Each timed batch contains sixteen operations/tasks using nonuniform positive binary-fraction inputs. The jobs share immutable input matrices; this does not model sixteen unrelated, cold datasets or memory-bandwidth-heavy application traffic.

The pre-SIMD LLVM from **`0fac4c0`** and current SIMD LLVM from **`cee47c6`** are rebuilt against the **same new C++ harness, current runtime, and pinned Clang flags**. LLVM hashes match the archived reports for those revisions. The historical square-only harness/runner is unchanged. Rebuilding both sides avoids using a square-only saved executable for rectangular workloads.

An independent host reference materializes separately rounded float32 products and builds new adjacent-pair levels, including the final output reduction. A double grand total would not generally implement the specified tree. All results compare by float32 bits, inputs remain unchanged, and task/frame/owner/queue/maintenance resources return to zero. Allocation diagnostics remain separate from timings. In this suite, each real kernel has three managed allocations/releases; the explicit no-kernel control has zero.

True empty rows, empty columns, and a zero contraction length execute the generated kernel and return positive zero. Only the separately labelled no-kernel control returns 1 without calling it. This distinguishes empty-matrix semantics from scheduling overhead.

Both versions first verify every shape/mode. The current suite additionally runs with generated-code ASan attributes and C++ ASan/UBSan; post-Clang IR is checked for actual ASan memory instrumentation. Sanitized verification records are retained separately and excluded from timing summaries. The old LLVM is checked numerically, not retroactively sanitizer-instrumented. Existing compiler conformance and TSan results remain the prior commit's evidence; no unchanged compiler suites were rerun for this benchmark-only change.

Two complete experiments are retained because the initial narrow-column regressions warranted confirmation. Each experiment runs three fresh baseline/current process pairs, alternating order. Shape order and measured mode order are shuffled identically for each pair using trial-specific seeds. Four persistent pools are created before measurement; three batches warm each case/mode before nine measured batches. Summary time is the median of three process medians. Compilation, pool/process startup, reference/input construction, verification, warmup, allocation diagnostics, and quiescent statistics inspection are excluded. Timed intervals include computation and the selected task lifecycle.

Machine: Apple M2 Max, 8 performance plus 4 efficiency cores, 96 GiB RAM; Clang/LLVM 22.1.8, C++23, `-O2 -DNDEBUG -ffp-contract=off`. The initial run's sandbox denied CPU metadata queries; its raw unavailable fields remain unchanged, with a [separate metadata capture](native-shapes-2026-10-15-host.json). The confirmation collected host metadata directly. Each before/after pair uses the same environment within its experiment; timings from the two experiments are not pooled. CPU affinity, thermal/frequency state, caches, and background activity are uncontrolled.

## Direct batch timings

All values are **microseconds per sixteen-operation batch**, not per individual matmul. Shape names map to dimensions in the full table below.

| Case              | Initial before → SIMD (µs) | Confirmation before → SIMD (µs) |
| ----------------- | -------------------------: | ------------------------------: |
| tall-one          |            313.88 → 347.67 |                 328.04 → 347.75 |
| tall-three        |           961.54 → 1014.63 |                988.33 → 1013.08 |
| tall-seven        |          2255.08 → 1497.50 |               2225.08 → 1488.25 |
| tall-eight        |          2565.75 → 1012.12 |               2520.54 → 1025.12 |
| deep-seven        |          3756.04 → 2664.92 |               3813.42 → 2651.71 |
| deep-eight        |          4432.58 → 1815.33 |               4386.71 → 1788.92 |
| rect-tail-three   |          5039.08 → 2148.54 |               5008.00 → 2106.83 |
| rect-next-tile    |          5104.67 → 1956.83 |               5159.46 → 1970.17 |
| wide              |           2503.71 → 986.79 |                2557.42 → 989.71 |
| wide-tail         |           2524.79 → 985.92 |                2532.08 → 993.17 |
| square-ninety-six |         16140.58 → 6274.38 |              16057.75 → 6233.08 |

For the confirmation's `256×64 @ 64×7` case, current time is **1,488.25 µs**, versus **1,025.12 µs** for `256×64 @ 64×8`: seven columns cost about **45% more time despite fewer products**. The deep 8193-element contraction shows the same cliff. The wider 257-column case retains the gain because a single tail column is small relative to 64 complete tiles.

The tall one-column median is about **11% slower initially and 6% slower in confirmation**. Tall three-column medians regress about 6% and 3%. The confirmation's one-column process ranges overlap, so those percentages are not exact constants. The single-row one-column result changes direction between experiments, and tiny results remain noisy. The repeatable tall-output cost and strong seven/eight-column cliff justify focused specialization rather than claiming every narrow case regresses.

## Untimed poll evidence

The [diagnostic probe](../../native/benchmarks/ShapePolls.cpp) counts polls for one invocation using all-one inputs with an exact integer result. Atomic counting is excluded from throughput samples. Both binaries use the same probe/runtime and the exact LLVM used by the shape experiments.

| M×K×N    | Pre-SIMD polls | Current polls |
| -------- | -------------: | ------------: |
| 256×64×1 |          2,332 |         2,588 |
| 256×64×3 |          6,433 |         6,689 |
| 256×64×4 |          8,484 |         2,596 |
| 256×64×7 |         14,633 |         8,745 |
| 256×64×8 |         16,685 |         4,653 |
| 4×8193×7 |          2,239 |         1,295 |
| 4×8193×8 |          2,555 |           663 |

With fewer than four output columns, source inspection identifies a zero-trip tile loop whose generated header still polls once on entry for every row. The measured delta is exactly **+256 polls for 256 rows**, and +1 in the one-row cases. This is evidence for removing the empty tile-loop entry from scalar-only rows. Poll counts alone do not establish a percentage of wall time or prove they are the only cause of a regression.

For seven columns, a full four-lane tile is followed by three scalar reductions. Eight columns use two four-lane tiles. Both loop and reduction overhead contribute to that shape cliff; the counts support handling two of the remaining columns together, without relaxing arithmetic or padding contraction values.

## Worker granularity

Confirmation times for current SIMD code, again in **µs per sixteen-operation batch**:

| Case              |  Direct | 1 worker | 2 workers | 4 workers | 8 workers |
| ----------------- | ------: | -------: | --------: | --------: | --------: |
| scalar            |    4.17 |    11.17 |     25.25 |     34.33 |    113.12 |
| tiny-four         |    4.25 |    11.42 |     22.38 |     40.08 |    103.96 |
| row-eight         |   35.83 |    38.42 |     40.00 |     55.21 |    128.17 |
| tall-one          |  347.75 |   336.04 |    191.58 |    128.25 |    158.46 |
| tall-eight        | 1025.12 |  1004.17 |    529.75 |    293.50 |    250.50 |
| deep-eight        | 1788.92 |  1808.21 |    947.04 |    514.00 |    350.67 |
| square-ninety-six | 6233.08 |  6104.00 |   3201.38 |   1667.54 |   1000.46 |

Tiny and single-row work does not amortize task lifecycle/wakeup costs here. Larger kernels benefit from multiple workers. The best measured mode varies with shape; these observations do not define a portable scheduling threshold or authorize changing `spawn` semantics. Input sharing and the other parked pools also affect this experiment's environment.

## Full suite ratios

Speedup means pre-SIMD time divided by current time; values below 1 are slower. These ratios compare versions **within each experiment**.

| Case              | M×K×N     | Initial direct speedup | Confirmation direct speedup | Confirmation 4-worker speedup |
| ----------------- | --------- | ---------------------: | --------------------------: | ----------------------------: |
| control           | 0×0×0     |                  1.07× |                       1.03× |                         1.15× |
| deep-eight        | 4×8193×8  |                  2.44× |                       2.45× |                         2.32× |
| deep-seven        | 4×8193×7  |                  1.41× |                       1.44× |                         1.37× |
| empty-columns     | 3×9×0     |                  1.04× |                       1.00× |                         1.00× |
| empty-inner       | 3×0×7     |                  1.17× |                       1.15× |                         1.13× |
| empty-rows        | 0×9×7     |                  0.96× |                       0.99× |                         0.81× |
| rect-four         | 32×129×64 |                  2.55× |                       2.58× |                         2.38× |
| rect-next-tile    | 32×129×68 |                  2.61× |                       2.62× |                         2.46× |
| rect-tail-one     | 32×129×65 |                  2.53× |                       2.50× |                         2.37× |
| rect-tail-three   | 32×129×67 |                  2.35× |                       2.38× |                         2.28× |
| rect-tail-two     | 32×129×66 |                  2.39× |                       2.44× |                         2.29× |
| row-eight         | 1×513×8   |                  2.12× |                       1.92× |                         1.13× |
| row-four          | 1×513×4   |                  2.14× |                       2.30× |                         0.93× |
| row-one           | 1×513×1   |                  0.93× |                       1.02× |                         1.03× |
| row-seven         | 1×513×7   |                  1.29× |                       1.31× |                         1.14× |
| row-six           | 1×513×6   |                  1.52× |                       1.56× |                         0.93× |
| row-three         | 1×513×3   |                  1.10× |                       0.82× |                         0.96× |
| scalar            | 1×1×1     |                  0.99× |                       0.97× |                         1.14× |
| singleton-four    | 1×1×4     |                  1.11× |                       1.07× |                         1.09× |
| singleton-seven   | 1×1×7     |                  1.11× |                       1.06× |                         1.13× |
| square-eight      | 8×8×8     |                  1.99× |                       2.09× |                         1.12× |
| square-ninety-six | 96×96×96  |                  2.57× |                       2.58× |                         2.78× |
| square-thirty-two | 32×32×32  |                  2.60× |                       2.59× |                         2.03× |
| tall-eight        | 256×64×8  |                  2.54× |                       2.46× |                         2.35× |
| tall-four         | 256×64×4  |                  2.60× |                       2.48× |                         2.16× |
| tall-one          | 256×64×1  |                  0.90× |                       0.94× |                         1.00× |
| tall-seven        | 256×64×7  |                  1.51× |                       1.50× |                         1.46× |
| tall-three        | 256×64×3  |                  0.95× |                       0.98× |                         0.98× |
| tiny-five         | 1×3×5     |                  1.18× |                       1.18× |                         1.14× |
| tiny-four         | 1×3×4     |                  1.31× |                       1.20× |                         0.99× |
| tiny-one          | 1×3×1     |                  1.00× |                       1.02× |                         0.99× |
| tiny-seven        | 1×3×7     |                  1.16× |                       1.04× |                         0.92× |
| tiny-six          | 1×3×6     |                  1.17× |                       1.16× |                         1.07× |
| tiny-three        | 1×3×3     |                  0.97× |                       1.03× |                         1.11× |
| tiny-two          | 1×3×2     |                  1.00× |                       1.01× |                         1.05× |
| wide              | 8×64×256  |                  2.54× |                       2.58× |                         2.38× |
| wide-tail         | 8×64×257  |                  2.56× |                       2.55× |                         2.29× |

All 185 configurations, all worker modes, raw samples, process medians, correctness records, commands, and hashes are retained in both JSON reports. No fastest-run/minimum selection or performance threshold is used.

## Chosen next implementation

1. Dispatch scalar-only narrow outputs without entering an empty four-column loop on each row. Preserve empty-output behavior, faults, ownership, and cooperative cancellation in the useful loops.
2. Evaluate two-lane SIMD for two/three-column outputs and two/three-column tails. Each lane must retain the same separately rounded products and adjacent-pair tree; keep a one-column scalar remainder. Do not pad the contraction or introduce reassociation/FMA.
3. Reuse bounded invocation-local scratch and preserve allocation/failure cleanup. Quantify the scratch-size tradeoff for narrower tiles rather than assuming an unchanged byte footprint.
4. Re-run the existing 1,617 aggregate cases, 705 per-cell/shared cases, allocation failures, cancellation/ownership, ASan/UBSan, and TSan gates after changing the compiler, then repeat this shape suite against frozen codegen baselines.
5. Reassess larger M/N/K cache blocking after the narrow/tail gaps are addressed. The deep/wide gains alone do not identify a cache bottleneck or determine a good blocking size.

This is the plan for the next compiler change; no kernel dispatch or language semantics change is included in this benchmark commit.

## Reproduce

Generate the dynamic projection LLVM from `0fac4c0` with the pinned compiler if the saved pre-SIMD file is unavailable, then run from the current checkout:

```sh
python3 native/benchmarks/shapes.py \
  --baseline-llvm benchmarks/.build/native-cpu/kernels-before-simd.ll \
  --sanitize-check \
  --output benchmarks/results/native-shapes-2026-10-15.json
```

Use `--output benchmarks/results/native-shapes-2026-10-15-confirm.json` to retain a separate confirmation. Do not overwrite the initial report. Build artifacts live under ignored `benchmarks/.build/native-shapes/`. The [poll artifact](native-shapes-2026-10-15-polls.json) retains every build/query command, source hash, LLVM hash, and count for its independent diagnostic.

[Initial samples](native-shapes-2026-10-15.json) · [Confirmation samples](native-shapes-2026-10-15-confirm.json) · [Protocol](../../native/benchmarks/README.md#rectangular-tiny-and-tail-heavy-shapes)
