# Native CPU scaling benchmark

This measures the fresh C++/LLVM implementation, separately from the released JavaScript prototype's [language comparisons](../../benchmarks/README.md). See the [initial report](../../benchmarks/results/native-cpu-2026-10-15.md) and [scratch reuse comparison](../../benchmarks/results/native-cpu-2026-10-15-scratch.md).

Build the compiler first, then run:

```sh
cmake --preset native
cmake --build --preset native --parallel 2
python3 native/benchmarks/run.py
```

Python 3 and the pinned Clang/LLVM installation are required. Neither Bun nor Node is needed. Optional arguments select `--compiler`, `--clang`, and `--output`. The default output is `benchmarks/results/native-cpu-YYYY-MM-DD.json`; another run on the same day overwrites it. Build artifacts live in ignored `benchmarks/.build/native-cpu/`. Run with other CPU-heavy work stopped.

The runner compiles the existing dynamic projection fixture with `--test-entry reference -O2`, then compiles its emitted LLVM, the C++ harness, and runtime together with Clang `-O2 -DNDEBUG -ffp-contract=off`. Thus the normal Debug CMake runtime archive is **not** the measured runtime. Compilation/linking are timed separately. There is no LTO, fast math, sanitizer, BLAS, or GPU in the performance build.

## Measurement

Each batch performs sixteen identical, independent operations: multiply two square float32 matrices, then sum the resulting matrix. Dimensions are 8, 32, and 96. A separate dimension-zero control returns the constant 1 without entering a generated kernel; it measures the same task lifecycle with negligible computation, not empty-matrix semantics.

Inputs are initialized at runtime with nonuniform, exactly representable binary fractions. An independent double-precision triple loop calculates the expected scalar. For these inputs/sizes the generated balanced float32 reductions must equal the rounded reference exactly. Every result is checked after timing, including all warmups, and inputs are checked unchanged after each workload. Every batch also checks that scheduler-owned bytes, tensor owners, unfinished work, task records, and groups return to zero. Allocation/release counts come from an untimed diagnostic invocation; no atomic poll-observation probes are enabled.

The five configurations are direct sequential calls and TaskCore with 1, 2, 4, and 8 workers. **One worker uses the host-driven serial scheduler; it does not create a background thread.** Larger configurations create persistent background pools. Every batch uses a fresh root group on its existing pool. Pool construction and input/reference setup are outside the timed batches. Construction samples include thread creation requests, not a guarantee that every idle worker has reached its wait; warmups precede measurements. Teardown is also excluded.

Timing includes invocation setup/cleanup for direct calls. Scheduled batches include group creation, synchronous packet construction, admission, execution, result copying/observation, group close/drain, and release. Failure checks necessary to consume the results are inside this interval; numerical equality and quiescent resource checks are outside it. The scheduler uses default table/queue budgets. Kernel inputs are shared immutable host buffers that outlive every task; this does not measure tensor packet transport or retained ownership across a source-level spawn.

Each fresh process runs three warmup batches per configuration and nine measured rounds per workload. Configuration order is deterministically shuffled within each round. Three independent processes repeat this protocol. Tables report the median of the three process medians. JSON retains all 27 batch samples per cell, each process median, extrema, startup observations, allocation counters, cumulative peak-running/frame-result-byte statistics, toolchain/build commands, source/compiler/LLVM hashes, revision, and worktree status. Processes and workloads run sequentially. No CPU pinning, frequency control, timer subtraction, GC, or minimum-sample selection is used.

This benchmarks real generated numerical code behind a private C++ TaskEntry adapter. It does **not** time source-generated spawn/await continuation machinery, nested scheduling, cancellation latency, remote/GPU execution, or compare against another language. There is no JIT; warmups address pool readiness, allocator state, and caches. Desktop scheduling, mixed performance/efficiency cores, thermal behavior, and the tiny sample times limit generalization. No performance thresholds are added to CTest.

## Compare a compiler change

Save the baseline executable before rebuilding the compiler, then pass that copy to the runner:

