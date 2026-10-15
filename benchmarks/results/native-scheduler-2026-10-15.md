# Native small-task scheduler profile — 2026-10-15

The measurements identify two separate targets: full-table scanning in serial scheduling, and coordination overhead with several workers. Frame/result allocation remains a possible later target, but these observations do not justify starting with an allocator or lock-free queue rewrite. **No scheduling optimization or default-capacity reduction is implemented in this step.**

## Experiment

Each batch submits sixteen tasks returning 1, observes every result, closes the root group, and releases all resources. Tasks either complete in one resume or yield seven times before completing (eight resumes per task). Only sixteen records and one group are live. Worker counts and spare record/group capacity vary independently; other admission/queue/byte limits stay at their defaults. One-worker mode drives on the host.

Machine: Apple M2 Max, 12 logical CPUs, 96 GiB RAM; Clang 22.1.8, C++23, `-O2 -DNDEBUG`. Timing uses **no profiling probes or sanitizers**. Each configuration gets three fresh processes, ten warmup batches per process, and nine samples averaging ten batches each. Configuration order is deterministically shuffled across passes. Tables report the median of the three process medians, in microseconds per **sixteen-task batch**. One core/pool exists per process; creation/destruction are excluded. Phases include necessary result/failure checks. Resource-statistics scans are after the final timestamp.

A separate instrumented process creates a fresh core and executes one diagnostic batch. It records primary table visits, allocation/free counts, explicit lock contention, broadcasts, and condition-variable waits. Those diagnostics include initial worker parking and use clocks/try-lock probes that affect scheduling. Their durations are **not** performance samples or a wall-time breakdown.

## Capacity controls: one resume per task

| Records / groups | 1 worker | 2 workers | 4 workers | 8 workers |
| ---------------- | -------: | --------: | --------: | --------: |
| 16 / 1           |     6.58 |     45.95 |    119.13 |    342.99 |
| 128 / 1          |    12.77 |     61.01 |    156.68 |    367.59 |
| 16 / 32          |     7.96 |     50.43 |    129.72 |    328.21 |
| 128 / 32         |    14.11 |     64.88 |    162.41 |    355.35 |
| 1024 / 256       |    94.89 |    188.01 |    327.47 |    622.34 |

With one worker, moving from default 128/32 slots to compact 16/1 slots changes the batch from **14.11 to 6.58 µs**. The independent 128/1 and 16/32 controls show that record capacity has the larger effect here. The 1024/256 control is substantially slower despite identical admitted work. This demonstrates sensitivity to table capacity/scanning/cache effects, not a need for smaller admission quotas.

With eight workers, the compact control still takes **342.99 µs** versus **355.35 µs** at default capacity. Its coordination cost remains large even after greatly reducing table sizes. Small nonmonotonic differences between threaded controls should not be ranked as established improvements. The default eight-worker process medians are 340.92, 365.12, 355.35 µs.

## Uninstrumented phase timings at default capacity

| Phase             | 1 worker (µs) | 8 workers (µs) |
| ----------------- | ------------: | -------------: |
| Admission         |          0.95 |          60.84 |
| Execution / drain |          8.36 |         157.91 |
| Observation       |          1.31 |          78.19 |
| Close / drain     |          0.76 |          26.49 |
| Release           |          2.40 |          26.05 |

Phases are summarized independently; their medians need not sum to the total median. The host performs admission before enabling drain, and observation after execution reaches quiescence. Those phases nevertheless become much more expensive with idle worker threads present. Source inspection explains a plausible mechanism: each guarded operation increments the revision and calls `notify_all`, including admission and observation while the pool is not draining. Idle workers wake to re-check the same predicate and compete with the host for the shared mutex. Also, close/drain currently enables workers even when there is no unfinished task work.

The phase/capacity controls and probe observations support testing that mechanism next. They do not isolate OS context switches, wakeup cost, mutex implementation, or each cause's exact contribution.

## Probe evidence

For the default one-worker, one-resume diagnostic batch, all three observations agree:

- 16 task resumes and publications; 32 frame/result allocation attempts and 32 frees.
- 53 maintenance passes: **6,784 primary record visits**, **1,696 primary group visits**, plus **2,304 ready-table visits**.
- 165 probed explicit lock acquisitions, none contended; 69 `notify_all` calls, with no worker threads to wake.

These scan counters exclude nested owner/child scans, admission searches, reclamation scans, and statistics. They are a lower bound on examined slots. Compact 16/1 capacity reduces the primary scans to 848 record and 53 group visits, with 288 ready-table visits, for the same sixteen completed tasks. The 1024/256 control increases them to 54,272 record, 13,568 group, and 18,432 ready visits. Allocation attempts stay at 32 throughout.

For eight workers at default capacity, the three diagnostic observations have median counts of 89 broadcasts, 18 contended explicit acquisitions, and 84 condition-variable returns. A return may be spurious or lead straight back to waiting; a broadcast is not a count of actual woken threads. These are observations from instrumented execution, not counts inferred from the latency samples.

`lockWaitNs` excludes condition-variable reacquisition and const inspection locks. `waitNs` includes reacquisition/startup and only completed waits. Intervals overlap between threads. Allocator brackets cover frame/result malloc/free only and omit timer overhead calibration, core/thread allocation, invocation initialization, and callbacks. **Do not sum these durations or divide them by uninstrumented wall time to assign percentages.**

## Yielding tasks

| Default 128/32 capacity | 1 resume/task (µs) | 8 resumes/task (µs) |
| ----------------------- | -----------------: | ------------------: |
| 1 worker                |              14.11 |               53.36 |
| 2 workers               |              64.88 |              238.44 |
| 4 workers               |             162.41 |              406.54 |
| 8 workers               |             355.35 |              619.20 |

Yielding tasks still allocate only one frame and one result per task, but increase scheduler steps/scans and notifications. These synthetic entries exercise resumption rather than source-generated await dependencies or nested groups. There is no useful numerical work here; this is not evidence against the large-kernel parallel throughput measured separately.

## Next implementation

First suppress unnecessary idle-worker broadcasts and avoid waking the pool for an empty drain. Keep revision/state changes under the existing mutex. Preserve wakeups needed by the active controller, running/cleaning/preparing tasks, cancellation, budget exhaustion, quiescence, and shutdown. Do not blindly skip every notification when `draining == false`: a controller may still be waiting for callbacks/cleanup to finish after draining stops.

Run the existing execution-lease, bounded-drain, nested-group, concurrent cancellation/deadline, pinned-read, and sanitizer suites. Compare this same phase/capacity grid before/after, plus real numerical kernels. Only then decide whether the remaining cost calls for active-record tracking or targeted dependency queues. Do not lower quotas merely to improve a benchmark, inline tasks in a way that changes isolation/cancellation behavior, or add an allocator cache before measuring its effect.

All **39 native tests pass**, including a new profiled-runtime TSan regression checking resume/publication counts, allocation/free balance, scans, repeated yields, and zero retained resources. After simplifying the profile API to a cumulative snapshot, its affected TSan test passed again. Ordinary timing binaries omit the private profiling API and probes.

No CPU pinning, frequency/thermal control, timer subtraction, or background-process isolation was used. Phase timestamps and validation add overhead, and diagnostics perturb concurrency. These limitations make the findings a guide to the next controlled change, not an exact cost model or an optimized scheduler result.

[Reproduction and counter definitions](../../native/benchmarks/README.md#scheduler-diagnostics) · [Raw samples and probes](native-scheduler-2026-10-15.json)
