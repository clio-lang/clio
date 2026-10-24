# Strict GPU matmul crossovers — 2026-10-15

A 49-shape sweep supports a conservative M2 Max selection profile: retain scalar execution for small/short/outside-envelope cases, use a two-row register tile for sufficiently populated outputs, and use a quad tile for the larger dense cases. The shared-memory candidate again loses every timed shape. These are preallocated GPU-command measurements, not managed-task or application speedups. The [managed integration report](native-gpu-2026-10-15-selection.md) checks the production change separately.

The [raw sweep](native-gpu-2026-10-15-crossover.json) was collected before integration at revision `d6f40c6` plus the expanded research harness. Source/artifact hashes identify the exact pre-integration build. Applying the [zero-context source patch](../../native/benchmarks/gpu-tiling/crossover-source.patch) to `d6f40c6` with `git apply --unidiff-zero` reconstructs every recorded source hash. The current helper centralizes the singleton reference fix in `GpuScaling.mm`; that does not rewrite the historical sweep. The GPU shaders, strict arithmetic and qualification are the same as the [initial layout study](native-gpu-2026-10-15-tiling.md). The new timing shapes cover odd dimensions near output occupancy boundaries, short/long contractions and extreme aspect ratios.

## Results and selected profile

Milliseconds per GPU command, median of three process medians. Shapes are M × K × N. The last two columns apply the final conservative policy to the measured candidates; they do not measure a production dispatcher. Raw JSON also retains the shared-memory candidate, host encode/submit/wait wall time, every sample and process median.

| Shape            |  Scalar | Two-row |    Quad | Profile choice | Scalar / choice |
| ---------------- | ------: | ------: | ------: | -------------- | --------------: |
| 1 × 256 × 65536  |  2.5292 |  4.2497 |  4.5210 | scalar         |           1.00× |
| 1024 × 256 × 256 |  9.5939 |  8.0659 |  7.6400 | register2x2    |           1.26× |
| 1024 × 256 × 64  |  2.4980 |  2.2478 |  2.2950 | register2x1    |           1.11× |
| 127 × 256 × 513  |  2.5014 |  2.2552 |  2.3000 | scalar         |           1.00× |
| 128 × 1025 × 512 | 10.0562 |  8.9790 |  9.1272 | register2x1    |           1.12× |
| 128 × 128 × 128  |  0.3871 |  0.3783 |  0.6201 | scalar         |           1.00× |
| 128 × 256 × 128  |  0.7572 |  0.7366 |  1.2292 | scalar         |           1.00× |
| 128 × 256 × 511  |  2.5012 |  2.2568 |  2.3013 | scalar         |           1.00× |
| 128 × 256 × 512  |  2.5320 |  2.2466 |  2.2975 | register2x1    |           1.13× |
| 128 × 512 × 128  |  1.4909 |  1.4470 |  2.4480 | scalar         |           1.00× |
| 16 × 1025 × 4096 | 10.0654 |  8.9757 |  9.1425 | register2x1    |           1.12× |
| 181 × 256 × 181  |  1.3841 |  1.2366 |  1.4905 | scalar         |           1.00× |
| 2 × 256 × 32768  |  2.5320 |  2.2845 |  2.3324 | register2x1    |           1.11× |
| 255 × 256 × 255  |  2.5026 |  2.2491 |  2.2983 | scalar         |           1.00× |
| 255 × 256 × 257  |  2.5027 |  2.2494 |  2.3013 | scalar         |           1.00× |
| 256 × 1 × 256    |  0.0309 |  0.0444 |  0.0287 | scalar         |           1.00× |
| 256 × 1025 × 256 | 10.1862 |  8.9558 |  9.1373 | register2x1    |           1.14× |
| 256 × 128 × 256  |  1.2631 |  1.1407 |  1.1664 | register2x1    |           1.11× |
| 256 × 255 × 256  |  2.5070 |  2.2683 |  2.3339 | register2x1    |           1.11× |
| 256 × 256 × 1024 |  9.7093 |  8.1515 |  7.8660 | register2x2    |           1.23× |
| 256 × 256 × 256  |  2.5656 |  2.2484 |  2.2983 | register2x1    |           1.14× |
| 256 × 257 × 256  |  2.5158 |  2.2681 |  2.3155 | register2x1    |           1.11× |
| 256 × 32 × 256   |  0.3273 |  0.3105 |  0.3093 | scalar         |           1.00× |
| 256 × 511 × 256  |  5.1234 |  4.4836 |  4.6090 | register2x1    |           1.14× |
| 256 × 512 × 256  |  5.0535 |  4.5263 |  4.5568 | register2x1    |           1.12× |
| 256 × 513 × 256  |  5.0709 |  4.5100 |  4.5914 | register2x1    |           1.12× |
| 256 × 64 × 256   |  0.6390 |  0.5886 |  0.5950 | scalar         |           1.00× |
| 256 × 8 × 256    |  0.0957 |  0.1013 |  0.0933 | scalar         |           1.00× |
| 257 × 256 × 255  |  2.5041 |  2.2530 |  2.3019 | scalar         |           1.00× |
| 257 × 256 × 257  |  2.6057 |  2.2468 |  2.3036 | register2x1    |           1.16× |
| 32768 × 256 × 2  |  2.5697 |  2.2720 |  2.3377 | register2x1    |           1.13× |
| 384 × 256 × 384  |  5.5291 |  4.6973 |  4.6679 | register2x1    |           1.18× |
| 4096 × 1025 × 16 | 10.0477 |  8.9990 |  9.1254 | register2x1    |           1.12× |
| 511 × 256 × 128  |  2.5027 |  2.2508 |  2.2922 | scalar         |           1.00× |
| 511 × 256 × 511  |  9.5658 |  8.0882 |  7.6475 | register2x1    |           1.18× |
| 511 × 512 × 511  | 19.1668 | 16.1293 | 15.2534 | register2x1    |           1.19× |
| 512 × 1025 × 128 | 10.1180 |  8.9949 |  9.1427 | register2x1    |           1.12× |
| 512 × 256 × 128  |  2.5682 |  2.2495 |  2.3012 | register2x1    |           1.14× |
| 512 × 256 × 512  |  9.6714 |  8.0743 |  7.6905 | register2x2    |           1.26× |
| 512 × 511 × 512  | 19.1730 | 16.0969 | 15.2785 | register2x2    |           1.25× |
| 512 × 512 × 512  | 19.1908 | 16.1264 | 15.3265 | register2x2    |           1.25× |
| 512 × 513 × 512  | 19.2459 | 16.1605 | 15.3177 | register2x2    |           1.26× |
| 513 × 256 × 127  |  2.5557 |  2.2511 |  2.3022 | scalar         |           1.00× |
| 513 × 256 × 513  |  9.6404 |  8.1270 |  7.8921 | register2x2    |           1.22× |
| 513 × 512 × 513  | 19.2898 | 16.0922 | 15.5900 | register2x2    |           1.24× |
| 64 × 256 × 1024  |  2.4979 |  2.2712 |  2.3021 | register2x1    |           1.10× |
| 65536 × 256 × 1  |  2.5105 |  2.2660 |  4.4814 | register2x1    |           1.11× |
| 8 × 256 × 8192   |  2.5251 |  2.2535 |  2.3041 | register2x1    |           1.12× |
| 8192 × 256 × 8   |  2.5005 |  2.2507 |  2.3066 | register2x1    |           1.11× |

