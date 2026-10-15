# Strict matmul layout experiments

These GPU MLIR files belong to the [isolated layout study](../../../benchmarks/results/native-gpu-2026-10-15-tiling.md). They define the research candidates; the compiler now packages the qualified register bodies separately, without introducing new language features. `gpu_tiling.py` compiles them through the existing integer float32 lowering, SPIR-V validation, SPIRV-Cross and offline Metal compiler. The direct research harness supplies their matching grid and entry point; do not substitute these libraries into a production runtime bundle.

`shared8x8.mlir` uses cooperative workgroup loads and aligned eight-product subtrees. `register2x2.mlir` and `register2x1.mlir` reuse operands and carry-loop control across independent output cells. All preserve separately rounded products, the adjacent-pair tree, nonempty signed-zero behavior and empty-contraction positive zero. Partial tiles guard memory accesses; contraction tails are not padded with arithmetic terms.

The study compares all candidates with the current compiler-generated scalar kernel. Qualification includes APFloat IEEE references, output tails, input immutability, Metal API validation and host ASan/UBSan. The measured benefit depends strongly on shape; see the report before proposing production selection.

The [expanded crossover study](../../../benchmarks/results/native-gpu-2026-10-15-crossover.md) now feeds a [production M2 Max selection profile](../../../benchmarks/results/native-gpu-2026-10-15-selection.md). The compiler packages copies of the two qualified register MLIR entries with its scalar control; the shared-memory candidate remains a research-only kernel. The source compiler and managed runtime choose register entries only inside the documented profile. The direct study continues to measure each candidate independently of production selection.

For exact pre-integration crossover source, apply `crossover-source.patch` with `git apply --unidiff-zero` to revision `d6f40c6`. Its reconstructed source bytes match every source hash in the historical crossover report. Current sources centralize the singleton signed-zero reference fix in the shared data helper.
