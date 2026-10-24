# Strict GPU normalization comparison — 2026-10-15

GPU arithmetic normalization now uses five bounded integer stages instead of fixed per-bit loops. This improves actual source-generated matmul and reduction kernels while retaining strict binary32 arithmetic. The one-cell-per-lane matmul, private root stack, ABI, dispatch geometry and runtime are unchanged.

The comparison uses the Apple M2 Max (96 GiB RAM, 12 CPU cores) and the executable/shaders saved for the [initial baseline](native-gpu-2026-10-15.md). Their hashes match that original report. Current artifacts are built from `3c9fcf9` plus the source changes identified by hashes in the [raw comparison](native-gpu-2026-10-15-normalization.json). The CPU kernel, harness, input data, runtime and build flags match. No hardware float32, FMA or relaxed numerical policy is introduced.

## Results

Milliseconds per operation, median of three process medians. GPU columns show **baseline → current**; CPU is the current checked-call control. The final column is the ratio of the same preallocated GPU command interval before/after, not a CPU/GPU hardware comparison.

| Workload         | CPU call | GPU command before → after | Resident task before → after | With transfers before → after | Command ratio |
| ---------------- | -------: | -------------------------: | ---------------------------: | ----------------------------: | ------------: |
| matmul-8         |   0.0009 |            0.0413 → 0.0287 |              0.2369 → 0.2253 |               0.6186 → 0.6048 |         1.43× |
| matmul-32        |   0.0059 |            0.1193 → 0.0577 |              0.3124 → 0.2576 |               0.7476 → 0.6226 |         2.07× |
| matmul-96        |   0.1145 |            0.5714 → 0.2068 |              0.7930 → 0.3937 |               1.2123 → 0.7987 |         2.76× |
| matmul-256       |   2.2071 |            7.7265 → 2.4992 |              8.1109 → 2.8280 |               8.6705 → 3.2367 |         3.09× |
| matmul-deep-tail |   0.3665 |            3.2617 → 1.1909 |              3.4635 → 1.4004 |               3.8911 → 1.8414 |         2.74× |
| sum-64           |   0.0006 |            0.0245 → 0.0147 |              0.2760 → 0.2359 |               0.4514 → 0.4401 |         1.66× |
| sum-4097         |   0.0083 |            0.0377 → 0.0291 |              0.3188 → 0.3064 |               0.5078 → 0.5143 |         1.29× |
| sum-65536        |   0.0998 |            0.0511 → 0.0361 |              0.3869 → 0.3589 |               0.6112 → 0.5793 |         1.41× |
| sum-1048576      |   1.6116 |            0.2336 → 0.1057 |              0.7206 → 0.5680 |               1.4095 → 1.2494 |         2.21× |

For 256-square matmul, the command interval improves **3.09×**, the resident task **2.87×**, and the transfer path **2.68×**. The current transfer path is still **3.24 ms versus 2.21 ms on CPU**, about 1.47× the CPU latency. All five tested matmul shapes still favor the CPU checked call. The 256-square device samples are 7.702–7.840 ms before and 2.494–2.846 ms after; this improvement appears in all three process medians.

The million-element reduction's command interval improves **2.21×**. Resident task latency falls from 0.721 to 0.568 ms, while the transfer path falls from 1.409 to 1.249 ms versus 1.612 ms on CPU. Individual transfer samples still overlap CPU samples (current transfers 1.095–2.251 ms; CPU 1.524–1.701 ms), so this does not establish a reliable offload threshold. Small task/transfer paths remain dominated by costs outside arithmetic; sum-4,097's transfer median slightly increases despite a shorter command. No blanket end-to-end speedup is claimed.

## Change and qualification

The previous lowering performed 23 one-bit normalization iterations for each multiplication operand and 26 after addition. It now tries shifts of 16, 8, 4, 2 and 1 bits. A stage moves only nonzero values, never overshoots the target significand bit, and never crosses the subnormal exponent floor. This yields the same significand/exponent pair as repeated one-bit normalization. Signed-zero, rounding and nonfinite handling remain in the existing packing/classification code. Separately rounded products and the fixed adjacent-pair tensor tree are preserved.

The APFloat corpus adds 11,868 targeted pairs, bringing it to 595,106 pairs. They cover every subnormal leading bit, both signs, scaling across the normal/subnormal boundary, and all finite exponent fields at each cancellation distance. The complete native test suite includes scalar CPU/Metal qualification, managed elementwise arithmetic, source-generated helpers, reduction and matmul, lifecycle/failure injection and host sanitizer variants. [Qualification evidence](../../native/metal-proof/evidence/gpu-normalization-2026-10-15.json) retains counts, results and hashes. Scalar artifact checks reject floating arithmetic and normalization loops. Sanitizers instrument generated CPU and host/runtime code, not device instructions or prebuilt LLVM libraries. These tests are differential evidence, not an exhaustive proof over all possible float pairs/devices.

## Reproduction and measurement limits

```sh
python3 native/benchmarks/gpu.py \
  --baseline-dir benchmarks/.build/native-gpu/baseline-2026-10-15 \
  --output benchmarks/results/native-gpu-normalization-reproduction.json
```

Save or reconstruct the baseline executable and both Metal libraries before rebuilding, using revision `3c9fcf9` and the [initial report's protocol](native-gpu-2026-10-15.md#what-is-timed). The runner alternates fresh-process pairs baseline/current, current/baseline, baseline/current, with identical workload/mode shuffle seeds per pair. Each cell uses two excluded warmups and seven recorded samples in each of three processes, per version: **1,512 timed samples and 432 warmups** in total. Compilation, pipeline creation and initial dispatch warmups are excluded. There is no JIT, fast math, sanitizer, Metal validation or profiling instrumentation in the timing build. Every warmup and sample is validated; inputs and task/resource retirement are checked. Performance runs occur after conformance tests, without concurrent test/build work.

CPU, GPU command and task paths have different timing boundaries, unchanged from the initial report. Device commands use preallocated resident buffers; resident tasks include result allocation and task lifecycle; full paths include explicit uploads and matrix downloads. Returned output destruction and numerical validation are outside timing. Reduction tasks include the runtime's four-byte result copy, while the direct device interval excludes final readback. See the original report before comparing paths.

The raw data retains every sample, process median, extrema, device timestamps, phases, source/artifact hashes, toolchain and process order. No CPU pinning, clock/thermal control, timer subtraction or sample rejection is used. Desktop variability remains, especially for short calls. This is a shared strict-arithmetic compiler improvement, not evidence that memory tiling or tensor hardware was optimized. Source-generated supervisor continuations, multiple concurrent jobs, remote execution and application-level placement thresholds remain unmeasured. GPU-ABI-001 remains open.
