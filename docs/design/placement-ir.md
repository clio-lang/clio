# Shared placement-aware typed IR

The shared native frontend now represents device selection, explicit transfers, placed calls, and tensor residency. The optional Metal source target must pass this check before publishing artifacts. This is the first part of unifying execution planning; its C++ supervisor emitter still walks source syntax and has not yet been replaced by an IR-driven continuation lowerer.

## Checked representation

`ValueType` retains the existing numeric/shape/task/error information and adds an exact optional GPU index. For a tensor, an absent index means host residence. For a `Device` value, it means the CPU selector. GPU zero is distinct from an absent index. Numeric scalars stay host values, including completed GPU reductions.

- `DeviceSelection` produces a CPU or GPU selector. GPU indices are parsed directly as uint32 constants, never rounded through float32. Immutable aliases keep the same selection.
- `Transfer` consumes a completed tensor and a selector, and produces an owned task with the target residency and the original rank/extent facts.
- `TaskOperation` carries a checked target value for a placed spawn. In placement mode, omitted placement becomes an explicit CPU selection. Arguments precede selector evaluation and admission. Await/try preserve tensor residence.
- The existing parallel, catch, match, failure and shape operations retain their control-flow and ownership obligations. No new scheduler or lifetime mechanism is introduced.

A function definition describes its ordinary CPU interface and checked tensor algorithm. A GPU spawn refers to that same function with an explicit execution target; selecting a target does not turn the CPU expressions which compute its arguments into GPU code. Backend capability checks still decide whether that algorithm can be compiled for a particular device.

Host arithmetic, ordinary CPU calls and CPU task captures reject resident GPU tensors. GPU tensor captures must already reside on the selected GPU. Scalars may be captured by either target. Function results must be downloaded to the host under the current interface. Catch/match success branches must agree on residency and GPU index; no branch inserts a transfer. Device selectors cannot escape as numeric/group/function results.

Local operations retain proven shape facts. In placement mode, CPU calls expose their declared result shape contract at the ABI boundary. A declared dynamic result remains dynamic rather than gaining a stronger promise from its current implementation. Known invalid arguments still fail checking. Unknown fixed-parameter constraints on spawned CPU functions remain obligations of the child invocation, so a shape fault can be handled through its settled parallel group. Ordinary direct calls retain their supervisor-side refinements.

The representation is hardware-independent: checking `devices.gpu(1)` does not require a second GPU. Runtime availability, device capabilities, quotas, reflected bindings and kernel suitability are separate checks. In particular, the IR can describe an explicit cross-device transfer while the current Metal backend continues to reject unsupported cross-GPU execution.

## Inspecting the IR

```sh
build/native/native/kalandra-check --placement --dump-ir \
  native/metal-source/nested-parallel.kalandra
```

The ordinary checker invocation keeps its CPU policy; placement must be enabled explicitly. CPU lowering rejects a module containing device selectors, transfers, placed calls or resident types rather than silently dropping them. Ordinary CPU source and lowering remain available through the existing entry point.

Metal compilation also writes `placement.ir` alongside `host.cpp`, CPU MLIR/LLVM and GPU artifacts. That file must exactly match the standalone shared check of the original source. Sanitizer/optimization flags do not change it. CMake tracks it as a generated output, and it participates in the compiler's source/output collision and symlink preflight. It is an inspection artifact, not a stable serialized module or a supported input to the compiler.

## Explicit literal shapes

The common frontend also supports the accepted explicit-shape constructor for **flat literal data and constant dimensions**:

```kalandra
empty: Tensor[float32, 0, 3] = tensor([], [0, 3])
matrix: Tensor[float32, 2, 3] = tensor([1, 2, 3, 4, 5, 6], [2, 3])
```

`tensor([])` remains a rank-one empty tensor. An annotation cannot silently turn it into a matrix. The explicit shape supplies the rank and extents; its checked element count must equal the flat data length. Dimensions are nonnegative integer constants parsed without float conversion. Invalid dimensions, indexing/allocation overflow and unrepresentable row-major strides fail before lowering, including zero-element shapes whose nonzero suffix would overflow a stride. Numeric elements still need float32 context in this implementation.

The result uses the existing `TensorLiteral` IR and CPU tensor lowering. The Metal supervisor supports its current rank-one/rank-two constant-data subset. General runtime arrays, computed dimensions, checked ShapeError constructors and additional element types remain later work. Unconstrained numeric bindings continue to follow the accepted numeric design; the float32 subset needs an annotation when no expression/parameter/result context supplies that type.

## Qualification and remaining work

[Placement frontend tests](../../native/tests/PlacementTests.cpp) check all 19 mixed source fixtures, typed dependencies, selector aliasing and exact uint32 indices, capture/residency rules, task/error obligations, fixed-shape child boundaries, constant shapes, overflow and analysis limits. They run normally and with ASan/UBSan, without a GPU. They also verify that the CPU backend rejects placement-bearing modules and continues to lower ordinary CPU modules.

[Artifact checks](../../native/metal-source/VerifyPlacement.cmake) compare 70 generated target artifacts with independent standalone checks, check option ordering, and verify output preflight. [CPU constructor checks](../../native/cmake/VerifyExplicitShapes.cmake) execute flat matrices, empty rows/columns, a rank-zero tensor and a returned empty tensor in debug, optimized, ASan/UBSan and TSan builds. Existing mixed CLI suites now use explicit shapes for zero outer dimensions and retain their worker, numeric, failure and sanitizer checks. [Evidence](../../native/metal-proof/evidence/placement-ir-2026-10-16.json) records the regression and unchanged lowering artifacts.

Next, lower this checked execution representation into a shared continuation/placement plan, replacing the target-specific source walk in stages. Asynchronous helper bodies, broader value/element types and additional devices remain separate increments. Distributed execution retains its design-review gate.
