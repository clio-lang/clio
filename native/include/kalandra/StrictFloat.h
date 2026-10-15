#pragma once
#include "mlir/Support/LogicalResult.h"
namespace mlir {
class Operation;
}
namespace kalandra {
// Scalar binary32 add/multiply -> integer IEEE round-to-nearest/ties-to-even.
// No target precision relaxation. Other floating arith operations fail closed.
mlir::LogicalResult lowerStrictFloat32(mlir::Operation *root);
} // namespace kalandra
