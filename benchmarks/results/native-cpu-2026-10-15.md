# Native CPU scaling — 2026-10-15

The generated CPU kernels scale when each task has enough work. Tiny tasks lose to scheduling overhead. This is a baseline for the fresh native implementation, not a language ranking or a comparison with the JavaScript prototype.

Machine: Apple M2 Max, 12 logical CPUs (8 performance and 4 efficiency), 96 GiB RAM, macOS ARM64. Clang/LLVM 22.1.8; generated code and runtime both `-O2`, strict float32 arithmetic with contraction disabled. The raw file records the exact OS, commands, compiler/source/LLVM hashes and baseline revision. The harness was newly added on top of that revision; its hashes identify the measured uncommitted files.

## Warmed batch results

Each batch contains **sixteen** independent square matrix multiplications followed by reductions. Times are milliseconds per batch, median of three fresh-process medians (nine samples per process after three warmups). Pools and inputs already exist. Direct calls include invocation cleanup; task measurements include admission, execution, result observation, and complete group cleanup.

| Workload                | Direct sequential | Serial scheduler | 2 workers | 4 workers | 8 workers |
| ----------------------- | ----------------: | ---------------: | --------: | --------: | --------: |
| Constant-result control |             0.001 |            0.018 |     0.075 |     0.164 |     0.402 |
| 8×8 projection + sum    |             0.062 |            0.074 |     0.141 |     0.214 |     0.439 |
| 32×32 projection + sum  |             1.346 |            1.349 |     0.835 |     0.550 |     0.609 |
| 96×96 projection + sum  |            25.737 |           25.442 |    14.044 |     7.703 |     4.494 |

For 96×96, eight workers take **4.49 ms versus 25.74 ms directly**, about **5.73×** the throughput for this batch. The three eight-worker process medians are 4.44, 4.49, 4.57 ms; individual batches range from 4.09 to 6.05 ms. Peak-running statistics reach eight callbacks. This establishes useful overlap for this kernel on this machine, not linear scaling or a universal eight-worker optimum.

At 32×32, four workers are faster than eight (about 2.45× direct throughput). At 8×8, even two workers are slower than direct calls. The constant-result control exposes task-lifecycle cost without numerical work; its eight-worker batches are hundreds of microseconds. Increasing the worker count blindly is not a useful default for tiny jobs. Small direct-versus-serial differences are not evidence of a faster arithmetic backend: both execute the same kernel, and their context/cancellation paths and cache conditions differ.

## Allocation evidence and next implementation step

Untimed invocation counters report:

| Matrix dimension | Managed allocations per kernel | Releases after settlement |
| ---------------- | -----------------------------: | ------------------------: |
| 8                |                             66 |                        66 |
| 32               |                          1,026 |                     1,026 |
| 96               |                          9,218 |                     9,218 |

These counts equal `dimension² + 2`. The lowering allocates a balanced-reduction scratch buffer inside each output-cell computation, plus the output tensor and final reduction scratch. At 96×96, one batch therefore makes **147,488 managed allocations**. This is a concrete allocation-pressure problem; these measurements do not isolate the fraction of time spent in the allocator.

Next, reuse reduction scratch within an invocation, keeping it private to that invocation/worker. Preserve separately rounded products, the balanced adjacent reduction tree, empty/singleton behavior, shape/allocation failures, loop polling, and full cleanup on cancellation. Run numerical, fault-injection, and sanitizer conformance before comparing these same workloads. Do not replace the reduction with a sequential accumulator or silently enable fast math.

Scheduling is a second target: the runtime scans bounded task/group tables under one mutex and performs per-task frame/result allocation. The constant-result control shows the aggregate cost, but does not distinguish scans, lock contention, allocator work, or thread wakeups. Profile those separately before choosing a queue/metadata redesign. Source-generated continuations, retained tensor packet transfer, and nested scheduling still need their own workloads.

## Startup, validation, and limits

- Core construction with 1 worker: median 0.035 ms across three processes.
- Core construction with 2 workers: median 0.052 ms across three processes.
- Core construction with 4 workers: median 0.062 ms across three processes.
- Core construction with 8 workers: median 0.085 ms across three processes.

These construction samples include metadata setup and thread creation requests, but not guaranteed worker readiness. One-worker mode creates no background thread. Warmups account for readiness before batch timing. Compilation/linking took 1.26 seconds in this run and is excluded, as are process launch, input initialization/reference calculation, and pool destruction. There is no JIT.

Every scalar result, including warmups, matched an independently calculated reference. Inputs remained unchanged; scheduler bytes, backing owners, unfinished work, records, and groups returned to zero after every batch. The harness and generated kernel also ran under ASan/UBSan separately; sanitized timings are excluded.

No CPU affinity, frequency/thermal control, or background-process isolation was applied. Inputs are nonuniform but reused, so this is a warmed cache/allocator experiment. Multiple pools remain idle while another configuration runs. Tensor inputs are immutable host buffers, not transported source task packets. The C++ entry adapter calls real generated LLVM kernels, but source-level continuation overhead and whole-program compiler optimization are outside this benchmark. Nothing here measures BLAS competitiveness, GPU speed, remote services, memory peak, or cancellation latency.

[Raw measurements](native-cpu-2026-10-15.json) · [Protocol and reproduction](../../native/benchmarks/README.md)
