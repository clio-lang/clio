# Reduction dispatch batching

The selected runtime encodes every strict reduction level in **one explicitly serial compute encoder**, replacing one encoder per level. For 1,048,576 inputs this changes twenty encoder creations to one. Dispatch count and mathematical work remain the same. Pipeline state is set once; the input/output/count bindings change for each level. Metal's serial dispatch ordering preserves all dependencies when alternating the two scratch buffers.

All fallible buffer preparation finishes before the encoder opens. Failed preparation can unwind without leaving an active encoder behind. Count words remain separate immutable four-byte buffers. Scratch capacity, budget accounting, scalar readback, cancellation/deadline acknowledgement and failure publication rules are unchanged. The 65-element probe still retains 232 temporary bytes; preparation checkpoints fall from 31 to 25 per rank. Empty input submits no command; singleton input uses only its scalar blit.

## Decision and limits

Warm latency is **roughly flat**, with small mixed improvements and regressions. This change is selected for simpler explicit ordering and fewer encoder creations, not a demonstrated throughput gain. The million-element resident median changes 0.4795 → 0.4728 ms, while the 65,536-element upload-inclusive median changes 0.5184 → 0.5267 ms. Unchanged controls also vary. These observations do not isolate encoder CPU cost, driver scheduling, cache effects or GPU clocks, and do not establish universal performance equivalence or improvement.

The arithmetic shader, strict software binary32 operations, fixed adjacent-pair tree, odd-element carry and row-major traversal are unchanged. There is no reassociation, fused arithmetic, CPU reduction fallback, implicit tensor download or precision relaxation. The serial encoder contract is defined in the pinned macOS SDK's `MTLCommandBuffer.h` (`MTLDispatchTypeSerial`). The alternative barrier contract appears in `MTLComputeCommandEncoder.h`; barriers are ignored on serial encoders, so the selected path does not add redundant barrier calls.

## Serial comparison

[Raw serial observations](native-gpu-2026-10-16-reduction-serial.json) compare the previous `0f994fc` runtime with the new implementation on Apple M2 Max. Both runtime sources are rebuilt against the same current harness, CPU LLVM, task core and offline shader bundle. The new `--baseline-adaptive-matmul` option keeps the same adaptive matmul profile on both sides; it does not change reduction behavior. Baseline source hashes are retained in the raw artifact record. Compilation, pipeline/runtime setup and reference creation are excluded.

Three fresh process pairs alternate baseline/current, current/baseline and baseline/current. Each workload/mode receives five excluded warmups and twenty-one samples per process, with matched shuffled mode/workload order: **4,536 timed calls and 1,080 warmups** across both runtimes. Every result is validated after timing, along with immutable inputs and resource retirement. There is no JIT, sanitizer, Metal validation or profiling injection in performance builds.

Times are milliseconds, median of the three process medians:

| Workload    | Mode      | Before | Serial batch |
| ----------- | --------- | -----: | -----------: |
| sum-1048576 | cpu       | 1.5580 |       1.5667 |
| sum-1048576 | device    | 0.3079 |       0.3106 |
| sum-1048576 | resident  | 0.4795 |       0.4728 |
| sum-1048576 | transfers | 1.1728 |       1.1638 |
| sum-4097    | cpu       | 0.0080 |       0.0080 |
| sum-4097    | device    | 0.2293 |       0.2210 |
| sum-4097    | resident  | 0.2789 |       0.2791 |
| sum-4097    | transfers | 0.4699 |       0.4753 |
| sum-64      | cpu       | 0.0005 |       0.0005 |
| sum-64      | device    | 0.2092 |       0.2040 |
| sum-64      | resident  | 0.2470 |       0.2435 |
| sum-64      | transfers | 0.4287 |       0.4186 |
| sum-65536   | cpu       | 0.1021 |       0.1034 |
| sum-65536   | device    | 0.2243 |       0.2308 |
| sum-65536   | resident  | 0.3179 |       0.3108 |
| sum-65536   | transfers | 0.5184 |       0.5267 |

