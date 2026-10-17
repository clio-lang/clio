#pragma once
#include "kalandra/NumericType.h"
#include "mlir/IR/Builders.h"
#include <utility>
namespace kalandra {
// Pure integer lowering: returns {converted value, valid}. The caller must guard validity
// before publishing the value. All shifts are bounded, including invalid input paths.
std::pair<mlir::Value, mlir::Value> numericConversion(mlir::OpBuilder &builder, mlir::Location loc,
                                                      mlir::Value input, NumericType source,
                                                      NumericType destination);
} // namespace kalandra
