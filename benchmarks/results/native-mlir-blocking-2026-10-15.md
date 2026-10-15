# MLIR 4×16 tiles with strict K256 contraction blocks

The compiler now uses the measured layout in generated MLIR, rather than only in a C++ prototype. Matrices with M≥4 and N≥16 call a private, non-inlined wide kernel. Full tiles compute four rows and sixteen columns together; bottom rows use 1×16 tiles, and column edges use 4/2/1 lanes. Narrow matrices retain the original row kernels. There is no new source syntax, runtime library dependency, BLAS dispatch, or relaxed arithmetic mode.

For K≤256, each tile reduces its products directly. For K>256, aligned 256-element subtrees retain their roots in the same invocation-owned scratch buffer, then reduce those roots with the original balanced adjacent tree. This preserves separately rounded products, odd leaves, singleton signed zero, and per-cell reduction order. Generic `reduceSum` is unchanged.

## Correctness, ownership, and cancellation

The final outlined compiler passes **all 39 CTest tests** in one full run, including debug, optimized, generated-code ASan/UBSan, and separate TSan builds. Its tests include:

- 1,617 aggregate shape/content cases plus the existing fixed numerical/IEEE references.
- **3,681 general per-cell cases and 46 shared-input cases**, each repeated. The extended corpus covers every row remainder, column panels/tails through N33, K256 boundaries through K1025, many root levels at K8193, float-aligned inputs with sentinels, seeded finite values, and IEEE edges. NaNs compare by classification; other results compare by float32 bits.
- Every allocation-failure position for scalar/pair/full tiles, direct and blocked contractions, row/column edges, empty outputs/contractions, and shared inputs. Tensor-result calls use at most two managed allocations regardless of tile count; the projection adds its unchanged final-sum scratch for three.
- A separate **506-shape allocation forwarding probe** that checks actual requests from generated code, including empty outputs with otherwise enormous unused dimensions. It forwards to the unchanged runtime allocator; no probe enters timing builds. Scratch requests match the intended bounds. Tensor outputs separately request their payload plus the bufferization pipeline's existing 64-byte alignment allowance; runtime owner headers are outside those requested sizes.
- Concurrent generated kernels across 1/2/4-worker pools on full and partial tiles. In-loop cancellation and deadline cancellation cover widths 1/2/3/6/7/16/17/18/19/31/32/33/256, preserving independent work, unchanged inputs, and cleanup. TSan also verifies the instrumented generated accesses.

MLIR/LLVM verification remains enabled. IR checks require two-, four-, and 64-logical-lane multiply/add with no fast/reassociation/contraction flags; ARM64 assembly must retain vector arithmetic and reject fused instructions. Wide scratch loads/stores have four-byte alignment, matching the input alignment requirement. Loop polls retain the existing bound in generated iterations, not a fixed scalar-operation count or a preemptive wall-clock deadline. The larger verification corpus raised only the source-suite timeout from 60 to 120 seconds; the final debug source suite took about 57 seconds.

## Storage

The wide scratch payload is `256*K` bytes for K≤256, otherwise `256*(256+ceil(K/256))` bytes. Products and roots share one allocation, reused serially across tiles. Root count uses quotient/remainder so `(K+255)` cannot overflow. Every wide-path edge uses blocked reduction too; falling back to an unblocked edge could exceed this smaller buffer. Empty outputs reserve zero scratch and skip row work. Checked size arithmetic and invocation settlement remain unchanged.

Narrow scratch stays `4*width*K` bytes for widths 1/2/4. For selected wide shapes:

| K    | Pre-port product scratch | New wide product/root scratch |
| ---- | -----------------------: | ----------------------------: |
| 96   |                 1.50 KiB |                     24.00 KiB |
| 256  |                 4.00 KiB |                     64.00 KiB |
| 512  |                 8.00 KiB |                     64.50 KiB |
| 1024 |                16.00 KiB |                     65.00 KiB |
| 8193 |               128.02 KiB |                     72.25 KiB |

More row/column reuse can require **more** scratch than the old narrow tile. At K8193 the new scratch is smaller, and much smaller than an unblocked 4×16 tile's roughly 2 MiB. Root storage still grows with K/256; this is not constant-space reduction. Output and final-sum buffers, alignment padding, and owner metadata are separate. No claim about observed peak RSS is made.

