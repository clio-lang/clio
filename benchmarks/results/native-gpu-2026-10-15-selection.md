# Managed GPU matmul selection — 2026-10-15

The native backend now selects strict register-tiled matmul for a conservative measured envelope on Apple M2 Max. Larger dense cases improve in both GPU-command and managed resident/transfer paths; small, singleton-row, short-contraction and outside-envelope cases retain the scalar GPU entry. Strict arithmetic, explicit transfers, managed payload budgets and task outcome semantics are preserved.

The policy follows a [49-shape crossover sweep](native-gpu-2026-10-15-crossover.md). This report separately measures the actual compiler-generated linked bundle and managed runtime. Both the [primary results](native-gpu-2026-10-15-selection.json) and [confirmation](native-gpu-2026-10-15-selection-confirmation.json) are retained; unchanged control timings vary, so this is not a claim that every call gets faster.

## Primary comparison

Milliseconds per operation, median of three process medians. GPU columns show **former scalar runtime → current selection**. The CPU column is the current checked-call control; CPU code is identical on both sides. GPU command, resident and transfer paths retain their different boundaries from the [initial protocol](native-gpu-2026-10-15.md#what-is-timed).

| Workload        | CPU call | GPU command before → after | Resident before → after | With transfers before → after |
| --------------- | -------: | -------------------------: | ----------------------: | ----------------------------: |
| small-scalar    |    0.040 |              0.320 → 0.320 |           0.510 → 0.523 |                 0.894 → 0.956 |
| narrow-scalar   |   36.228 |              4.378 → 3.636 |           3.734 → 4.704 |               12.182 → 12.222 |
| short-scalar    |    0.080 |              0.096 → 0.095 |           0.297 → 0.294 |                 0.705 → 0.679 |
| rows2-256       |    2.273 |              2.508 → 2.260 |           3.148 → 2.573 |                 3.602 → 3.083 |
| rows2-odd       |    2.577 |              2.625 → 2.267 |           2.949 → 2.634 |                 3.369 → 3.054 |
| quad-512        |   18.921 |            19.399 → 15.692 |         19.776 → 16.069 |               20.783 → 17.260 |
| quad-odd        |   22.274 |            19.846 → 15.877 |         19.997 → 16.008 |               20.818 → 17.120 |
| outside-profile |   10.714 |             10.022 → 9.879 |         10.552 → 10.200 |               10.918 → 10.904 |
| sum-control     |    1.678 |              0.105 → 0.109 |           0.620 → 0.616 |                 1.372 → 1.273 |

The selected 512-square quad case improves its command interval **1.24×**, resident task **1.23×**, and complete transfer path **1.20×**. The odd 513-square case improves about **1.25×**, **1.25×** and **1.22×** respectively. Two-row 256-square improves its command interval **1.11×**; its larger wall-time improvement is not attributed solely to kernel work.

## Confirmation

The full matched experiment repeats with unchanged source/flags/protocol. No primary samples are dropped or merged into a more favorable table.

| Workload        | GPU command before → after | Resident before → after | With transfers before → after |
| --------------- | -------------------------: | ----------------------: | ----------------------------: |
| small-scalar    |              0.320 → 0.320 |           0.515 → 0.505 |                 0.928 → 0.883 |
| narrow-scalar   |              4.274 → 3.322 |           4.599 → 3.567 |               12.708 → 12.265 |
| short-scalar    |              0.095 → 0.096 |           0.297 → 0.285 |                 0.683 → 0.684 |
| rows2-256       |              2.506 → 2.247 |           2.771 → 2.565 |                 3.273 → 3.008 |
| rows2-odd       |              2.599 → 2.269 |           2.916 → 2.512 |                 3.387 → 3.057 |
| quad-512        |            19.146 → 15.312 |         19.775 → 16.006 |               20.415 → 16.498 |
| quad-odd        |            19.477 → 15.767 |         19.837 → 16.151 |               20.726 → 16.949 |
| outside-profile |              9.782 → 9.673 |         10.149 → 10.179 |               10.906 → 10.740 |
| sum-control     |              0.101 → 0.108 |           0.614 → 0.593 |                 1.335 → 1.479 |

The 512-square case again improves: **1.25×** command, **1.24×** resident and **1.24×** with transfers. Odd 513-square improves about **1.24×**, **1.23×** and **1.22×**. Two-row selected cases also improve their command and both task-path medians in each experiment, though the wall-time gain varies.

Unchanged controls show why limits matter. The singleton-row resident median regresses from 3.73 to 4.70 ms in the primary run, then improves from 4.60 to 3.57 ms in confirmation. Its command intervals differ despite selecting the same scalar entry and loading identical library bytes. Small-control transfer timing reverses direction too, and the reduction-control transfer median improves in one experiment and regresses in the other. Cache/allocation state, clocks, driver state and host scheduling are uncontrolled and not separately attributed here. These results do not establish zero overhead outside the profile or an automatic CPU/GPU placement threshold.

## Selection and implementation

The [private profile](../../native/metal/MatmulLayout.h) applies only to Apple M2 Max after loading/validating the complete three-entry bundle. Register selection requires M at least two, K in 128–1,025 and output cells in 65,536–263,169. Quad additionally requires K at least 256, both output axes at least 128 and at least 262,144 cells. Otherwise admitted profile shapes use two-row. All other devices/shapes retain scalar GPU execution. These are performance bounds, not language limits or CPU fallback.

The source compiler emits scalar, two-row and quad GPU MLIR. Each entry independently passes strict integer-binary32 lowering, SPIR-V conversion/validation, SPIRV-Cross and offline Metal compilation; the AIR objects link into one library. The runtime verifies the reflected four-buffer/12-byte-parameter ABI and 64-thread capability of every profiled entry before publishing a bundle. Entry selection and widened logical-tile counts use actual input dimensions after existing admission checks. Partial rows/columns guard accesses. Per-cell products remain separately rounded and the accepted adjacent-pair tree is unchanged. No hardware float32, FMA, reassociation or precision relaxation is introduced.

The existing kernel/frame ownership chain retains all pipelines and buffers through command acknowledgement. Result allocation sizes, staging parameters, residency, cancellation/deadline acknowledgement and managed payload budgets are unchanged. Pipeline metadata and private driver storage are outside those managed byte counters. Loading on the profiled device now prepares two additional pipelines; cold library/pipeline startup and source-supervisor overhead are excluded from these measurements and are not claimed to improve.

## Correctness and resource gates

All **119 native CTest tests pass in 396.93 seconds**. Each of the four matrix build variants checks **678 cases, 347,871 cells and 79,315,558 products** against compiled CPU and independent APFloat references, including actual managed selection for odd two-row and quad shapes with arbitrary float bit patterns. Existing IEEE and shape/admission coverage remains. The register entries exactly reproduce the qualified research MLIR; [evidence](../../native/metal-proof/evidence/gpu-selection-2026-10-15.json) records source/artifact hashes and results.

All three execution layouts sweep eight logical allocation/encoder checkpoints and check cancellation, deadlines, failed command completion, nonpublication of unwanted outcomes and pending-core teardown. Bundle preparation sweeps four allocation checkpoints, including partial preparation and recovery. Debug, optimized, ASan/UBSan and separate TSan builds run on the actual M2 Max. Sanitizers instrument host/runtime and generated CPU paths as configured, not GPU instructions or prebuilt LLVM. CLI tests inspect strict artifacts for both register entries and cover source packaging, results, zero axes and shape diagnostics. An additional matrix CLI rerun passes in 27.46 seconds after adding relocation with only the executable and linked library, without standalone tile libraries or compiler intermediates.

## Matched protocol and reproduction

```sh
mkdir -p benchmarks/.build/native-gpu/scalar-source
git show d6f40c6:native/metal/Metal.mm > benchmarks/.build/native-gpu/scalar-source/Metal.mm
python3 native/benchmarks/gpu.py --suite selection \
  --baseline-metal-source benchmarks/.build/native-gpu/scalar-source/Metal.mm \
  --output benchmarks/results/gpu-selection-reproduction.json
```

The former Metal runtime source is rebuilt against the same current headers, task core, generated CPU LLVM, harness/data, flags and linked shader libraries. The baseline direct control explicitly selects scalar, as its runtime does. The current direct control uses the same profile as its managed runtime. This is an isolated selection/runtime comparison, not a complete historical checkout rebuild. The baseline source hash identifies the implementation from `d6f40c6`; the scalar shader SPIR-V is unchanged from the crossover control. Build commands, library/executable/source hashes, revision/worktree state and device metadata are retained.

Nine workloads cover: `32×256×32` small scalar, `1×256×65536` singleton-row scalar, `256×8×256` short scalar, `256³` and `257³` two-row, `512³` and `513³` quad, `514×256×514` outside profile, and a 1,048,576-element reduction control. Both sides explicitly use a **512 MiB** managed payload budget to accommodate the large control input's simultaneous host, staging and device copies. Production defaults remain 64 MiB; the ordinary initial benchmark suite retains that default. Direct Metal allocations are outside the managed ledger.

Each experiment alternates three fresh-process pairs baseline/current, current/baseline, baseline/current. Workloads and modes use matching seeded shuffles. Two excluded warmups and seven recorded samples per cell give **1,512 timed samples and 432 warmups per experiment**, or **3,024 timed samples and 864 warmups across both**. Every warmup/sample validates output; inputs and resource retirement are checked. Qualification completes before timing, and no tests/builds run concurrently with timed processes. There is no language JIT, sanitizer, fast math, profiling or Metal validation in performance builds; compilation, library/pipeline creation, runtime setup, reference generation and initial resident uploads are excluded. There is no sample rejection, timer subtraction, CPU pinning, clock/thermal control or controlled cache state.

CPU calls retain output for untimed validation. GPU timestamps cover preallocated resident compute commands, with validation readback in a separate untimed command. Resident tasks include allocation, admission, execution, observation and retirement; matrix validation download is excluded. Transfer paths include explicit uploads and matrix downloads; returned output destruction is excluded. Raw JSON also retains per-process medians, all sample extrema and transfer phases. Different timing boundaries must not be presented as peak hardware ratios or application-level speedups. GPU-ABI-001 remains open.
