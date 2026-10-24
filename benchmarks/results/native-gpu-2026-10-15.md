# Native CPU / Apple GPU baseline — 2026-10-15

The current strict GPU matmul is slower than the optimized CPU implementation on every tested shape. Large reductions benefit from retaining inputs on GPU; including uploads leaves only a small median advantage for the largest reduction tested. This is the first performance baseline for the implemented backend, not a comparison of peak CPU/GPU hardware capability.

Measured on an Apple M2 Max with 96 GiB unified memory and 12 CPU cores (8 performance, 4 efficiency), using compiler/runtime revision `a818f12`. CPU calls execute on one host thread; no CPU task pool or vendor math library participates. The benchmark harness is introduced with this report; its exact source and artifact hashes and uncommitted worktree state are recorded in the [raw results](native-gpu-2026-10-15.json).

## Results

Milliseconds per operation; matrix shapes are `M × K × N`. Each cell is the median of three process medians, with seven measured samples per process. GPU command duration and the three wall-clock paths have different boundaries, explained below.

| Workload        | CPU checked call | GPU command | Resident GPU task | GPU with transfers |
| --------------- | ---------------: | ----------: | ----------------: | -----------------: |
| 8 × 8 × 8       |           0.0009 |      0.0432 |            0.2371 |             0.6359 |
| 32 × 32 × 32    |           0.0060 |      0.1208 |            0.3297 |             0.7442 |
| 96 × 96 × 96    |           0.1087 |      0.5719 |            0.7887 |             1.2191 |
| 256 × 256 × 256 |           2.0530 |      7.7204 |            8.0315 |             8.5177 |
| 32 × 1,025 × 65 |           0.3358 |      3.2496 |            3.4574 |             3.8864 |
| Sum 64          |           0.0005 |      0.0205 |            0.2589 |             0.4525 |
| Sum 4,097       |           0.0077 |      0.0391 |            0.3134 |             0.5141 |
| Sum 65,536      |           0.0998 |      0.0524 |            0.3903 |             0.6158 |
| Sum 1,048,576   |           1.5438 |      0.2349 |            0.7207 |             1.3779 |

For 256-square matmul, the resident task takes **8.03 ms versus 2.05 ms** for the CPU call; including transfers takes **8.52 ms**, about **4.15× the CPU latency**. The preallocated GPU command alone takes 7.72 ms, so removing transport and most host setup would still leave substantial device work to improve. The deep, odd contraction case is worse: 3.89 ms with transfers versus 0.336 ms on CPU.

For 1,048,576-element reduction, the resident task takes **0.721 ms versus 1.544 ms** on CPU, roughly **2.14× lower latency**. Uploading the existing 4 MiB host tensor brings it to **1.378 ms**, a modest 1.12× median advantage. Individual samples overlap: CPU 1.465–1.678 ms; transfers 1.280–1.816 ms. This is insufficient evidence for a universal offload rule. At 65,536 elements and below, the complete GPU paths lose to the CPU call even though the preallocated command for 65,536 elements is shorter than the CPU call.

The 256-square transfer path's phase medians are 0.247 ms for uploads, 7.973 ms for compute/observation, 0.234 ms for download/observation and 0.0049 ms for retirement. The million-element reduction has 0.682 ms for upload and 0.690 ms for compute/scalar observation. Phase medians are summarized independently and need not sum exactly to total medians. These phases include allocation, admission, driver work and completion handling; they are not isolated bus-transfer or scheduler timings.

## What is timed