```sh
# After running the baseline version of the suite:
cp benchmarks/.build/native-cpu/scaling benchmarks/.build/native-cpu/scaling-baseline
# Make the compiler change, then rebuild it:
cmake --build --preset native --parallel 2
python3 native/benchmarks/run.py \
  --baseline benchmarks/.build/native-cpu/scaling-baseline \
  --output benchmarks/results/native-cpu-comparison.json
```

Use matching harness/workloads/runtime build options in both binaries. The runner rejects using the output executable itself as the baseline, since compilation overwrites that file. It runs baseline/current, current/baseline, baseline/current as sequential fresh-process pairs, retaining both sets of samples and executable hashes. This alternation reduces ordering bias; it does not control CPU placement or thermal state. Compiler lowering and checked-ABI source hashes are also recorded for the current build. Keep the original baseline report to identify its source/toolchain/LLVM provenance. An existing saved executable is optional; ordinary single-version runs still work.

## Scheduler diagnostics

See the [initial scheduler profile](../../benchmarks/results/native-scheduler-2026-10-15.md) and [idle-wakeup comparison](../../benchmarks/results/native-scheduler-2026-10-15-wakeups.md).

```sh
python3 native/benchmarks/scheduler.py
```

This separate C++ runtime benchmark requires only Python and the pinned Clang; it does not compile a numerical program or need Bun/Node. It builds a normal `-O2` timing executable and a second executable with `KALANDRA_TASK_PROFILE`. All runtime translation units and the harness use the same macro setting. The probes and private `TaskProfile` API are absent from ordinary builds. CTest separately validates the profiling build under TSan.

Each batch admits sixteen tasks returning 1, either in one resume or after seven yields (eight resumes total per task). The host separately times admission, execution/drain, result observation, close/drain, and group release. Numerical assertions and zero-resource checks validate every batch. Results are checked during observation, so that check is included in the observation phase. Resource-statistics scans occur after the final timestamp. Both tasks and tables remain bounded; no quota is exhausted.

The controls use 1/2/4/8 workers and seven record/group capacities: 16/1, 32/1, 33/1, 128/1, 16/32, default 128/32, and 1024/256. Earlier reports used five, omitting 32/1 and 33/1. Queue, in-flight, depth, and byte budgets remain at their defaults. Only sixteen records and one root group are live, so the spare capacity changes scanning/cache costs without changing the submitted work. One worker still drives on the host. This is neither source-generated continuation throughput nor useful numerical work.

Three shuffled passes run each configuration in its own process, with one core/pool at a time. Each timing process warms up with ten batches, then records nine samples, each the arithmetic mean of ten batches. Reports use the median of the three process medians of total batch time. Each phase is summarized independently; phase medians need not sum exactly to the total median. Timer calls add overhead and no empty-timer subtraction is applied. Pool creation/destruction are excluded. Diagnostic processes are separate: one fresh core executes one batch and checks resume/publication, allocation/free, scan, and cleanup invariants. They include initial worker startup/parking observations. No diagnostic duration is used as a performance sample.

Probe meanings and limits:

- `recordVisits`/`groupVisits` count entries examined by primary maintenance passes. Historical reports count all reserved slots per pass; occupancy-indexed maintenance counts unfinished tasks and live groups. Calls with no waiting or settling tasks now skip the task scan; `taskPasses` and `idleTaskPasses` separate executed and skipped task scans and sum to `maintenancePasses`. Neither includes bitmap-word traversal, nested child/owner scans, cancellation propagation, admission searches, disposal scans, or statistics inspection. Compare these as examined-record counts, not complete scheduler operations. `readyVisits` counts full ready-table sweeps in historical reports; it is zero with event-based runnable tracking. Current probes also count `runnableEvents`, `readyPushes`, `pendingPromotions`, and `peakPending` (actual deferred backlog, excluding immediate ring placement). They establish a lower bound on entries examined.
- `locks` counts guarded mutation acquisitions, initial worker acquisitions, and explicit reacquisitions after callbacks. It excludes const inspection locks, the snapshot lock, stop locks, and condition-variable reacquisitions. `contendedLocks` means `try_lock` failed; summed `lockWaitNs` measures the subsequent blocking acquisitions, with probe overhead.
- `notifications` counts actual notify calls, not actual woken threads. Current diagnostics split these into `workerSignals` (`notify_one`), `workerBroadcasts` (`notify_all`), and `controllerSignals` (`notify_one`); historical reports before targeted wakeups used broadcasts only. `workerWaitReturns` and `controllerWaitReturns` split the completed waits by channel. Wait/return counts include spurious wakes and initial parking. `waitNs` sums completed condition-variable wait intervals, including mutex reacquisition and startup; outstanding waits have no completed duration yet.
- `allocationAttempts`/`frees` concern scheduler frame/result buffers. `allocatorNs` brackets their malloc/free calls, excluding invocation owners, core/table/vector/thread allocations, user allocators, context initialization, and cleanup callbacks.

