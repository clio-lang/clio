#pragma once
#include "kalandra/NumericType.h"
#include "mlir/IR/Builders.h"
#include <utility>
namespace kalandra {
// Integer-only checked numerical conversion. Input/output are canonical i64
// bit carriers; validity must be checked before publishing the destination.
std::pair<mlir::Value, mlir::Value> gpuNumericConversion(mlir::OpBuilder &, mlir::Location,
                                                         mlir::Value, NumericType, NumericType);
} // namespace kalandra
