# Cache-layout evaluation: reuse rows, then bound the product scratch

Follow-up: [the MLIR port](native-mlir-blocking-2026-10-15.md) now implements and measures the selected layout. This report preserves the earlier C++ research and decision.

The next compiler implementation should evaluate **4×16 output tiles**, keeping the existing narrow/small-shape paths, with **power-of-two K256 subtrees for deeper contractions**. Among the tested C++ layouts, this combines useful right-hand input reuse with a substantially smaller product working set than an unblocked 4×16 tile. K64 remains a tuning alternative: it wins the odd 1,025-element contraction but is not consistently faster elsewhere. These measurements do not establish a globally optimal tile or target-independent threshold.

**This commit adds research tools and evidence. Compiler lowering and runtime sources are unchanged.** The best C++ prototype is roughly 1.9–2.8× faster than current generated code across this grid; that is a cross-implementation observation, not an implemented or promised compiler speedup. Porting the layout into checked MLIR and measuring it is the next step.

## What the controls show

- K blocking alone does not make the one-row/four-column C++ layout faster here. It mostly adds overhead while shrinking scratch. The unblocked four-column working set is often already small.
- Wider column tiles and reusing each right-hand value across four rows matter. The 4×16 unblocked layout is markedly faster than 1×4/1×16 C++ controls, despite needing more product scratch.
- Once the tile is 4×16, K blocking helps deeper contractions. For K1024 and the larger rectangle, K256 is about 1.2–1.25× faster than the same unblocked layout; for K4097/K8193 it is about 1.34–1.36× faster. Product scratch shrinks from approximately 2 MiB to 72 KiB at K8193.
- Short contractions do not need a second reduction over block roots. The unblocked 4×16 control is usually as fast or faster when K fits a single block. The first compiler experiment should bypass K blocking for K≤256.
- Accelerate is still far ahead of both generated code and the prototypes. It is a performance reference, **not** the correctness oracle or a compatible strict backend. This experiment cannot attribute that gap solely to arithmetic policy, cache layout, code generation, or a particular vendor hardware path.

The controls isolate layout effects within this C++ implementation. They do not isolate hardware cache misses from loop overhead, polling amortization, vector packing, compiler scheduling, or allocator effects.

## Method and provenance

Thirteen shapes and twelve variants produce 156 configurations. The variants are unchanged generated code; unblocked C++ 1×4, 1×16, and 4×16; K64/K256/K1024 for 1×4 and 4×16; one 1×16/K256 candidate; and single-threaded Accelerate SGEMM. C++ templates share the same clipping, polling, product/reduction, output, and final-sum machinery. The unblocked 1×4 C++ control is itself slower than generated code, emphasizing that this is not a compiler before/after comparison.

The [first complete experiment](native-cache-2026-10-15.json) and [confirmation](native-cache-2026-10-15-confirm.json) use identical binaries and unchanged LLVM from `cc8d086`; the LLVM hash matches the [paired-tail report](native-shapes-2026-10-15-pairs-confirm.json). Both current generated code and the prototypes are rebuilt with pinned Clang 22.1.8, C++23, `-O2 -DNDEBUG -ffp-contract=off`, linking the same runtime. Prototype assembly is checked for four-lane multiply/add and absence of fused instructions. BLAS is supplied by the system Accelerate framework using its modern CBLAS interface.

Every experiment launches three fresh timing processes. Each process shuffles shape order, warms each variant three times, then records seven interleaved rounds with shuffled variant order. A sample is **one direct matmul plus final balanced reduction**, including result/scratch allocation and release, invocation settlement, and lightweight result/status checks. Summaries are medians of three process medians. Input/reference construction, per-cell checking, input copies, and input-immutability checks are excluded. These are not the earlier sixteen-operation batches, and timing results from the two experiments are not pooled.