The profile retains scalar in 16 sweep cases, selects two-row in 25 and quad in eight. All 33 selected cases improve their command median by about 1.10–1.26×. This is a conservative envelope, not a fitted claim of optimal dispatch: it deliberately leaves gains such as 181-square and 511-square quad selection unused. No guarantee is made for every unmeasured dimension or other Apple GPU.

The policy applies only after the complete bundle is validated on **Apple M2 Max**:

- Require at least two output rows, K from 128 through 1,025, and 65,536 through 263,169 output cells before selecting either register tile.
- Within that envelope, use quad only with K at least 256, both output axes at least 128, and at least 262,144 output cells. Use two-row otherwise.
- Use the strict scalar GPU entry outside this envelope and on other devices. This is neither CPU fallback nor a language tensor-size limit.

Output occupancy matters: 128-square shows only roughly 2–3% two-row improvement and substantial quad regression, while larger populated outputs benefit more reliably. Short contractions show small or inconsistent wins and are excluded. A singleton output row loses badly with both register candidates. Very narrow columns can benefit from the two-row tile but lose with quad. Odd rows/columns and odd K remain beneficial in the admitted range. The selected bounds include the measured 513-square odd case and conservatively exclude larger unqualified outputs/depths.

## Qualification and protocol

The four variants again pass 2,485 APFloat shape/pattern cases, 161,857 output cells and 4,735,946 products per variant in both optimized and ASan/UBSan host builds, with zero mismatches. Poisoned outputs and 64-byte suffix guards verify missing writes and adjacent-storage protection; device inputs remain byte-identical. Metal API validation is enabled for qualification, with host sanitizer scope unchanged. GPU instructions and prebuilt LLVM are not sanitizer-instrumented. Strict SPIR-V artifact audits reject hardware floating arithmetic/FMA/fast-math decorations.

The expanded timing control exposed a reference error at K=1: initializing a double sum at positive zero erased a negative-zero product. The corrected singleton reference uses the independently computed exact double product directly, preserving the no-initial-zero contract. The kernels were correct; this was a reference-only fix. K=0 and general IEEE behavior remain covered by APFloat qualification.

Three fresh processes each shuffle 49 workloads and four variants. Two excluded warmups precede seven recorded samples per cell: **4,116 timed samples and 1,176 warmup calls**. Every call validates its output. Inputs are exact dyadic fractions whose products/subtree sums fit float32; the timing reference uses double arithmetic with the singleton correction. Allocation, initial uploads, reference construction, pipeline creation, readback and validation are excluded from GPU-command timing. Calls are sequential and use persistent private buffers. Qualification completes before timing, with no concurrent build/test work. There is no language JIT, fast math, sanitizer or Metal validation in timed processes, and no timer subtraction or sample rejection. Desktop scheduling, frequency, thermal state and cache state are uncontrolled.

```sh
python3 native/benchmarks/gpu_tiling.py --suite crossover \
  --output benchmarks/results/gpu-crossover-reproduction.json
```

The sweep is specific to this strict software-binary32 implementation and measured M2 Max. It does not identify register pressure, occupancy or memory stalls through hardware counters. Different arithmetic formats, kernel implementations or devices require new evidence and profile bounds. Managed integration must retain the numerical/lifecycle gates and measure both resident and transfer-inclusive calls.
