# Strict binary32 arithmetic on the GPU

Status: scalar float32 addition and multiplication now have an integer MLIR lowering, verified through both CPU LLVM and Metal on an Apple M2 Max. Separately rounded multiply-then-add passes the same checks. This numerical backend component now also feeds private managed elementwise compute tasks. A first optional source compiler now uses it for placed rank-one elementwise functions. Strict rank-one reductions and rank-two matmul now share the lowering; general GPU arithmetic admission remains incomplete.

## Why an integer lowering

The [original Metal probe](../../native/metal-proof/README.md) exposed two differences from the accepted [numeric contract](numbers.md): subnormal arithmetic can flush to zero, and SPIRV-Cross's NoContraction helpers change a signed-zero case. Disabling fast math and contraction does not establish full IEEE compatibility for hardware float32. The original controls remain in the test suite and retain those observed failures; their results are not rewritten as successes.

The new [lowering](../../native/lib/StrictFloat.cpp) computes the operation's result bits using integer arithmetic. It preserves the existing language contract rather than adding a flush-to-zero or relaxed policy. Float bitcasts remain at the boundary; significands, exponents, signs, normalization, and rounding are all represented by integer MLIR operations. The same lowered graph is compiled to CPU LLVM and, through SPIR-V/SPIRV-Cross, to Metal. There is no handwritten replacement Metal arithmetic shader, CPU execution fallback, or post-generation shader text patch.

The proof's SPIR-V target enables Int64. SPIRV-Cross requires MSL 2.2 or later for these integer operations, so the strict artifact uses `macos-metal2.2`; the historical hardware probe retains MSL 2.1. The M2 Max accepts and executes the strict artifact. This is not evidence for every Apple GPU or the future NVIDIA backend.

## Arithmetic contract

The implemented operations round to binary32 with round-to-nearest, ties-to-even. They preserve gradual underflow and signed zero, produce infinity on finite overflow, and implement infinity/zero/NaN cases. NaN results are canonical quiet NaNs (`0x7fc00000`); payload and NaN sign preservation are not promised by the language's initial contract. Floating-point status flags and signaling exceptions are not exposed by this component.

A multiplication followed by addition remains two separately rounded operations. The lowering packs the intermediate product into binary32 bits before the addition reads it. It neither introduces fused multiply-add nor changes the reduction-tree contract. GPU matmul and reduction kernels also schedule the accepted tree; correct scalar operations alone do not establish the tensor result.

Unsupported floating arithmetic and formats are rejected before rewriting or writing output. This first pass accepts scalar float32 `arith.addf` and `arith.mulf`, with existing bitcasts and integer operations passing through. Float64, floating vectors, division, and other floating arithmetic are not admitted. Floating constants are not lowered by this initial pass; the tested kernels receive their float values from parameters or buffers. No width conversion or approximation is substituted.

## Bit arithmetic

Finite operands use an explicit significand and an effective exponent. Normal values supply the implicit leading bit; subnormals retain their smaller significand with the minimum effective exponent. Input classification uses the encoded bits, so subnormals are not lost to hardware floating arithmetic before classification.

Addition orders magnitudes, aligns the smaller significand with a sticky right shift, and adds or subtracts according to signs. Three low bits retain guard/round/sticky information. A carry shifts the result right; cancellation normalizes left without crossing the subnormal exponent floor. Exact cancellation gives positive zero, except that adding two negative zeros preserves negative zero.

Multiplication first normalizes subnormal operands. Their 24-bit significands produce an exact product of at most 48 bits in an unsigned 64-bit integer. Exponent adjustment selects the product's leading bit. Sticky shifts retain the discarded information, including any further shift required for gradual underflow. The final sign is the operand-sign XOR, including rounded-to-zero results.

Packing rounds the retained significand once: greater than half rounds up; exactly half rounds up only when the retained low bit is odd. A rounding carry adjusts the exponent. Crossing the subnormal/normal boundary and overflow to infinity are explicit branches. Infinity plus its opposite, infinity times zero, and NaN inputs select a canonical NaN.

The sticky-shift helper clamps every physically emitted shift to 1–63, with separate selects for counts zero and at least 64. Unused select arms therefore do not contain out-of-range shifts. Normalization loops have fixed upper bounds (26 addition steps and 23 operand-normalization steps for multiplication). Integer intermediates stay within their defined bit widths. This is an implementation argument accompanied by differential tests, not a formal proof over every pair of binary32 values.

## Independent references and corpus

[FloatOracle.h](../../native/metal-proof/FloatOracle.h) uses LLVM APFloat with IEEE single precision and nearest/ties-to-even rounding as a software reference. The harness also evaluates the corresponding CPU float32 operation with contraction disabled and a separately stored product. It requires those references to agree, except for NaN payload/sign, before accepting the generated result.