Machine: Apple M2 Max, eight performance plus four efficiency cores, 96 GiB RAM, macOS 26.5. Reported performance-core L1D/L2 sizes are 128 KiB/16 MiB; efficiency-core values are 64 KiB/4 MiB. This does not prove where these processes ran. CPU affinity, frequency, thermal state, and hardware cache misses are not controlled/measured. Inputs are reused and warmed; even the largest input pair is about 8.5 MiB, so this is not a cold, beyond-L2 memory-bandwidth study on the performance cores. Reference/input copies remain resident outside the timed interval. The [supplementary host record](native-cache-2026-10-15-host.json) captures OS build and SDK version separately after measurements.

BLAS threading is set and queried with `BLASSetThreading(BLAS_THREADING_SINGLE_THREADED)` / `BLASGetThreading()` on the only calling thread. Internal vendor workspace and hardware paths remain opaque. BLAS has a different reduction/contraction policy and does not cooperate with cancellation inside the SGEMM call. C++ prototypes use ordinary RAII storage and omit generated checked-descriptor, overflow-guard, and TaskError lowering. Their cooperative polls amortize over larger output tiles, so their contract/cost is not identical to generated code.

## Final confirmation times

Milliseconds per single matmul plus final reduction:

| Shape           | M×K×N         |  Native | C++ 1×4 unblocked | C++ 1×16 unblocked | C++ 4×16 unblocked | C++ 4×16 K256 | Accelerate single |
| --------------- | ------------- | ------: | ----------------: | -----------------: | -----------------: | ------------: | ----------------: |
| control-32      | 32×32×32      |  0.0181 |            0.0353 |             0.0192 |             0.0086 |        0.0086 |            0.0022 |
| control-96      | 96×96×96      |  0.3861 |            0.8137 |             0.4653 |             0.1955 |        0.1984 |            0.0187 |
| wide-512        | 64×256×512    |  4.2743 |            7.1226 |             4.1850 |             1.7543 |        1.7744 |            0.0660 |
| square-256      | 256×256×256   |  8.4745 |           14.2625 |             8.4066 |             3.4937 |        3.5825 |            0.1205 |
| tall-512        | 512×128×256   |  8.3534 |           14.9486 |             8.6880 |             3.6206 |        3.6871 |            0.2087 |
| deep-1024       | 128×1024×128  |  8.8767 |           13.5274 |             8.2140 |             4.4806 |        3.7086 |            0.0648 |
| deep-tail       | 128×1025×131  |  8.0333 |           13.8998 |             8.8008 |             4.8023 |        4.0240 |            0.0727 |
| wide-1024       | 64×64×1024    |  2.4262 |            4.0609 |             2.2878 |             0.9661 |        0.9860 |            0.1041 |
| mixed-tail      | 65×257×259    |  1.8926 |            3.6607 |             2.1978 |             0.9957 |        1.0197 |            0.0430 |
| deep-4097       | 32×4097×67    |  5.5068 |            7.6461 |             4.6922 |             2.7199 |        2.0300 |            0.0417 |
| deep-8193       | 16×8193×257   | 20.6914 |           29.6534 |            17.4949 |             9.9168 |        7.3925 |            0.1170 |
| square-512      | 512×512×512   | 67.4490 |          110.5673 |            65.9783 |            29.4998 |       28.4668 |            0.5529 |
| large-rectangle | 128×1024×1024 | 71.0636 |          111.7154 |            66.3855 |            35.7854 |       28.8145 |            0.3902 |

Accelerate is about 8–182× faster than current generated code in confirmation. This large gap is context for future kernel/backend work, not evidence that the language implementation already reaches mature library performance. The finite timing inputs contain exactly representable binary fractions; the separate strict verification corpus additionally exercises rounding-sensitive and IEEE values.

## Repeatability and the K-block controls

The last two columns compare K256 against the **same 4×16 C++ layout without K blocking**. They are not ratios against native code.

