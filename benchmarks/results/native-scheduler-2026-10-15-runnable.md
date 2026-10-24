# Bounded native runnable tracking — 2026-10-15

Follow-up: [occupancy-indexed maintenance](native-scheduler-2026-10-15-maintenance.md) reduces the remaining capacity scans. This report retains the earlier observations.

The scheduler no longer scans the entire record table to rediscover runnable tasks before each dispatch. Admission completion, wait wakeups, and execution-lease return now update the ready structures explicitly. A bounded deferred FIFO retains already-admitted continuations when the configured ready ring is full.

The measured gains are strongest with large tables and frequent yields. The serial 1024-record/eight-resume batch improves from **484 to 220 µs** (about **2.19×** throughput). Default-capacity changes are smaller, and large numerical-kernel timings are mixed. This is not a general CPU-kernel speedup claim.

## Tracking and admission behavior

The ready ring keeps its configured size and generation-tagged handles. Each record can be in the ring or deferred FIFO at most once. Intrusive previous/next links, allocated with the record table, bound deferred storage by record count without transition-time allocation. Immediate ring placement avoids the deferred links when there is space and no older deferred continuation. Promotion/unlink is constant work per moved record; whole scheduler steps still include maintenance scans.

Execution leases remain decisive: a yield or dependency wake observed while a callback is executing does not enqueue that frame until its callback returns. Cancellation marks eligible deferred tasks for their normal cancellation dispatch, without duplicating entries. Membership is removed before settlement/reconstruction, and ring handles still validate generations. Stats now expose ready and deferred counts, which must both reach zero at quiescence.

Promotion happens before dispatch and after callback/settlement, **not immediately after popping a task and before invoking it**. The dispatch vacancy must remain available for nested spawning with `ready=1`. A new admission can use that real ring vacancy even if older continuations are deferred, preserving existing admission checks. Concurrently constructed tasks can also defer after already being admitted. FIFO order applies among deferred continuations; this is not a new global order guarantee for parallel task execution. Queue, record, group, in-flight, and byte limits are not increased. Extra links are control-table metadata, excluded from the existing frame/result byte quota.

## Paired scheduler results

The baseline timing executable was saved from `684a72a`. The normal timed workload is unchanged; current quiescent queue-count checks are after the final timestamp. Each configuration runs in three fresh baseline/current process pairs, alternating order. Ten warmup batches precede nine samples averaging ten batches each; configuration order is deterministically shuffled. Values are microseconds per **sixteen-task batch**, median of the three process medians. Pool creation/destruction are excluded.

Machine: Apple M2 Max (8 performance plus 4 efficiency cores), 96 GiB RAM, Clang/LLVM 22.1.8, C++23, `-O2 -DNDEBUG`, no probes/sanitizers in timings.

| Records / groups, workers, resumes/task | Before (µs) | After (µs) | Before / after |
| --------------------------------------- | ----------: | ---------: | -------------: |
| 16/1, 1 worker, 1                       |        6.92 |       6.18 |          1.12× |
| 128/32, 1 worker, 1                     |       13.26 |      11.71 |          1.13× |
| 128/32, 2 workers, 1                    |       32.04 |      28.03 |          1.14× |
| 128/32, 4 workers, 1                    |       58.80 |      62.23 |          0.94× |
| 128/32, 8 workers, 1                    |      116.45 |     110.00 |          1.06× |
| 128/32, 1 worker, 8                     |       53.74 |      37.65 |          1.43× |
| 128/32, 8 workers, 8                    |      345.60 |     293.13 |          1.18× |
| 1024/256, 1 worker, 1                   |       95.58 |      52.70 |          1.81× |
| 1024/256, 1 worker, 8                   |      483.85 |     220.46 |          2.19× |
| 1024/256, 8 workers, 8                  |     1233.05 |     771.68 |          1.60× |

The complete 40-configuration grid, process medians, phase samples, and probes are retained in JSON. The default eight-worker result is a modest difference and should not be sold as a strong general improvement. Large spare capacity still costs time through primary maintenance, nested owner/dependency, admission, and reclamation scans that this change deliberately leaves intact.

## Event evidence and regression gates

In the separate current diagnostic build, every flat batch asserts **zero ready-table visits**. Sixteen one-resume tasks produce exactly 16 runnable events and 16 ring pushes; eight resumes per task produce exactly 128 of each. At the default capacities these flat cases need no deferred FIFO entries. Diagnostic counters separately retain `pendingPromotions` and `peakPending`. Primary record/group maintenance visits remain nonzero. No clock probe or scan counter is used to infer a percentage wall-time breakdown.

