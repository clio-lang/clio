# Native scheduler: skip task maintenance when no task needs it

The small-table, repeated-yield regression is resolved in the paired measurements. With sixteen records, one group, one worker, and eight resumes per task, a sixteen-task batch goes from **16.04 → 9.18 µs**. The older build before occupancy indexing takes **11.69 µs** in the same three-way experiment. Default and large-capacity yield-heavy cases improve too; this is not a claim that every configuration or numerical kernel gets faster.

## Shipped implementation

A mutex-protected `maintenanceTasks` counter tracks records in WaitingTask, WaitingGroup, or Settling. Wait entry increments it; wakeup decrements it. Constructor failure enters settlement and increments it. `finish` increments only when the task was not already waiting/settling, so failure of a waiting task preserves its membership. Publication decrements after execution and cleanup leases unwind. Cached rejection records are already settled and do not participate. Quiescent task/worker checks require a zero count alongside existing resource counts.

Group maintenance always runs first. If the counter is zero afterward, maintenance skips the primary task scan. Prepared, runnable, running, and settled tasks cannot advance that phase. Group changes still drive the existing repeat-until-stable loop. If any task needs maintenance, the same occupancy-indexed task traversal and shared wait/settlement/cleanup logic runs. A waiting callback and a completion held during cleanup remain counted even before their leases unwind. All counter changes happen under the scheduler mutex; no new per-transition allocation or synchronization primitive is needed.

Bitmap advance also returns the requested occupied slot immediately, avoiding a bit-position decode along contiguous runs. Sparse traversal still skips empty words and preserves increasing slot order. Queue capacity, admission/rejection, ready/deferred promotion, group settlement, generation checks, immutable outcomes, and cancellation/publication rules are unchanged. Remaining live-entry passes, bitmap-word traversal, and separate admission/statistics/destruction scans remain costs.

## Three-way scheduler comparison

Controls are saved executables from **`4e90847`** (immediately preceding indexed maintenance) and **`e3caba7`** (before occupancy indexing). Their hashes match the corresponding preceding reports. The timing workload remains sixteen independent scalar tasks, one or eight resumes per task. Additional 32/1 and 33/1 controls extend the old 40-configuration grid to 56 configurations.

Each configuration runs in three fresh reference/baseline/current process sets. The runner rotates execution order so each version runs in each of the three positions. Configuration order is deterministically shuffled. Each process warms ten batches, then records nine samples averaging ten batches each. Values are microseconds per sixteen-task batch, median of the three process medians. Pool startup/destruction, compilation, diagnostic clocks, and quiescent stats checks are excluded.

Apple M2 Max, 8 performance plus 4 efficiency cores, 96 GiB RAM; Clang/LLVM 22.1.8, C++23, `-O2 -DNDEBUG`. No profiling or sanitizers in timings. Correctness suites stopped before measurement; scheduler and numerical benchmarks ran sequentially.

| Records/groups, workers, resumes/task | Before indexing (µs) | Indexed baseline (µs) | Final (µs) | Baseline / final |
| ------------------------------------- | -------------------: | --------------------: | ---------: | ---------------: |
| 16/1, 1, 1                            |                 6.58 |                  6.96 |       5.81 |            1.20× |
| 16/1, 2, 1                            |                15.47 |                 15.01 |      15.91 |            0.94× |
| 16/1, 4, 1                            |                34.07 |                 43.00 |      33.65 |            1.28× |
| 16/1, 8, 1                            |                83.12 |                 88.11 |      82.84 |            1.06× |
| 16/1, 1, 8                            |                11.69 |                 16.04 |       9.18 |            1.75× |
| 16/1, 2, 8                            |                33.18 |                 42.30 |      28.53 |            1.48× |
| 16/1, 4, 8                            |                72.02 |                 92.96 |      60.43 |            1.54× |
| 16/1, 8, 8                            |               228.00 |                228.10 |     206.92 |            1.10× |
| 32/1, 1, 8                            |                14.92 |                 16.93 |       9.08 |            1.86× |
| 33/1, 1, 8                            |                14.65 |                 16.80 |       9.28 |            1.81× |
| 128/32, 1, 1                          |                12.14 |                  7.32 |       6.16 |            1.19× |
| 128/32, 1, 8                          |                38.94 |                 17.27 |       9.38 |            1.84× |
| 128/32, 8, 8                          |               285.42 |                249.24 |     223.54 |            1.11× |
| 1024/256, 1, 8                        |               220.12 |                 22.12 |      13.16 |            1.68× |
| 1024/256, 8, 8                        |               766.09 |                259.46 |     218.37 |            1.19× |

The full 56-configuration grid, phase samples, and process medians are retained in JSON. The targeted yield-heavy minimum-table case improves about 43% relative to the indexed baseline and about 21% relative to the older pre-index build. Some short multi-worker cases remain mixed: 16/1 with two workers and one resume is slightly slower here. Coordination, core placement, and scheduling noise still matter. There is no hard performance threshold or universal speedup claim.

## Initial experiment retained

The first experiment selected a contiguous task scan for tables of at most 32 slots when at least half were unfinished. It retained occupancy indexes for larger/sparse tables, and used the same occupied-bit shortcut as the final version. It only partly recovered the dense-table regression:

| Initial contiguous scan, 1 worker / 8 resumes | Before indexing (µs) | Indexed baseline (µs) | Initial experiment (µs) |
| --------------------------------------------- | -------------------: | --------------------: | ----------------------: |
| 16 records / 1 group                          |                11.66 |                 15.92 |                   14.29 |
| 32 records / 1 group                          |                14.44 |                 16.54 |                   17.22 |