| Case            | First native / K256 | Confirmation native / K256 | First unblocked / K256 | Confirmation unblocked / K256 |
| --------------- | ------------------: | -------------------------: | ---------------------: | ----------------------------: |
| control-96      |               1.96× |                      1.95× |                  0.98× |                         0.99× |
| square-256      |               2.39× |                      2.37× |                  0.98× |                         0.98× |
| square-512      |               2.35× |                      2.37× |                  1.03× |                         1.04× |
| large-rectangle |               2.46× |                      2.47× |                  1.24× |                         1.24× |
| deep-1024       |               2.39× |                      2.39× |                  1.21× |                         1.21× |
| deep-tail       |               1.96× |                      2.00× |                  1.19× |                         1.19× |
| deep-4097       |               2.80× |                      2.71× |                  1.36× |                         1.34× |
| deep-8193       |               2.83× |                      2.80× |                  1.35× |                         1.34× |
| mixed-tail      |               1.86× |                      1.86× |                  0.99× |                         0.98× |

Confirmation, same 4×16 layout, milliseconds:

| Case            | Unblocked |     K64 |    K256 |   K1024 |
| --------------- | --------: | ------: | ------: | ------: |
| control-96      |    0.1955 |  0.2022 |  0.1984 |  0.2003 |
| square-256      |    3.4937 |  3.7077 |  3.5825 |  3.5473 |
| square-512      |   29.4998 | 29.1025 | 28.4668 | 30.1955 |
| large-rectangle |   35.7854 | 29.6095 | 28.8145 | 36.7844 |
| deep-1024       |    4.4806 |  3.7666 |  3.7086 |  4.6745 |
| deep-tail       |    4.8023 |  3.8635 |  4.0240 |  4.9698 |
| deep-4097       |    2.7199 |  2.0400 |  2.0300 |  2.5722 |
| deep-8193       |    9.9168 |  7.4263 |  7.3925 |  9.2422 |
| mixed-tail      |    0.9957 |  0.9756 |  1.0197 |  1.0245 |

## Storage tradeoff

For an R×C tile, unblocked product payload is `4*R*C*K` bytes. A blocked candidate uses `4*R*C*(min(K,B) + ceil(K/B))`, including the retained block roots. The product region is bounded by B, but the root region still grows with K/B; this is **not constant-space reduction**. Capacity reserves a full tile even for clipped edges. These are computed payloads, not measured process RSS, allocator overhead, or hardware cache occupancy.

KiB (1,024 bytes), excluding output/final-sum buffers:

| Case       | Current native | 4×16 unblocked | 4×16 K64 | 4×16 K256 | 4×16 K1024 |
| ---------- | -------------: | -------------: | -------: | --------: | ---------: |
| control-96 |           1.50 |          24.00 |    16.50 |     24.25 |      24.25 |
| square-256 |           4.00 |          64.00 |    17.00 |     64.25 |      64.25 |
| square-512 |           8.00 |         128.00 |    18.00 |     64.50 |     128.25 |
| deep-1024  |          16.00 |         256.00 |    20.00 |     65.00 |     256.25 |
| deep-4097  |          64.02 |        1024.25 |    32.25 |     68.25 |     257.25 |
| deep-8193  |         128.02 |        2048.25 |    48.25 |     72.25 |     258.25 |

The 72 KiB comparison is against the **wider unblocked prototype**, not against a 2 MiB current compiler allocation. Current native scratch for K8193 is about 128 KiB. At K1024, the proposed wider blocked tile grows scratch from current native's 16 KiB to 65 KiB; at K96, a wider unblocked tile grows it from 1.5 KiB to 24 KiB. Reusing more inputs costs storage. Output/final-sum payload is separately reported as `8*M*N` bytes; that sum does not establish live-overlap in generated code. BLAS workspace is recorded as unknown (`-1`), not zero. Per-invocation ownership and task byte budgeting remain implementation gates for any port.

## Strict tree proof and verification