- **CPU checked call:** invocation construction and the actual MLIR/LLVM-generated C-interface function, including its checked arithmetic, result/scratch allocation and internal cleanup. Returned matrix storage and the invocation remain alive until untimed validation; their final destruction is excluded.
- **GPU command:** `MTLCommandBuffer.GPUStartTime` to `GPUEndTime` for the actual source-generated shader on preallocated, resident buffers. Matmul uses one compute encoder; reduction uses every adjacent-pair level in one command. Parameters, scratch and outputs are allocated before timing. This measures a GPU command interval, including its device scheduling/barriers, rather than pure instruction time. The final validation readback is in a separate, untimed command. Every recorded device timestamp was available.
- **Resident GPU task:** fresh task-group admission, managed compute, completion, observation and group retirement on a persistent single-worker, host-driven TaskCore. Input tensors and pipelines already reside on GPU. Matmul returns a retained device tensor; its numerical validation download is outside timing. Reduction includes the runtime's final four-byte scalar copy. Output allocation is timed; returned output destruction is excluded.
- **GPU with transfers:** starts from existing immutable host tensors, uploads inputs, executes the managed task, downloads a matrix result or observes the reduction scalar, and retires the group and temporary uploaded inputs. Returned host-result destruction and numerical validation are excluded. Host tensor construction, input generation and runtime/pool/pipeline creation are setup costs outside timing.

The raw data also contains the direct Metal control's host encode/submit/wait wall time. For the million-element reduction its three process medians are 0.465, 0.552 and 0.868 ms, showing wall-time variability that is hidden by a device interval alone. Do not subtract the preallocated command interval from task wall time and label the remainder scheduler overhead: allocation, command encoding, readback and synchronization boundaries differ.

## Protocol and validation

The [runner](../../native/benchmarks/gpu.py) compiles the [Kalandra fixture](../../native/benchmarks/gpu.kalandra) with `--target metal -O2`. It links its emitted CPU LLVM with the [Objective-C++ harness](../../native/benchmarks/GpuScaling.mm), runtime and Metal bridge rebuilt at `-O2 -DNDEBUG -ffp-contract=off`. No sanitizer, profiling macro, LTO, fast math, Metal API validation or injected library is enabled. GPU shaders retain the existing strict integer binary32 implementation and offline Metal options; this does not change numerical policy to obtain performance. Build time was 3.37 seconds, outside measurements.

Three fresh processes each run nine workloads. Workload order is deterministically shuffled per process, and all four modes are shuffled within each round. Each cell has two excluded warmups followed by seven recorded operations: **756 measured samples and 216 warmup operations**. There is no language JIT; pipeline creation and initial dispatch warmups are excluded. Every warmup and sample is checked against an independent reference, with no mismatches. Inputs use nonuniform exact binary fractions whose products and intermediate sums fit float32 exactly, allowing a double reference to validate the same balanced float32 result. These finite inputs do not represent every IEEE data distribution; the separate [matmul](../../native/metal-proof/evidence/gpu-matmul-2026-10-15.json) and [reduction](../../native/metal-proof/evidence/gpu-reductions-2026-10-15.json) suites qualify numerical edge behavior.

CPU inputs, direct Metal inputs and managed GPU inputs are checked unchanged. Each sample checks task-resource retirement and managed byte/staging/in-flight counters against its persistent-input baseline; final counters return to zero. The timing executable uses explicit checks unaffected by `NDEBUG`. Raw samples, process medians, extrema, phases, build commands, source/artifact hashes, toolchain version and device identity are retained in JSON. This measures the real kernels and runtime APIs through a private C++ harness; it does not time generated source supervisor continuations, application startup, nested tasks, multiple simultaneous jobs or remote execution.

Processes and samples run sequentially. CPU core placement, frequency, thermal state and other desktop load are uncontrolled; no samples are discarded and no timer subtraction is applied. No performance thresholds are added to CTest.

## Next experiment

Prioritize matmul's device execution. Profile the per-cell contraction, private subtree stack and strict arithmetic implementation, then compare a kernel change under the same numerical gates and measurement protocol. These results do not identify which of those components dominates. Preserve separately rounded products and the accepted tree; any numerical-policy alternative needs explicit design and qualification.

For reductions, measure batching/reuse and larger application chains before recommending an offload threshold. Keeping data resident matters, and small calls remain expensive in the current GPU path. Explicit GPU placement continues to select GPU; these measurements introduce no automatic CPU fallback. GPU-ABI-001's general parameter-layout follow-up remains open.
