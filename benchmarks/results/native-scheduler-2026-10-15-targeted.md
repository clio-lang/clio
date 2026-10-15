# Targeted native worker/controller wakeups — 2026-10-15

The native runtime now separates worker and controller waiters. Workers receive targeted progress notifications; the drain controller is notified when its quiescence condition is satisfied. The measured default eight-worker, sixteen-task batch is **1.48× faster**, and the execution phase itself improves. Idle-operation/empty-drain suppression from the preceding step remains in place.

## Implementation and progress guarantees

Two condition variables share the existing scheduler mutex. Workers wait for activation/revision changes; the single controller waits for `!draining && !pumping && !preparing`. Worker notifications cannot be consumed by the controller, or vice versa.

- Nonempty drain activation broadcasts once to the worker pool. This preserves immediate overlap for long kernels and covers workers that start after the notification by checking state under the mutex.
- During active draining, ordinary progress signals one worker. The executing worker also continues its progress loop. A redundant second notification after a successful step is removed: the step's Pump already signals after unwinding its lease.
- The controller is signalled only when its quiescence predicate is true. This includes the final callback, cleanup, or construction lease returning after budget exhaustion stopped draining.
- Shutdown broadcasts to every worker, whether parked on activation or on a revision from an earlier drain. Workers need not wake just to park again at the end of draining; the next activation/shutdown wakes them.
- Single-worker host driving emits no condition-variable notifications. Idle host operations and empty drains remain silent.

Queue ordering, quotas, allocation policy, failure selection, cancellation, cached immutable outcomes, and source syntax are unchanged. This is a notification-routing change, not a lock-free queue or work-stealing implementation.

## Paired scheduler results

The baseline is the saved timing executable from `9d1aa8f`, immediately before this change. The normal timing harness is unchanged; new probe assertions/counters compile out of it. Each configuration runs in three fresh baseline/current process pairs, alternating order, after ten warmup batches per process. Each process records nine samples averaging ten batches each. The complete worker-count/capacity/yield grid and raw samples are retained.

Machine: Apple M2 Max, 8 performance plus 4 efficiency cores, 96 GiB RAM. Clang/LLVM 22.1.8, C++23, `-O2 -DNDEBUG`. Performance builds have no profiling/sanitizers. Pool creation/destruction are excluded. Values below are microseconds per **sixteen-task batch**, medians of the three process medians.

| Default 128 records / 32 groups, one resume/task | Before (µs) | After (µs) | Before / after |
| ------------------------------------------------ | ----------: | ---------: | -------------: |
| 1 worker                                         |       13.39 |      13.25 |          1.01× |
| 2 workers                                        |       36.66 |      30.51 |          1.20× |
| 4 workers                                        |       95.59 |      71.40 |          1.34× |
| 8 workers                                        |      185.68 |     125.50 |          1.48× |

The eight-worker process medians are 192.45, 184.50, 185.68 µs before and 119.97, 128.46, 125.50 µs after. Differences from earlier reports' baseline values reflect new measurements under uncontrolled desktop conditions; ratios here use the paired observations in this run.

### Default eight-worker phase timings

| Phase             | Before (µs) | After (µs) |
| ----------------- | ----------: | ---------: |
| Admission         |        2.11 |       1.59 |
| Execution / drain |      165.21 |     109.73 |
| Observation       |        8.41 |       5.44 |
| Close / drain     |        1.39 |       0.92 |
| Release           |        7.13 |       4.15 |

Phase medians are independently summarized and need not sum to the total median. This time, the main gain is in execution/drain, where the previous idle-wakeup optimization left the cost largely unchanged. Short threaded jobs remain slower than host-driven serial scheduling because the work itself is negligible.

### Yielding tasks at default capacity

| Eight resumes/task | Before (µs) | After (µs) |
| ------------------ | ----------: | ---------: |
| 1 worker           |       54.48 |      52.88 |
| 2 workers          |      208.67 |     110.60 |
| 4 workers          |      340.69 |     214.57 |
| 8 workers          |      424.50 |     343.96 |

More resumes exercise the active notification path more often. The results do not establish general source continuation or nested-task throughput: these are private C++ synthetic entries with unchanged frame/result allocation and checked results.