This variant is not the shipped traversal. The final approach skips scans without waiting/settling tasks instead of choosing a table-size threshold. The [initial scheduler samples](native-scheduler-2026-10-15-dense-initial.json), [initial numerical samples](native-cpu-2026-10-15-dense-initial.json), and [source patch against 4e90847](native-scheduler-2026-10-15-dense-initial.patch) are retained. Applying that patch to a temporary source tree reconstructs every measured initial scheduler source hash. Compare versions within each experiment; the initial and final measurements were taken at different times.

## Diagnostic evidence

Separate instrumented single-worker observations for all capacities show:

| Resumes/task | Maintenance passes | Task scans | Skipped task scans | Task entries visited | Live group entries visited |
| ------------ | -----------------: | ---------: | -----------------: | -------------------: | -------------------------: |
| 1            |                 53 |         16 |                 37 |                  136 |                         52 |
| 8            |                277 |         16 |                261 |                  136 |                        276 |

The indexed baseline examined 408 task entries for one resume and 3,992 for eight resumes. The final version examines 136 in either case: yields with no waiters/settlements do not trigger another task sweep. Group maintenance remains active. Probe `taskPasses` plus `idleTaskPasses` equals total maintenance passes. Empty-core drains visit no task/group entries. Flat batches still establish/free 32 frame/result allocations, publish 16 outcomes, and enqueue/push exactly once per resume with zero ready-table sweeps.

Visit counts exclude bitmap-word reads, nested owner/child scans, admission, disposal, stats inspection, and other scheduler work. They cannot be used to infer a percentage wall-time breakdown. Diagnostic clocks/counters are absent from timing executables.

## Correctness and numerical controls

All **39 native tests pass**, including debug, optimized, ASan/UBSan, and separate ThreadSanitizer coverage of runtime and generated code. Expanded nested chains cover capacities 16/32/33/128 and depths 12/20/70 where allowed, with a one-slot ready ring and both immediate-await and yield-before-await forms. Deterministic tests check waiter-count entry, child-publication wakeup, cancellation/deadline wakeups, and complete cleanup. Held yield/completion leases and active admissions run with four slots as well as default capacity. A held completion remains counted before publication; a yielded task does not. Existing sparse high-word reuse, rejection rollback, pinned reads, failure recovery, generated-loop cancellation, and allocation-failure suites remain gates.

Generated numerical LLVM remains byte-identical to the indexed baseline. Nonempty projections still establish/release three managed allocations; the constant control uses zero. Numerical controls use three paired fresh baseline/current processes, warmed inputs/pools/allocator state, nine shuffled samples per case, and `-O2 -ffp-contract=off`. Each batch contains sixteen projections and reductions. Results, unchanged inputs, and resource cleanup are independently checked.

| Matrix size / execution | Indexed baseline (ms) | Final (ms) |
| ----------------------- | --------------------: | ---------: |
| 0×0 / 1 workers         |                0.0085 |     0.0091 |
| 0×0 / 8 workers         |                0.0988 |     0.0848 |
| 8×8 / direct            |                0.0319 |     0.0280 |
| 8×8 / 8 workers         |                0.1270 |     0.1349 |
| 32×32 / direct          |                0.7686 |     0.7800 |
| 32×32 / 4 workers       |                0.2402 |     0.2306 |
| 32×32 / 8 workers       |                0.2167 |     0.2111 |
| 96×96 / direct          |               16.1799 |    16.2249 |
| 96×96 / 1 workers       |               15.7050 |    15.8487 |
| 96×96 / 2 workers       |                8.2092 |     8.1819 |
| 96×96 / 4 workers       |                5.0506 |     5.0113 |
| 96×96 / 8 workers       |                2.7051 |     2.6179 |

The 0×0 case is the constant scheduler control. Numerical results are mixed and do not establish a general kernel throughput gain. For example, the small eight-worker case is slower even though the targeted scheduler microbenchmark improves. CPU affinity, mixed core placement, thermal/frequency state, caches, binary layout, and background activity are uncontrolled. All observations are retained, without fastest-run selection or changed arithmetic semantics.

## Reproduce and next work

Save executables from the preceding commits before rebuilding (the saved paths are ignored local artifacts):

```sh
python3 native/benchmarks/scheduler.py \
  --baseline benchmarks/.build/scheduler/timing-before-dense \
  --reference benchmarks/.build/scheduler/timing-before-maintenance \
  --output benchmarks/results/native-scheduler-2026-10-15-dense.json
python3 native/benchmarks/run.py \
  --baseline benchmarks/.build/native-cpu/scaling-before-dense \
  --output benchmarks/results/native-cpu-2026-10-15-dense.json
```

Use `4e90847` for the baseline executables and `e3caba7` for the older reference. JSON retains exact commands, machine details, compiler/executable/source hashes, phases, and raw observations. The optional reference requires a distinct saved executable and rotates process order only in three-way mode; existing two-way comparisons retain alternating order.

Next target CPU kernel SIMD and tiling while preserving separately rounded products, deterministic balanced reductions, cancellation polling, allocation bounds, and ownership. Further scheduler work should be justified by measured application costs rather than extending the microbenchmark optimization indefinitely. GPU and remote execution retain their separate design/capability gates.

[Final scheduler samples](native-scheduler-2026-10-15-dense.json) · [Final numerical samples](native-cpu-2026-10-15-dense.json) · [Protocol](../../native/benchmarks/README.md#scheduler-diagnostics)