For a power-of-two B, every full aligned K block is a subtree of the global balanced adjacent-pair reduction. Reduce that block with the same pairings, retain its root, and reduce the roots using the same tree. A partially filled final block carries odd leaves upward unchanged. For example, K257/B256 yields the original root over leaves 0–255 and the unchanged final leaf; their final addition is the global tree's last operation. Arbitrary non-power-of-two chunking or a running sum of block roots would not generally preserve the contract.

The independent scalar oracle materializes separately rounded float32 products and builds fresh adjacent-pair levels. Each strict variant verifies 6,468 shape/content cases. C++ candidates compare every output cell as well as the final sum; generated code compares its aggregate result. K extents cover 0/1/2/3 and boundaries around 64, 128, 256, 512, 768, and 1024. Shapes cover all four-row tile remainders, column boundaries through 33, empty contractions/outputs, signed zero, subnormals, extremes, infinities, NaNs, and rounding-sensitive finite values. NaNs compare by classification; all other results compare by float32 bits. Inputs remain unchanged.

The complete corpus passes normal and ASan/UBSan builds. Current generated LLVM carries sanitizer attributes, and post-Clang IR is checked for actual ASan memory instrumentation; C++ candidates/runtime are also instrumented. The system vendor library is not rebuilt with sanitizer instrumentation. BLAS is checked on finite verification inputs against a separate scalar double oracle with error bound `1e-5*(1+sum(abs(products)))`, not against strict bit equality. During timing setup, every variant checks the actual larger shapes, outside performance intervals.

Research candidates additionally reject pre-cancelled invocations and release their RAII storage. This is not the full generated-task in-loop cancellation/deadline, allocation-failure, quota, and TSan gate. Compiler/runtime code is unchanged; the prior 39-test compiler conformance result belongs to `cc8d086` and was not rerun for this research-only change.

## Initial evidence retained

The [initial eight-variant run](native-cache-2026-10-15-initial.json) showed row/column reuse worth investigating but lacked same-layout unblocked 1×16/4×16 and K64/K1024 4×16 controls. The final grid adds those controls and expands row/column boundary verification from 1,782 to 6,468 cases. Its [reconstruction patch](native-cache-2026-10-15-initial.patch), applied to this commit's two research source files, reproduces both initial source hashes. Its denied CPU metadata queries remain unchanged as unavailable; complete-grid metadata was collected with read access. Initial samples are not pooled with final experiments.

## Next compiler step

1. Port a full 4×16 output tile into MLIR, explicitly reusing each right-hand value across the four rows. Keep the current one/two/four-column paths for narrow shapes and safe row/column edges.
2. For K≤256, evaluate direct product scratch; for deeper contractions, add aligned K256 subtrees plus a separate root region within one invocation-owned scratch allocation. Every edge kernel used within that path must obey the same blocked scratch bound; an unblocked scalar/vector fallback must not silently overrun a smaller buffer. Empty output and checked size arithmetic remain required.
3. Preserve separately rounded products and each lane's original tree. Do not route ordinary matmul to BLAS or introduce relaxed arithmetic as a performance shortcut.
4. Extend generated per-cell tests to block boundaries and every partial tile, all allocation-failure points, shared tensors, and actual in-loop cancellation/deadlines. Run the full compiler suite, generated ASan/UBSan and TSan, and inspect target assembly.
5. Repeat matched LLVM before/after timing against `cc8d086`, including narrow/tiny regressions, concurrent worker memory budgets, and an input footprint beyond L2. Enable the path only after that evidence; this C++ result alone is insufficient.

## Reproduce

Build the current compiler, stop other CPU-heavy work, then run on the documented macOS/LLVM toolchain:

```sh
python3 native/benchmarks/cache_blocking.py \
  --output benchmarks/results/native-cache-reproduction.json
```

See the [runner protocol](../../native/benchmarks/README.md#cache-layout-research) and [research source](../../native/benchmarks/CacheBlocking.cpp). No vendor framework is added to the compiler build, and no native source syntax changes.