`resident` includes managed allocation, task/command preparation, execution, scalar observation and group retirement, with inputs already uploaded. `transfers` additionally uploads the existing host tensor; only the scalar comes back. Numerical validation and returned-result deallocation follow timing. CPU calls and direct Metal reductions are unchanged controls. The `device` harness still uses one encoder per level and distinct preallocated outputs, with buffer allocation excluded from timing: it does **not** exercise managed batching. Raw GPU command intervals are retained separately from its wall time. No reduction GPU-kernel speedup is claimed.

Unchanged matrix managed controls from the same run show wider runtime variation:

| Workload         | Mode      | Before | Current |
| ---------------- | --------- | -----: | ------: |
| matmul-256       | resident  | 2.4865 |  2.4865 |
| matmul-256       | transfers | 2.9770 |  2.9928 |
| matmul-32        | resident  | 0.2500 |  0.2534 |
| matmul-32        | transfers | 0.6290 |  0.6387 |
| matmul-8         | resident  | 0.2075 |  0.2207 |
| matmul-8         | transfers | 0.5640 |  0.6050 |
| matmul-96        | resident  | 0.3959 |  0.4013 |
| matmul-96        | transfers | 0.7964 |  0.8119 |
| matmul-deep-tail | resident  | 1.4028 |  1.3921 |
| matmul-deep-tail | transfers | 1.8063 |  1.8373 |

## Concurrent encoder candidate

A concurrent compute encoder with explicit buffer barriers between levels also passes the focused numerical/lifecycle suites. It was not selected: its initial warm experiment showed no consistent advantage over separate encoders. [Raw candidate observations](native-gpu-2026-10-16-reduction-batching.json) retain the less favorable cases and all controls.

That experiment used three alternating process pairs, two excluded warmups and seven samples per cell: **1,512 timed calls and 432 warmups**. It is a separate matched comparison against `0f994fc`, not a direct paired comparison against the later serial experiment. Different protocols and local run conditions prevent attributing differences between the two reports solely to encoder type.

| Workload    | Mode      | Before | Concurrent batch |
| ----------- | --------- | -----: | ---------------: |
| sum-1048576 | resident  | 0.4826 |           0.4862 |
| sum-1048576 | transfers | 1.1669 |           1.1165 |
| sum-4097    | resident  | 0.2710 |           0.2857 |
| sum-4097    | transfers | 0.4546 |           0.4775 |
| sum-64      | resident  | 0.2365 |           0.2414 |
| sum-64      | transfers | 0.4115 |           0.4143 |
| sum-65536   | resident  | 0.3097 |           0.3111 |
| sum-65536   | transfers | 0.5236 |           0.5386 |

Apply [the retained candidate patch](../../native/benchmarks/reduction-batching/concurrent.patch) to `0f994fc` to recreate its measured `Metal.mm` exactly; this reconstruction was verified against its source hash. The benchmark runner source is the version committed alongside this report. Both experiments preserve commands, sources, binary/library hashes, process order, individual samples and per-process summaries. No timed runs overlap the conformance tests.

## Qualification and follow-up

Both candidates pass 653 CPU/GPU/APFloat cases containing 4,070,261 input elements per debug, optimized, host ASan/UBSan and host TSan variant, with zero mismatches. Both ranks sweep all 25 preparation checkpoints. Tests cover scratch byte/buffer bounds, exact budget admission, input immutability, repeated observation, concurrent vector/matrix invocations with one cancelled, deadlines, failed completion and pending core destruction. Metal API validation is enabled for these checks. Host sanitizers do not instrument GPU/driver execution; this is not a GPU race-detector result.

The full serial-path regression run passes **124/124 tests in 452.48 seconds**. [Qualification evidence](../../native/metal-proof/evidence/gpu-reduction-batching-2026-10-16.json) records the final result and source/artifact hashes. Count-word packing, general GPU argument layouts and broader source composition remain separate work. Cold startup, concurrent application throughput and other Apple/NVIDIA hardware are not measured here.
