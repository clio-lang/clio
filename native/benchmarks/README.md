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
