# GPU reduction scratch reuse

The managed Metal reduction now retains at most two private output buffers per invocation. Each tree level still has a separate immutable count word and compute encoder. The shader, adjacent-pair arithmetic tree, strict software binary32 arithmetic, odd-element carry, scalar readback and source syntax are unchanged. This optimization reduces allocation work and live temporary bytes; it does not batch dispatches or fuse arithmetic.

## Memory and lifetime

For at least three inputs, the outputs occupy `4 * (ceil(n / 2) + ceil(n / 4))` bytes. A two-element input needs one four-byte output; singleton input only needs the scalar readback; empty input submits no command. Later levels alternate the two outputs, whose initial capacities suffice as lengths shrink. The original input is never overwritten. Separate ordered encoders use Metal's default tracked resource dependencies for each reuse.

For 65 inputs, output scratch falls from 280 to 200 bytes. Including seven count words and scalar staging, temporary bytes fall from **312 to 232**. For 1,048,576 inputs, the calculated temporary requirement falls from **4,194,384 to 3,145,812 bytes**, saving 1,048,572 bytes (about 25%). Temporary Metal buffers fall from 41 to 23 for that size. These are managed requested-byte counts, excluding the input, host backing, pipeline/driver overhead and allocator granularity; they are not process RSS measurements.

Scratch belongs to each invocation and remains retained through command acknowledgement. Cancellation suppresses publication and waits for acknowledgement; it does not preempt the GPU. Conformance now checks exact live bytes and buffer counts, simultaneous reductions with different lengths, cancellation of one while the other completes, pending core destruction, and every command preparation allocation/encoder checkpoint. An exact 1,024-byte budget succeeds and one extra held byte causes a clean budget failure. The existing 570-case, 3,264,973-element CPU/GPU/APFloat corpus passes in debug, optimized, host ASan/UBSan and host TSan variants, with immutable inputs and zero numerical mismatches. Metal API validation is enabled for conformance; host sanitizers do not instrument GPU/driver execution or the prebuilt LLVM reference.

The full native regression suite passes **119/119 tests in 389.06 seconds**. [Qualification evidence](../../native/metal-proof/evidence/gpu-reduction-reuse-2026-10-15.json) records source/artifact hashes and scope.

## Warm measurements

Measured on Apple M2 Max, macOS ARM64, with the pinned LLVM/Metal toolchain. [Raw observations](native-gpu-2026-10-15-reduction-reuse.json) retain commands, hashes and per-process samples. Baseline is the preserved runtime from `7d2c1cc`, using the same benchmark harness, CPU module and shader sources. Its saved binary and libraries match the artifact hashes in the preceding [selection run](native-gpu-2026-10-15-selection.json). Current source hashes identify the uncommitted implementation measured before this commit. No benchmark source changed.

Three fresh process pairs alternate baseline/current, current/baseline, baseline/current. Each configuration has two excluded warmups and seven measured calls per process; modes and workloads are shuffled with matched seeds. All nine workloads and four modes are retained: 1,512 timed calls plus 432 warmups across both implementations. Every result is checked after timing. Offline compilation, runtime/pipeline setup and reference construction are excluded. No JIT, sanitizers, Metal validation or timing probes are enabled in performance builds. This is one local experiment, not a statistical guarantee across devices or workloads.

Times below are milliseconds, median of the three process medians:

| Workload    | Mode      | Before |  After |
| ----------- | --------- | -----: | -----: |
| sum-1048576 | cpu       | 1.5490 | 1.5886 |
| sum-1048576 | device    | 0.3292 | 0.3514 |
| sum-1048576 | resident  | 0.5759 | 0.4928 |
| sum-1048576 | transfers | 1.2719 | 1.2077 |
| sum-4097    | cpu       | 0.0080 | 0.0077 |
| sum-4097    | device    | 0.2130 | 0.2133 |
| sum-4097    | resident  | 0.3015 | 0.2878 |
| sum-4097    | transfers | 0.4895 | 0.4782 |
| sum-64      | cpu       | 0.0005 | 0.0005 |
| sum-64      | device    | 0.1942 | 0.1948 |
| sum-64      | resident  | 0.2348 | 0.2397 |
| sum-64      | transfers | 0.4139 | 0.4119 |
| sum-65536   | cpu       | 0.1000 | 0.1012 |
| sum-65536   | device    | 0.2185 | 0.2306 |
| sum-65536   | resident  | 0.3591 | 0.3149 |
| sum-65536   | transfers | 0.6138 | 0.5208 |

`resident` includes managed allocation, task admission, command preparation, execution, scalar observation and retirement, with inputs already uploaded. `transfers` additionally uploads the existing host tensor; no full tensor download is needed for scalar reduction. Returned result deallocation and numerical checks are outside timing. CPU calls and direct Metal are unchanged controls. In particular, `device` retains its original fresh-per-level buffers and does **not** exercise the managed scratch reuse; its wall interval differs from the raw GPU command timestamp, also retained in JSON.

For the million-element case, resident wall time improves 0.5759 → 0.4928 ms (1.17×), while upload-inclusive time improves 1.2719 → 1.2077 ms (1.05×). The 65,536-element upload-inclusive case improves 0.6138 → 0.5208 ms. The 64-element resident median slightly regresses 0.2348 → 0.2397 ms. Unchanged direct GPU/CPU controls also vary between processes; these timings do not establish universal speedup or isolate allocator, driver, cache and clock effects. Cold startup, concurrent application throughput and GPU shader instrumentation are not measured.

Unchanged matrix managed controls from the same run are retained below to make broader run variation visible:

| Workload         | Mode      | Before |  After |
| ---------------- | --------- | -----: | -----: |
| matmul-256       | resident  | 2.6049 | 2.7406 |
| matmul-256       | transfers | 3.4543 | 3.2362 |
| matmul-32        | resident  | 0.2430 | 0.2582 |
| matmul-32        | transfers | 0.6304 | 0.6372 |
| matmul-8         | resident  | 0.2182 | 0.2126 |
| matmul-8         | transfers | 0.5837 | 0.5911 |
| matmul-96        | resident  | 0.3987 | 0.3970 |
| matmul-96        | transfers | 0.8214 | 0.8373 |
| matmul-deep-tail | resident  | 1.4213 | 1.3829 |
| matmul-deep-tail | transfers | 1.8291 | 1.8305 |

## Remaining work

Count words and compute encoders are still per level. Encoder batching, broader reduction source composition, rank-two GPU reductions, general task/residency IR and the signature-derived GPU ABI remain separate tasks. There is no change to precision policy, implicit transfers or CPU fallback.