All **39 native tests pass**, covering debug, optimized, ASan/UBSan, and separate TSan variants. Expanded worker tests force the deferred path: three callbacks hold yield leases while a fourth task fills a one-slot ready ring. Returning the leases creates exactly three deferred continuations. The tests check FIFO progress, no early frame reentry, unchanged full-queue rejection on an independent root, cancellation/deadlines across ready/deferred work, and slot reuse with rejected stale handles. Ready/deferred resource counts return to zero in addition to existing frame/result/owner/group checks.

The existing depth-12 one-slot nested-spawn chain is also required. It exposed why the popped ring vacancy must not be refilled until the callback has had the opportunity to spawn. Both immediate-await and yield-before-await forms pass with the final promotion policy. Source continuations/recovery, cached outcomes, nested groups, active admissions, held-budget/cleanup wakeups, and generated numerical cancellation also pass.

## Numerical controls, including confirmation

Numerical LLVM is unchanged and each measured projection still establishes/releases three managed allocations. The saved numerical baseline also comes from `684a72a`; both versions use generated code/runtime `-O2 -ffp-contract=off`. Inputs, pools, and allocator state are warmed. Each batch contains sixteen matrix projections followed by reductions; results, unchanged inputs, and cleanup are validated.

The first large eight-worker timing was slower, so one confirmation experiment was retained rather than replacing that result. Both runs use three paired fresh-process trials and retain all samples. Values below are milliseconds per batch.

| Workload / execution | First before | First after | Confirmation before | Confirmation after |
| -------------------- | -----------: | ----------: | ------------------: | -----------------: |
| 8×8 / direct         |        0.028 |       0.028 |               0.029 |              0.030 |
| 8×8 / 8 workers      |        0.181 |       0.160 |               0.160 |              0.165 |
| 32×32 / direct       |        0.771 |       0.791 |               0.794 |              0.784 |
| 32×32 / 4 workers    |        0.281 |       0.276 |               0.271 |              0.268 |
| 32×32 / 8 workers    |        0.248 |       0.241 |               0.248 |              0.241 |
| 96×96 / direct       |       16.127 |      16.343 |              16.307 |             16.434 |
| 96×96 / 1 workers    |       15.683 |      15.767 |              15.946 |             16.016 |
| 96×96 / 2 workers    |        8.644 |       8.996 |               9.127 |              9.328 |
| 96×96 / 4 workers    |        5.061 |       5.069 |               5.066 |              5.100 |
| 96×96 / 8 workers    |        2.910 |       3.121 |               3.091 |              3.033 |

At 96×96/eight workers, the first comparison is **2.910 → 3.121 ms**; the confirmation is **3.091 → 3.033 ms**. The first current process medians are 3.177, 3.121, 2.757 ms, and the confirmation current medians are 3.025, 3.033, 3.073 ms. These observations do not establish a consistent large-kernel improvement or regression. Two-worker timings are also mixed. No fastest-run/minimum selection or numerical fast-math change is used to present a gain.

CPU affinity, mixed core placement, thermal/frequency state, background activity, and caches are uncontrolled. The extra record links change metadata layout, and the new continuation order may affect runtime behavior; further controlled profiling would be needed to attribute small throughput differences. Correctness/ownership/cancellation gates are separate from timing observations.

## Reproduce and next step

Save the preceding executables before rebuilding, then run:

```sh
python3 native/benchmarks/scheduler.py \
  --baseline benchmarks/.build/scheduler/timing-before-runnable \
  --output benchmarks/results/native-scheduler-2026-10-15-runnable.json
python3 native/benchmarks/run.py \
  --baseline benchmarks/.build/native-cpu/scaling-before-runnable \
  --output benchmarks/results/native-cpu-2026-10-15-runnable.json
```

The numerical confirmation uses the same command with `--output benchmarks/results/native-cpu-2026-10-15-runnable-confirm.json`. Saved executables are ignored local artifacts; recreate them from `684a72a`. Reports record executable/compiler/source hashes, exact commands, platform details, and complete paired observations. There are no performance thresholds in CTest.

Next reduce primary maintenance scans while preserving waiting-task/group wakeups, descendant settlement, cancellation, execution/cleanup leases, and the narrow-ring promotion/admission behavior above. Use the same capacity/yield grid and numerical controls to separate that change's effects.

[Scheduler samples](native-scheduler-2026-10-15-runnable.json) · [First numerical samples](native-cpu-2026-10-15-runnable.json) · [Confirmation samples](native-cpu-2026-10-15-runnable-confirm.json) · [Protocol](../../native/benchmarks/README.md#scheduler-diagnostics)
