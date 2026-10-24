# Native scheduler: occupancy-indexed maintenance

Follow-up: [task-maintenance fast path](native-scheduler-2026-10-15-dense.md) addresses the small-table regression. This report retains the preceding measurements.

Primary maintenance now skips empty reserved slots and already-settled task records. At the default 128-record/32-group capacity, the paired single-worker sixteen-task batch improves **11.99 → 6.99 µs**. At 1024/256 with eight resumes per task it improves **226.69 → 22.36 µs**. Fully occupied minimum-size tables show a bookkeeping regression; this is not an across-the-board speedup.

## Implementation and bounds

Three mutex-protected bitmaps track live tasks (including emergency rejection records), unfinished normal tasks, and live groups. Core creation allocates their fixed storage. Setting/clearing membership requires no transition-time allocation. At default capacities the bitmap payload totals 48 bytes; at 1024/256 it totals 320 bytes, excluding vector objects/allocator overhead. Like record/group tables, this control metadata is outside the existing frame/result byte quota. Creation still fails cleanly if allocation fails.

Admission sets membership before construction unlocks. Publication removes unfinished membership only after execution/cleanup leases unwind. Disposal removes live membership before record/group reconstruction and generation advancement. Primary maintenance uses unfinished tasks and live groups; nested owner/child checks, cancellation propagation, and disposal use indexed live entries. Increasing slot order preserves the previous sweep order. Each advance reads the current bitmap under the mutex, including after unlocked destructors allow unrelated admissions/reclamation. No mutable list cursor is carried across a callback.

This is an occupancy index, not a dependency subscription system. Empty bitmap words still require traversal, and repeated maintenance passes still revisit live entries. Admission free-slot searches, public statistics collection, and core destruction retain separate table scans. Queue quotas, deferred FIFO promotion, narrow-ring spawning, generation checks, read/cleanup leases, cached outcomes, and cancellation/publication semantics are unchanged.

## Paired scheduler results

Baseline executables were saved from `e3caba7`; their SHA-256 values match the current executables retained in the preceding runnable-tracking reports. Current timing and profile builds use the same batch workload. New diagnostic occupancy assertions are outside timing and are compiled only in the profile build.

Apple M2 Max, 8 performance plus 4 efficiency cores, 96 GiB RAM; Clang/LLVM 22.1.8, C++23, `-O2 -DNDEBUG`. Each of 40 configurations runs in three fresh baseline/current process pairs, alternating order across trials and shuffling configurations. Ten warmed batches precede nine samples averaging ten batches each. Values are microseconds per sixteen-task batch, median of three process medians. Pool startup/destruction and probe clocks are excluded.

| Records / groups, workers, resumes/task | Before (µs) | After (µs) | Before / after |
| --------------------------------------- | ----------: | ---------: | -------------: |
| 128/32, 1, 1                            |       11.99 |       6.99 |          1.71× |
| 128/32, 2, 1                            |       28.03 |      17.57 |          1.60× |
| 128/32, 4, 1                            |       57.58 |      34.79 |          1.66× |
| 128/32, 8, 1                            |      111.56 |      95.69 |          1.17× |
| 128/32, 1, 8                            |       38.15 |      16.14 |          2.36× |
| 128/32, 2, 8                            |       80.00 |      42.45 |          1.88× |
| 128/32, 4, 8                            |      165.81 |      84.12 |          1.97× |
| 128/32, 8, 8                            |      286.32 |     251.99 |          1.14× |
| 1024/256, 1, 1                          |       52.92 |      10.59 |          5.00× |
| 1024/256, 8, 1                          |      255.60 |      99.38 |          2.57× |
| 1024/256, 1, 8                          |      226.69 |      22.36 |         10.14× |
| 1024/256, 8, 8                          |      770.49 |     250.04 |          3.08× |

The full grid and phase samples are retained in JSON. Sparse, larger-capacity configurations benefit most. The default eight-worker gains are smaller because worker coordination still contributes substantial overhead.

### Dense minimum-capacity tradeoff

| Workers, resumes/task (16 records / 1 group) | Before (µs) | After (µs) |
| -------------------------------------------- | ----------: | ---------: |
| 1, 1                                         |        6.23 |       6.86 |
| 1, 8                                         |       11.65 |      16.23 |
| 2, 8                                         |       31.44 |      41.25 |
| 4, 8                                         |       65.44 |      80.30 |
| 8, 8                                         |      229.71 |     244.43 |

With sixteen occupied records and a single group, the previous contiguous sweeps were cheap. Bitmap iteration and membership updates cost more in several configurations, especially repeated yields. The one-worker/eight-resume batch regresses about 39% (4.58 µs per batch). This remains a measured limitation; the benefit of spare capacity should not be presented as free. Density-aware traversal is a possible follow-up if these workloads warrant it.

## Diagnostic evidence and correctness gates

