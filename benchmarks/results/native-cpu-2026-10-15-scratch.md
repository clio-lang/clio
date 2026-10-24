# Matrix reduction scratch reuse — 2026-10-15

The native compiler now uses one reduction scratch buffer per matrix multiplication instead of allocating it for every output cell. Each operation owns its buffer within its invocation; different tasks never share it. On the measured projection-plus-sum workload, managed allocations per kernel fall from **9,218 to 3** at 96×96.

## Same-session comparison

The saved executable from the [initial baseline](native-cpu-2026-10-15.md) and the rebuilt executable run alternately in fresh processes: before/after, after/before, before/after. The baseline LLVM hash was checked against the initial report before preserving the executable. The C++ benchmark harness, numerical fixture, runtime source, optimization flags, and worker/table settings are unchanged; the compiler lowering changed. The runner now retains both executable hashes and both sets of samples.

Machine: Apple M2 Max, 8 performance and 4 efficiency cores, 96 GiB RAM. Clang/LLVM 22.1.8, strict float32, `-O2 -DNDEBUG -ffp-contract=off`, no sanitizers in performance builds. Each cell below is milliseconds for **sixteen** independent matrix multiplications plus reductions. Each version uses three fresh processes, three warmups per configuration/workload, and nine shuffled timed rounds per process; reported values are medians of process medians. Pools and inputs are already initialized. Admission, execution, result observation, and complete group cleanup are included for scheduled calls.

| Workload / execution     | Before (ms) | Scratch reuse (ms) | Before / after |
| ------------------------ | ----------: | -----------------: | -------------: |
| 8×8 / direct             |       0.064 |              0.029 |          2.18× |
| 8×8 / serial scheduler   |       0.075 |              0.045 |          1.65× |
| 8×8 / 2 workers          |       0.140 |              0.110 |          1.27× |
| 8×8 / 4 workers          |       0.211 |              0.192 |          1.10× |
| 8×8 / 8 workers          |       0.427 |              0.464 |          0.92× |
| 32×32 / direct           |       1.427 |              0.777 |          1.84× |
| 32×32 / serial scheduler |       1.402 |              0.752 |          1.86× |
| 32×32 / 2 workers        |       0.858 |              0.482 |          1.78× |
| 32×32 / 4 workers        |       0.561 |              0.348 |          1.62× |
| 32×32 / 8 workers        |       0.562 |              0.486 |          1.16× |
| 96×96 / direct           |      27.016 |             16.412 |          1.65× |
| 96×96 / serial scheduler |      26.493 |             16.076 |          1.65× |
| 96×96 / 2 workers        |      13.937 |              8.868 |          1.57× |
| 96×96 / 4 workers        |       7.562 |              5.108 |          1.48× |
| 96×96 / 8 workers        |       4.695 |              3.249 |          1.44× |

For the 96×96 batch, direct execution drops from **27.02 to 16.41 ms** (1.65× throughput), and eight-worker execution from **4.69 to 3.25 ms** (1.44× throughput). The new eight-worker process medians are 3.19, 3.54, 3.25 ms. The new eight-worker/direct ratio is 5.05×. These are different comparisons: the first two assess this compiler change, while the last assesses worker scaling with the new kernel.

The constant-result control contains no generated matrix computation. Its eight-worker median is 0.407 ms before and 0.424 ms after. Small control differences and tiny threaded-kernel differences reflect an unchanged scheduler and uncontrolled desktop conditions; this change does not solve small-task overhead. Four workers still beat eight at 32×32. Do not interpret every table cell as a statistically established improvement.

## Allocation and correctness evidence

| Matrix dimension | Before: allocations/kernel | After: allocations/kernel | After: releases/kernel |
| ---------------- | -------------------------: | ------------------------: | ---------------------: |
| 8                |                         66 |                         3 |                      3 |
| 32               |                      1,026 |                         3 |                      3 |
| 96               |                      9,218 |                         3 |                      3 |

The measured batch now establishes 48 managed ownership entries rather than 147,488 at 96×96. These counters describe generated managed buffers, not all allocations in the process or peak memory. Allocation count no longer grows with the number of output cells.

The compiler creates scratch before the serial row/column loops and carries the output tensor through those loops for in-place bufferization. It does not capture mutable scratch inside `tensor.generate`, whose cells could later be lowered independently. Empty outputs use zero-length scratch and skip the row loop, so an enormous unused extent does not trigger scratch-size overflow or an enormous empty loop. This change combines scratch reuse, explicit serial output loops, and hoisting scratch-size checks; the timings do not isolate allocator time alone.

Separately rounded float32 products and balanced adjacent reductions are unchanged, including odd tails, zero extents, signed zero, infinities, and NaNs. Scratch stays under the existing checked invocation ownership ledger. Loop cancellation polling remains in generated code; faults/cancellation still settle all owned storage.

All **38 CTest tests pass**, including debug, optimized, ASan/UBSan, and separate TSan suites. They cover 49 numerical cases and 1,029 runtime shape/content cases per sequential build variant, repeated calls, unchanged inputs, every remaining allocation-failure position, retained parent data, source task recovery, real multi-worker kernels, and in-loop cancellation/deadlines. The new regression gate checks bounded allocation counts across repeated odd-sized contractions and adds a huge-row empty-output case. Every performance sample also validates results and quiescent resource cleanup.

## Reproduce and next step

Use the [benchmark protocol](../../native/benchmarks/README.md), saving the baseline executable before rebuilding the compiler:

```sh
python3 native/benchmarks/run.py \
  --baseline benchmarks/.build/native-cpu/scaling-before-scratch \
  --output benchmarks/results/native-cpu-2026-10-15-scratch.json
```

The saved executable is a local ignored build artifact; build the baseline revision first to recreate it. The original baseline is rooted at `c9b07a6`; `8cff6ea` adds the identical benchmark harness without changing the compiler/runtime. The comparison JSON records baseline/current executable hashes, the current compiler and lowering source hashes, exact build commands, and all raw samples.

These remain warmed microbenchmarks with shared immutable host inputs and a private C++ task adapter. They do not measure source-generated continuation overhead or packet transport. CPU affinity, frequency, thermal state, and background activity are uncontrolled. No GPU, remote service, BLAS comparison, or whole-language performance claim follows.

Next profile the small-task scheduler path: distinguish table scans, lock/wakeup costs, and per-task allocations before changing queue or metadata structures. Keep this kernel and numerical contract fixed for that comparison.

[Raw before/after samples](native-cpu-2026-10-15-scratch.json)