## Notification evidence and tests

The separate diagnostic build now records worker `notify_one`, worker `notify_all`, and controller `notify_one` calls, plus wait returns for each channel. Current aggregate notification/return counts must equal their role totals. The threaded diagnostic workload asserts exactly one worker broadcast for activation, a controller notification/return at quiescence, and no idle-phase notifications. Serial diagnostics assert zero notification calls.

For default eight-worker, one-resume diagnostics, the medians across three observations are **1 worker broadcast**, **32 single-worker signals**, and **1 controller signal**, with **1 controller wait return**. The preceding profile used around 50 broadcasts for that workload. Different notification kinds do not have equivalent cost, and these are separate instrumented observations, not performance samples.

All **39 tests pass**, including debug, optimized, ASan/UBSan, and separate TSan suites. New worker coverage repeatedly holds one polling callback active, submits two other tasks to an independent root, requires those tasks to overlap while spare workers had been parked, observes/releases that root, and cancels the original callback. The controller must finish and all resources must settle. Existing kernel overlap, held-completion/cleanup budget exhaustion, migration, nested progress, simultaneous faults, pinned reads, deadlines, and typed source recovery remain tested. Every benchmark batch validates returned values and zero retained resources.

## Generated numerical-kernel check

The saved baseline numerical executable also comes from `9d1aa8f`. Matrix lowering is unchanged. Both versions compile the same generated LLVM and runtime with `-O2 -ffp-contract=off`, preserving strict float32 and three managed allocations/releases per measured projection. Inputs and pools are warm; kernel compilation/startup are excluded. Each batch performs sixteen independent projection-plus-sum jobs.

| Workload / execution | Before (ms) | After (ms) |
| -------------------- | ----------: | ---------: |
| 8×8 / direct         |       0.028 |      0.028 |
| 8×8 / 8 workers      |       0.268 |      0.170 |
| 32×32 / direct       |       0.776 |      0.787 |
| 32×32 / 4 workers    |       0.279 |      0.269 |
| 32×32 / 8 workers    |       0.320 |      0.255 |
| 96×96 / direct       |      16.113 |     16.232 |
| 96×96 / 2 workers    |       8.890 |      9.340 |
| 96×96 / 4 workers    |       5.062 |      4.958 |
| 96×96 / 8 workers    |       2.966 |      2.628 |

For 96×96 with eight workers, the new process medians are 2.716, 2.567, 2.628 ms. That configuration improves in this run, while two workers are slower and direct/serial results are nearly unchanged. Do not treat every cell as an established regression/improvement or infer changed numerical code generation. Worker placement, mixed core types, frequency/thermal behavior, caches, and background activity remain uncontrolled; the full distributions are retained.

## Reproduce and next implementation

Save the preceding timing/kernel executables before rebuilding, then run:

```sh
python3 native/benchmarks/scheduler.py \
  --baseline benchmarks/.build/scheduler/timing-before-targeted \
  --output benchmarks/results/native-scheduler-2026-10-15-targeted.json
python3 native/benchmarks/run.py \
  --baseline benchmarks/.build/native-cpu/scaling-before-targeted \
  --output benchmarks/results/native-cpu-2026-10-15-targeted.json
```

Saved executables are ignored local artifacts; recreate them from `9d1aa8f`. Reports retain baseline/current executable hashes, measured source/compiler hashes, exact build commands, and all observations. Timings use medians, not minimum-sample selection. Diagnostic clocks/try-lock probes alter concurrency and overlapping wait durations cannot be converted into a percentage wall-time breakdown. There are no performance assertions in CTest.

The capacity controls still show full-table work matters: compact tables are faster, but lowering quotas would change useful admission behavior. Next replace repeated ready-table sweeps with bounded runnable tracking, preserving fairness, queue-full progress, stale-handle protection, execution leases, cancellation, and nested waits. Maintenance scans are a separate subsequent target. Keep this same grid and the generated kernels as comparison controls.

[Scheduler raw comparison](native-scheduler-2026-10-15-targeted.json) · [Numerical raw comparison](native-cpu-2026-10-15-targeted.json) · [Protocol/counter definitions](../../native/benchmarks/README.md#scheduler-diagnostics)