Separate instrumented single-worker observations retain 53 maintenance passes for one resume per task and 277 for eight resumes. The initial empty-core drain now examines zero task/group entries.

| Capacity, resumes/task | Previous primary task visits | Current primary task visits | Previous primary group visits | Current primary group visits |
| ---------------------- | ---------------------------: | --------------------------: | ----------------------------: | ---------------------------: |
| 128/32, 1              |                        6,784 |                         408 |                         1,696 |                           52 |
| 128/32, 8              |                       35,456 |                       3,992 |                         8,864 |                          276 |
| 1024/256, 1            |                       54,272 |                         408 |                        13,568 |                           52 |
| 1024/256, 8            |                      283,648 |                       3,992 |                        70,912 |                          276 |

Previous counts come from the preceding runnable-tracking diagnostic report; current counts come from this report. Counters still mean primary task/group entries examined, but now exclude empty slots and settled task records. They exclude bitmap-word reads, nested passes, admission, disposal, statistics inspection, and other scheduler work. They cannot establish a percentage wall-time breakdown. Flat batches still assert zero ready sweeps, 32 allocations/frees, 16 publications, and exactly one runnable event/ring push per resume. The test also bounds primary visits by sixteen unfinished tasks and one live group per pass.

All **39 native tests pass**, including debug, optimized, ASan/UBSan, and separate ThreadSanitizer coverage of runtime and generated code. Expanded tests cross bitmap boundaries: depth-70 one-slot nested chains exercise task/group waits both with and without yielding before awaiting. Sparse-slot tests leave five unfinished tasks and groups above slot 64 after reclaiming lower slots, then check cancellation, deadlines, high emergency rejection records, repeated reuse, and stale handles. Existing concurrent construction/cleanup, pinned readers, active admissions, bounded-drain leases, deferred FIFO, source recovery, generated numerical cancellation, and allocation-failure tests remain gates. The deep-chain test explicitly raises depth, group, and in-flight quotas to exercise depth 70 without changing runtime defaults.

## Numerical controls

Generated numerical LLVM remains byte-identical to the preceding report. Every nonempty projection still establishes/releases three managed allocations; the constant control uses zero. Inputs, results, and complete resource cleanup are validated independently of timings. Sixteen projections and reductions form each batch. Three fresh paired baseline/current processes run warmed, shuffled direct and 1/2/4/8-worker cases using `-O2 -ffp-contract=off`.

| Matrix size / execution | Before (ms) | After (ms) |
| ----------------------- | ----------: | ---------: |
| 8×8 / direct            |      0.0278 |     0.0328 |
| 8×8 / 1 workers         |      0.0414 |     0.0386 |
| 8×8 / 8 workers         |      0.1517 |     0.1341 |
| 32×32 / direct          |      0.8017 |     0.7863 |
| 32×32 / 4 workers       |      0.2363 |     0.2426 |
| 32×32 / 8 workers       |      0.2323 |     0.2237 |
| 96×96 / direct          |     16.2354 |    16.2068 |
| 96×96 / 1 workers       |     16.0576 |    15.9045 |
| 96×96 / 2 workers       |      8.3322 |     8.0969 |
| 96×96 / 4 workers       |      5.0289 |     4.6234 |
| 96×96 / 8 workers       |      2.5735 |     2.6219 |

Large numerical workloads are broadly similar and do not establish a general kernel speedup. The direct 8×8 control is slower despite bypassing task scheduling; numerical LLVM and the invocation runtime source are unchanged. Core placement, thermal/frequency state, caches, binary layout, and background activity are uncontrolled. No fastest-run selection or performance assertion is used. All raw observations are retained; the large-kernel differences do not justify attributing a throughput gain to this change.

## Reproduce and next work

Save the preceding executables before rebuilding (or recreate them from `e3caba7`):

```sh
python3 native/benchmarks/scheduler.py \
  --baseline benchmarks/.build/scheduler/timing-before-maintenance \
  --output benchmarks/results/native-scheduler-2026-10-15-maintenance.json
python3 native/benchmarks/run.py \
  --baseline benchmarks/.build/native-cpu/scaling-before-maintenance \
  --output benchmarks/results/native-cpu-2026-10-15-maintenance.json
```

Saved executables are ignored local artifacts. JSON retains source/compiler/executable hashes, commands, machine details, phases, and complete paired observations. Measurements were taken after correctness suites stopped, with scheduler and numerical experiments run sequentially. CTest has no timing thresholds.

Further scheduler optimization should weigh the measured dense-table tradeoff and remaining live-dependency passes against real numerical workload costs. CPU kernel optimization and later GPU/remote backends retain their separate conformance and capability gates.

[Scheduler samples](native-scheduler-2026-10-15-maintenance.json) · [Numerical samples](native-cpu-2026-10-15-maintenance.json) · [Protocol](../../native/benchmarks/README.md#scheduler-diagnostics)