## Matched LLVM measurements

Both versions are rebuilt with **identical current C++ harness, runtime, Clang flags, inputs, and task lifecycle**. The pre-port LLVM hash matches `cc8d086` and the unchanged compiler used in `30f1e2f`'s [C++ layout study](native-cache-2026-10-15.md). This is an actual generated-code before/after comparison. The current C++ research timings are not mixed into these results.

The [37-shape run](native-mlir-blocking-2026-10-15-shapes.json) and [confirmation](native-mlir-blocking-2026-10-15-shapes-confirm.json) retain sixteen-job batches, three warmups, and nine samples per mode. The [larger run](native-mlir-blocking-2026-10-15-large.json) and [confirmation](native-mlir-blocking-2026-10-15-large-confirm.json) use fourteen shapes, four-job batches, two warmups, and five samples per mode. Each experiment alternates baseline/current order over three fresh process pairs and uses matched seeds for shape/mode shuffles. Summary time is the median of three process medians. Each suite's final runs use identical paired binaries; LLVM is identical across suites.

Both versions first verify every shape/mode numerically and settle resource counters. Current generated ASan plus C++ ASan/UBSan verification finishes before timing. Input/reference construction, compilation/startup, warmup, allocation diagnostics, and quiescent statistics inspection are excluded. Timed intervals include normal computation and the selected task lifecycle. Immutable inputs are reused, with direct and 1/2/4/8-worker capacities. A four-job batch cannot occupy eight workers simultaneously. No hardware cache-miss, thermal, frequency, or affinity control is used.

Machine: Apple M2 Max, eight performance plus four efficiency cores, 96 GiB RAM, Clang/LLVM 22.1.8, C++23, `-O2 -DNDEBUG -ffp-contract=off`. The streaming case uses `8×1025 @ 1025×8193`; its right-hand input alone is about 32 MiB, exceeding the prior study's reported 16 MiB performance-core L2. It is still repeated warm work, not a controlled cold-cache test. Thread placement, allocator state, and extra parked pools remain environmental factors.

## Larger matrices: direct batches

Milliseconds per **four-operation batch**:

| Case            | M×K×N         | First before → after (ms) | Confirmation before → after (ms) | Confirmation speedup |
| --------------- | ------------- | ------------------------: | -------------------------------: | -------------------: |
| control-32      | 32×32×32      |             0.079 → 0.038 |                    0.077 → 0.038 |                2.03× |
| control-96      | 96×96×96      |             1.548 → 0.771 |                    1.562 → 0.773 |                2.02× |
| deep-1024       | 128×1024×128  |           36.234 → 13.888 |                  35.265 → 13.838 |                2.55× |
| deep-4097       | 32×4097×67    |            22.221 → 8.937 |                   22.226 → 8.812 |                2.52× |
| deep-8193       | 16×8193×257   |           84.070 → 29.424 |                  82.916 → 29.727 |                2.79× |
| deep-tail       | 128×1025×131  |           32.262 → 16.588 |                  31.688 → 16.690 |                1.90× |
| large-rectangle | 128×1024×1024 |         278.880 → 110.181 |                282.061 → 112.087 |                2.52× |
| mixed-tail      | 65×257×259    |             7.661 → 4.174 |                    7.685 → 4.181 |                1.84× |
| square-256      | 256×256×256   |           34.613 → 13.900 |                  34.668 → 14.133 |                2.45× |
| square-512      | 512×512×512   |         270.521 → 111.219 |                268.643 → 112.430 |                2.39× |
| streaming-wide  | 8×1025×8193   |          212.419 → 64.919 |                 238.234 → 69.318 |                3.44× |
| tall-512        | 512×128×256   |           33.330 → 14.314 |                  33.490 → 14.473 |                2.31× |
| wide-1024       | 64×64×1024    |             9.983 → 3.910 |                    9.895 → 3.915 |                2.53× |
| wide-512        | 64×256×512    |            17.568 → 7.016 |                   17.410 → 7.069 |                2.46× |

## Original shape suite and residual overhead

Microseconds per **sixteen-operation batch**, separate from the four-job table above:

| Case              | First before → after (µs) | Confirmation before → after (µs) | Confirmation speedup |
| ----------------- | ------------------------: | -------------------------------: | -------------------: |
| square-ninety-six |         6284.58 → 3074.96 |                6181.08 → 2985.29 |                2.07× |
| rect-four         |          1911.79 → 947.83 |                 1873.25 → 897.25 |                2.09× |
| rect-tail-three   |         2064.12 → 1086.96 |                2027.08 → 1071.79 |                1.89× |
| wide              |           999.21 → 493.50 |                  979.67 → 471.17 |                2.08× |
| tall-one          |           322.08 → 342.33 |                  319.17 → 321.21 |                0.99× |
| tall-three        |           695.92 → 735.50 |                  688.96 → 705.21 |                0.98× |
| tall-seven        |         1231.46 → 1258.62 |                1197.58 → 1218.58 |                0.98× |
| deep-seven        |         2209.08 → 2306.83 |                2180.33 → 2261.54 |                0.96× |
| deep-eight        |         1850.21 → 1895.58 |                1812.29 → 1881.58 |                0.96× |
| row-three         |             24.62 → 26.83 |                    24.21 → 27.50 |                0.88× |
| row-six           |             30.50 → 29.58 |                    28.17 → 33.29 |                0.85× |
| row-seven         |             40.21 → 40.67 |                    37.79 → 40.88 |                0.92× |
| empty-inner       |               5.29 → 6.25 |                      5.33 → 5.96 |                0.90× |
| tiny-one          |               4.00 → 3.83 |                      3.79 → 4.29 |                0.88× |
| control           |               1.12 → 1.25 |                      1.25 → 1.21 |                1.03× |

The wide path improves the intended cases, but this is **not a universal speedup**. Deep narrow cases remain roughly 2–4% slower in these runs; some one-row and tiny cases vary more. The empty-inner case has a repeatable small absolute overhead, while the no-kernel control changes direction. Dispatch/call/ownership bookkeeping and code generation still matter. Preserve the raw slower samples and use these cases when refining the narrow path; do not claim the fallback's timing is unchanged merely because its arithmetic is unchanged.

## Worker capacity

Confirmation times below are milliseconds per four-job batch. Values compare versions within the same configuration:

| Case            | Capacity | Before → after (ms) | Speedup |
| --------------- | -------: | ------------------: | ------: |
| square-512      |        2 |    136.164 → 58.426 |   2.33× |
| square-512      |        4 |     69.241 → 31.543 |   2.20× |
| square-512      |        8 |     69.502 → 31.632 |   2.20× |
| deep-tail       |        4 |       8.341 → 4.317 |   1.93× |
| large-rectangle |        4 |     72.699 → 27.825 |   2.61× |
| streaming-wide  |        4 |     67.334 → 19.922 |   3.38× |
| streaming-wide  |        8 |     67.578 → 21.193 |   3.19× |

Results are throughput for these bounded batches, not a scheduling threshold, latency SLA, or an overall language ranking. The worker test/benchmark resource counters settle to zero; they do not measure process RSS or guarantee eight simultaneous scratch buffers in this four-job timing suite.

## Refinement retained

The first port embedded wide and narrow code in one function. It improved large matrices but materially regressed narrow cases. The final design outlines only the wide kernel using the existing generated-function no-inline convention, reducing that coupling while keeping a direct narrow path. The initial [37-shape observations](native-mlir-blocking-2026-10-15-inline-shapes.json) and [larger observations](native-mlir-blocking-2026-10-15-inline-large.json) remain separate. The [reconstruction patch](native-mlir-blocking-2026-10-15-inline.patch), applied to this commit's `native/lib/Backend.cpp`, reproduces their backend source hash. Initial measurements are not pooled with final summaries. The measurements show the benefit of this refinement, not a hardware-level proof of a particular spill/cache cause.

## Reproduce and next work

Build the native compiler, recreate/save dynamic projection LLVM from `cc8d086`, stop other CPU-heavy work, and run the [matched suite commands](../../native/benchmarks/README.md#matched-mlir-blocking-comparison). The benchmark driver retains exact commands, source/compiler/LLVM/binary hashes, CPU metadata, expected values, allocation diagnostics, and raw samples. The allocation forwarding probe belongs only to CTest.

The MLIR port is complete and enabled for its supported shape gate. Next optimization work should address the measured residual narrow overhead and target-specific tile selection, retaining these numerical/storage/cancellation gates. The runtime scheduler, language syntax, GPU, and remote backends are unchanged.