The initial deterministic corpus contained **583,238 pairs** (the normalization qualification below expands it):

- 46,656 ordered pairs from 216 signed edge encodings near subnormal, exponent, significand, overflow, and nonfinite boundaries.
- 262,144 pairs covering all 256×256 encoded-exponent combinations with four sign combinations and selected boundary significands.
- 262,144 full-bit-pattern pairs from a fixed-seed xorshift generator.
- 12,288 cancellation/adjacent-value pairs.
- Six explicit regressions, including the original subnormal, negative-zero, and multiply/add rounding discriminators.

Each CPU variant executes add, multiply, and separately rounded multiply-then-add: **1,749,714 comparisons**. The GPU variants additionally repeat prefixes at zero, small sizes, and workgroup boundaries, giving **1,787,832 comparisons in 489 command submissions per run**. All results match both references, with NaNs compared by classification. Inputs, prefix/suffix sentinels, and inactive output tails remain unchanged.

The GPU harness uses private buffers and explicit staging copies, a 64-thread workgroup, and a fixed maximum of 4,096 values per dispatch. That capacity is a proof fixture limit, not a language tensor limit. Its host semaphore is a harness wait; the separate [managed transfer runtime](../../native/metal/README.md) retains its scheduler completion mechanism. A subsequent dynamic-array artifact, `runtime-gpu.mlir`, now connects the same arithmetic lowering to managed compute tasks through a separate private ABI. It runs the full corpus plus zero/tail/beyond-4,096 cases through task uploads, dispatches, and downloads; see the [runtime conformance](../../native/metal/README.md#managed-compute). The original fixed-size proof remains an independent numerical control.

## Verification and reproducibility

With the pinned dependencies from the [toolchain lock](../../native/metal-proof/toolchain.json):

```sh
cmake --preset native -DKALANDRA_BUILD_METAL_PROOF=ON
cmake --build --preset native --target native-metal-strict
ctest --preset native -R '^metal-strict-'
```

Eight tests cover CPU and GPU in debug/optimized/ASan+UBSan host variants, artifact inspection, and transactional rejection of unsupported arithmetic. CPU-generated integer code is compiled at the selected optimization level. The three GPU harness variants load the same Metal library; they are not three GPU compiler optimization modes. Host/CPU sanitizers do not instrument GPU shader accesses or the prebuilt LLVM reference library.

Artifact checks reject normalization loops in scalar fixtures, surviving float add/multiply/divide, FMA, and fast-math decoration in the relevant lowered artifacts. They verify Int64 integer arithmetic and the reflected entry point/buffer layout. The generated CPU LLVM, SPIR-V, and Metal source are preserved in the ignored build directory. Negative tests reject float32 division, float64 addition, and vector multiplication without overwriting an existing output file.

The [recorded results and hashes](../../native/metal-proof/evidence/strict-float32-2026-10-15.json) identify the source, toolchain, shader, and three GPU runs. Passing this corpus is strong differential evidence for this subset, not an exhaustive validation of all float pairs, drivers, devices, or future compiler transformations.

## Performance and next integration gate

This is a correctness implementation using integer work for every operation. It has not been benchmarked against a hardware float32 path, so it establishes no throughput, latency, or end-to-end speed claim. The test duration includes references, transfers, validation, and synchronization and must not be presented as a kernel benchmark. Retain this strict path as a correctness baseline when evaluating any faster lowering; do not silently relax the numeric policy to obtain a better result.

Checked compute tasks and a [first source-to-Metal compiler slice](apple-gpu.md#first-source-to-metal-compiler-slice) now use this path, including real source-generated kernels, explicit transfers, and a standalone build driver. A checked [CPU/GPU descriptor bridge and common compiler entry point](apple-gpu.md#common-compiler-entry-and-cpu-tensor-abi) now connect this subset to native CPU invocation storage. Common mixed-source typed IR remains a later compiler gate. Source admission must still reject operations or types outside the implemented subset. Strict rank-one reductions and rank-two matmul are now implemented in the source slice. Further numeric operations, hardware fast paths and NVIDIA/Windows validation remain ahead.

## Normalization optimization

The [shared lowering now uses five straight-line integer stages](apple-gpu.md#strict-normalization-optimization) in place of bounded per-bit normalization loops. The earlier qualification counts above describe the original evidence; the expanded corpus adds 11,868 pairs targeting every subnormal leading bit and cancellation distance across all finite exponent fields. The arithmetic policy is unchanged. CPU and actual Metal execution are requalified against APFloat, with separate performance measurements rather than timing the correctness harness.
