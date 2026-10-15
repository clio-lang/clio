# Idle-worker notifications and empty drains — 2026-10-15

The next [targeted-wakeup comparison](native-scheduler-2026-10-15-targeted.md) measures separate worker/controller notification channels.

The native runtime now avoids broadcasts to fully idle workers and avoids activating the pool for an empty drain. The default eight-worker, sixteen-task batch improves by about **2.2×** in the same-session comparison. Most of the recovered time is outside task execution; the active execution phase still needs work.

## Runtime change and safety

Guarded state changes still advance the revision under the scheduler mutex. A broadcast is emitted only while `draining`, `controlling`, or `stopping` is true. Idle admission, cached-result observation, and release no longer wake workers that can only wait for drain activation/shutdown. Active worker notifications remain unchanged.

The controller flag is essential: draining may stop after budget exhaustion while execution/construction/cleanup leases remain active. Their completion must still wake the blocked controller. Shutdown always wakes workers. Empty drains first perform maintenance, then return without activating workers only when unfinished work, pumping, and preparation are all zero. Closed empty groups and pending settlement are still processed. Queues, capacities, admission rules, cancellation, cached results, arithmetic, and source syntax are unchanged.

## Paired scheduler measurements

Machine: Apple M2 Max, 12 logical CPUs (8 performance and 4 efficiency), 96 GiB RAM. Clang/LLVM 22.1.8, C++23, `-O2 -DNDEBUG`, probes/sanitizers disabled for timings. The saved pre-change timing executable was built at `7319f3d`; its hash is recorded in the comparison JSON. The normal timing harness/workload is unchanged; new assertions exist only in its separate profiled build.

Each batch completes sixteen constant-result tasks. Each configuration runs in three fresh baseline/current process pairs with alternating order. Each process creates one persistent pool, warms up with ten batches, and records nine samples averaging ten batches each. Configuration order is shuffled deterministically. Results are medians of process medians, in microseconds per **batch**. Pool startup/teardown are excluded. Full phase/raw data and the capacity/yield grid are retained.

| Default 128 records / 32 groups | Before (µs) | After (µs) | Before / after |
| ------------------------------- | ----------: | ---------: | -------------: |
| 1 worker                        |       13.68 |      14.17 |          0.97× |
| 2 workers                       |       64.41 |      36.31 |          1.77× |
| 4 workers                       |      158.64 |     101.82 |          1.56× |
| 8 workers                       |      386.05 |     175.10 |          2.20× |

The eight-worker process medians are 365.58, 386.74, 386.05 µs before and 180.38, 174.82, 175.10 µs after. Serial scheduling is essentially unchanged, including a small slowdown in this observation; the change targets idle-worker coordination, not serial arithmetic or allocation.

### Eight-worker phases

| Phase             | Before (µs) | After (µs) |
| ----------------- | ----------: | ---------: |
| Admission         |       69.91 |       2.08 |
| Execution / drain |      162.95 |     157.53 |
| Observation       |       78.02 |       8.24 |
| Close / drain     |       26.85 |       1.32 |
| Release           |       25.67 |       6.46 |

Phase medians are independently summarized and need not sum to the total median. Admission happens before workers are activated; observation/release happen after execution reaches quiescence. Their large reductions support the specific idle-notification mechanism identified in the initial profile. Execution/drain remains almost unchanged, which narrows the next target rather than suggesting the entire scheduling problem is solved.

### Yielding tasks and spare capacity

| Default capacities, eight resumes/task | Before (µs) | After (µs) |
| -------------------------------------- | ----------: | ---------: |
| 1 worker                               |       53.71 |      52.94 |
| 2 workers                              |      234.55 |     207.22 |
| 4 workers                              |      411.62 |     346.29 |
| 8 workers                              |      631.98 |     430.57 |

Table-capacity controls remain in the raw report (16/1, 128/1, 16/32, 128/32, 1024/256). Quotas were not reduced to achieve the improvement. Larger unused tables still cost time, and compact tables still leave substantial threaded overhead. Yielding tasks benefit less because more time is inside active execution, where broad notifications/scans are retained.