Clock probes and `try_lock` change scheduling in the diagnostic build. Per-thread wait intervals overlap and must not be added together, divided by uninstrumented wall time, or presented as a percentage breakdown. Use event counts, uninstrumented phase timings, and capacity controls together to select the next experiment. Detailed OS profiling is still needed to attribute thread wakeups versus context switches. Raw observations, build commands, source hashes, machine metadata, and summaries are retained in `benchmarks/results/native-scheduler-YYYY-MM-DD.json` (overwritten on another run that day).

For a scheduler before/after comparison, save `benchmarks/.build/scheduler/timing` before changing the runtime, then pass the saved copy and a distinct report path:

```sh
cp benchmarks/.build/scheduler/timing benchmarks/.build/scheduler/timing-baseline
# Change/rebuild the runtime, then:
python3 native/benchmarks/scheduler.py \
  --baseline benchmarks/.build/scheduler/timing-baseline \
  --output benchmarks/results/native-scheduler-comparison.json
```

The runner rebuilds both current timing/profiling executables, then alternates saved/current and current/saved process order across the three passes for each configuration. Baseline and current phase samples, summaries, and executable hashes are retained together. A saved executable must use the same timing harness/workloads. `--output` defaults to the dated scheduler report; use a distinct path to preserve an earlier baseline. The updated diagnostic harness also asserts that idle admission, observation, close/release, and an initially empty drain emit no broadcasts. Its extra initial empty-drain proof is outside performance timing; it contributes one maintenance pass to current diagnostic scan counts.

The targeted-wakeup regression additionally checks one worker broadcast per nonempty drain activation (none for serial driving), no single-worker notification calls, and a controller wake/return on the threaded diagnostic drain. The worker and controller notification totals must sum to the aggregate. Timing binaries compile out these assertions and all probe counters. See the [targeted-wakeup comparison](../../benchmarks/results/native-scheduler-2026-10-15-targeted.md) for the next native-only before/after experiment.

The [bounded runnable tracking comparison](../../benchmarks/results/native-scheduler-2026-10-15-runnable.md) removes ready sweeps while retaining primary maintenance scans. Current diagnostic flat batches assert zero ready visits and exactly one enqueue/ring push per task resume. Runtime tests separately force a one-slot ring with a deferred backlog. Quiescent checks now require ready, deferred, and waiting/settling maintenance counts to be zero. These added checks and probes do not enter the measured timing interval.

The [occupancy-indexed maintenance comparison](../../benchmarks/results/native-scheduler-2026-10-15-maintenance.md) skips empty slots and settled task records in primary maintenance, and indexes live entries for nested checks, failure propagation, and reclamation. Bitmap storage is fixed at core creation; word traversal and remaining live-entry passes are still work.

The [task-maintenance fast-path comparison](../../benchmarks/results/native-scheduler-2026-10-15-dense.md) adds 32/1 and 33/1 capacity controls to the existing grid. Pass `--reference` alongside `--baseline` to compare an older saved executable too; the runner rotates reference/baseline/current order over three trials so each runs in every process position. It retains reference samples, phase summaries, and the reference executable hash separately. The additional modes use the same sixteen-task workload and warmup/sampling protocol.
