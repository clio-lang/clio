#pragma once
#include "mlir/Support/LogicalResult.h"
namespace mlir {
class Operation;
}
namespace kalandra {
// Scalar binary32 add/subtract/multiply/divide and bit-preserving negation -> integer IEEE
// round-to-nearest/ties-to-even. No target precision relaxation. Other floating arith operations
// fail closed.
mlir::LogicalResult lowerStrictFloat32(mlir::Operation *root);
// CPU-only binary32/binary64 implementation. Binary64 uses i128 intermediates;
// this entry point rejects GPU/SPIR-V modules. Source admission and typed
// native/worker ABI validation belong to their respective compiler layers.
mlir::LogicalResult lowerStrictCpuFloat(mlir::Operation *root);
} // namespace kalandra