## Diagnostic and conformance evidence

The profiled harness now asserts that an initially empty drain and the admission/observation/close/release phases emit **zero** broadcasts. It still verifies sixteen completions, the expected resume count, exactly 32 frame/result allocations and frees, and zero retained resources. Current diagnostics include an extra initial empty-drain proof (one maintenance pass); those probe counts should not be compared as if the diagnostic call sequences were identical.

Default eight-worker diagnostics record a median 50 actual broadcasts for the one-resume workload, versus 89 in the initial profile. These are separate instrumented runs, not timing samples. Active execution still generates broadcasts. Probe clocks, lock contention, overlapping waits, and startup observations retain the limits documented in the [protocol](../../native/benchmarks/README.md#scheduler-diagnostics); no percentage cost breakdown is inferred from them.

All **39 CTest tests pass**, including ASan/UBSan and separate TSan suites. Expanded worker conformance repeats empty drains and closed-empty-root release, plus one-step-budget drains while yield/completion/cleanup leases are held. Controllers must wait for lease return, receive the completion wakeup even after draining stops, preserve results, and settle all resources. Existing cancellation/deadline, pinned-read, fault isolation, nested-group, and generated numerical tests also pass.

## Generated numerical-kernel check

The numerical harness also alternates saved/current native executables. Its baseline retains the same scratch-reuse kernels from `e16e962`; the intervening profiling step did not change numerical lowering. It performs sixteen projection-plus-sum jobs per batch with inputs and pools warm. Both kernel/runtime use `-O2 -ffp-contract=off`, with strict float32 and no profiling/sanitizers in timings. Each table cell is milliseconds per batch, median of three fresh-process medians; all results/inputs and resource cleanup are validated.

| Workload / execution | Before (ms) | After (ms) |
| -------------------- | ----------: | ---------: |
| 8×8 / direct         |       0.029 |      0.030 |
| 8×8 / 8 workers      |       0.432 |      0.226 |
| 32×32 / direct       |       0.818 |      0.797 |
| 32×32 / 4 workers    |       0.369 |      0.303 |
| 32×32 / 8 workers    |       0.558 |      0.326 |
| 96×96 / direct       |      16.596 |     16.311 |
| 96×96 / 4 workers    |       5.497 |      5.263 |
| 96×96 / 8 workers    |       3.427 |      3.153 |

Matrix allocation counts remain three managed allocations/releases per projection. Small threaded numerical jobs improve with the removed coordination overhead; the larger kernel remains dominated by computation. Small differences in large-kernel timings are not evidence of changed numerical lowering or a universal speedup. Raw samples retain dispersion and all other configurations.

## Reproduce and next step

Save the pre-change executables before rebuilding, then run:

```sh
python3 native/benchmarks/scheduler.py \
  --baseline benchmarks/.build/scheduler/timing-before-wakeups \
  --output benchmarks/results/native-scheduler-2026-10-15-wakeups.json
python3 native/benchmarks/run.py \
  --baseline benchmarks/.build/native-cpu/scaling-before-wakeups \
  --output benchmarks/results/native-cpu-2026-10-15-wakeups.json
```

The saved executables are ignored local artifacts; rebuild the named baseline revisions to recreate them. Reports record binary/compiler/source hashes and exact build commands. This remains an uncontrolled desktop experiment: no CPU pinning, frequency/thermal control, minimum-sample selection, or timer subtraction. There are no performance assertions in CTest.

Next reduce coordination during active execution. The phase evidence supports investigating targeted worker/controller wakeups before a broad queue rewrite, while retaining budget, quiescence, cancellation, construction, and cleanup guarantees. Table scans remain a separate subsequent target. Keep the same small-task grid and generated kernels as controls.

[Scheduler raw comparison](native-scheduler-2026-10-15-wakeups.json) · [Generated-kernel raw comparison](native-cpu-2026-10-15-wakeups.json) · [Initial scheduler profile](native-scheduler-2026-10-15.md)
