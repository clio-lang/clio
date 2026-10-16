#include "kalandra/Backend.h"
#include "mlir/Dialect/Arith/IR/Arith.h"
#include "mlir/Dialect/Bufferization/IR/Bufferization.h"
#include "mlir/Dialect/Func/IR/FuncOps.h"
#include "mlir/Dialect/MemRef/IR/MemRef.h"
#include "mlir/Dialect/SCF/IR/SCF.h"
#include "mlir/Dialect/Tensor/IR/Tensor.h"
#include "mlir/Dialect/Vector/IR/VectorOps.h"
#include "mlir/IR/Verifier.h"
#include "mlir/InitAllDialects.h"
#include "mlir/InitAllExtensions.h"
#include "mlir/InitAllPasses.h"
#include "mlir/Pass/PassManager.h"
#include "mlir/Pass/PassRegistry.h"
#include "mlir/Target/LLVMIR/Dialect/All.h"
#include "mlir/Target/LLVMIR/Export.h"
#include "llvm/IR/Module.h"
#include "llvm/IR/Verifier.h"
#include <functional>
#include <limits>
#include <mutex>
#include <unordered_map>

namespace kalandra {
std::expected<BackendOutput, std::string> lowerTaskNative(const TypedModule &,
                                                          std::optional<std::string>);
std::optional<std::string> addCheckedInvocationABI(llvm::Module &module);
namespace {
using namespace mlir;
struct LoweringFailure {
  std::string message;
};
class Lowerer {
public:
  Lowerer(const TypedModule &input, MLIRContext &context)
      : input_(input), builder_(&context), module_(ModuleOp::create(builder_.getUnknownLoc())) {}
  OwningOpRef<ModuleOp> run(const std::optional<std::string> &testEntry,
                            const std::vector<std::string> &exports) {
    builder_.setInsertionPointToEnd(module_->getBody());
    auto fault = func::FuncOp::create(
        builder_, builder_.getUnknownLoc(), "kalandra_fault",
        builder_.getFunctionType(
            {builder_.getI64Type(), builder_.getI64Type(), builder_.getI64Type()}, {}));
    fault.setPrivate();
    for (FunctionId id = 0; id < input_.functions.size(); ++id) {
      const auto &function = input_.functions[id];
      SmallVector<Type> parameters;
      for (auto parameter : function.parameters)
        parameters.push_back(type(input_.symbols[parameter].type));
      const auto result = type(function.declaredResult.value_or(function.resultType));
      functions_.push_back(func::FuncOp::create(builder_, location(function.declaration),
                                                "kalandra_fn_" + std::to_string(id),
                                                builder_.getFunctionType(parameters, {result})));
    }
    for (FunctionId id = 0; id < input_.functions.size(); ++id) {
      if (input_.functions[id].name.starts_with("__step_"))
        functions_[id]->setAttr("llvm.emit_c_interface", builder_.getUnitAttr());
      body(id);
    }
    if (!exports.empty()) {
      for (std::size_t i = 0; i < exports.size(); ++i)
        interfaceWrapper(exports[i], "kalandra_cpu_" + std::to_string(i));
      return std::move(module_);
    }
    auto main =
        std::ranges::find_if(input_.functions, [](const auto &f) { return f.name == "main"; });
    if (main == input_.functions.end() || !main->parameters.empty() || main->resultType.tensor)
      throw LoweringFailure{"native entry requires fn main() -> float32 or int32 with no parameters"};
    builder_.setInsertionPointToEnd(module_->getBody());
    const auto entryName = main->resultType.element == NumericType::Int32
                               ? "kalandra_int32_entry" : "kalandra_entry";
    auto entry = func::FuncOp::create(builder_, location(main->declaration), entryName,
                                      builder_.getFunctionType({}, {type(main->resultType)}));
    entry->setAttr("llvm.emit_c_interface", builder_.getUnitAttr());
    builder_.setInsertionPointToStart(entry.addEntryBlock());
    const auto mainId = static_cast<FunctionId>(main - input_.functions.begin());
    auto call = func::CallOp::create(builder_, entry.getLoc(), functions_[mainId], ValueRange{});
    func::ReturnOp::create(builder_, entry.getLoc(), call.getResults());
    if (testEntry)
      interfaceWrapper(*testEntry);
    return std::move(module_);
  }

private:
  Location location(SourceSpan span) const {
    auto [line, column] = input_.source->location(span.begin);
    return FileLineColLoc::get(builder_.getContext(), input_.source->path(), line, column);
  }
  Type type(const ValueType &value) {
    if (!value.tensor)
      return value.element == NumericType::Int32 ? Type(builder_.getI32Type())
                                                : Type(builder_.getF32Type());
    SmallVector<std::int64_t> shape;
    for (const auto &extent : value.shape)
      shape.push_back(extent.constant ? static_cast<std::int64_t>(*extent.constant)
                                      : ShapedType::kDynamic);
    return RankedTensorType::get(shape, builder_.getF32Type());
  }
  Value index(Location loc, std::int64_t value) {
    return arith::ConstantIndexOp::create(builder_, loc, value);
  }
  Value integer(Location loc, std::int64_t value) {
    return arith::ConstantIntOp::create(builder_, loc, value, 64);
  }
  Value zero(Location loc) {
    return arith::ConstantFloatOp::create(builder_, loc, builder_.getF32Type(),
                                          llvm::APFloat(0.0f));
  }
  Value binary(Location loc, StringRef name, Value left, Value right) {
    OperationState state(loc, name);
    state.addOperands({left, right});
    state.addTypes(left.getType());
    return builder_.create(state)->getResult(0);
  }
  Value compare(Location loc, arith::CmpIPredicate predicate, Value left, Value right) {
    return arith::CmpIOp::create(builder_, loc, predicate, left, right);
  }
  void guard(Location loc, Value condition, int code) {
    auto bad = arith::XOrIOp::create(builder_, loc, condition,
                                     arith::ConstantIntOp::create(builder_, loc, 1, 1));
    scf::IfOp::create(builder_, loc, bad, [&](OpBuilder &, Location) {
      auto file = dyn_cast<FileLineColLoc>(loc);
      func::CallOp::create(builder_, loc, "kalandra_fault", TypeRange{},
                           ValueRange{integer(loc, code), integer(loc, file ? file.getLine() : 0),
                                      integer(loc, file ? file.getColumn() : 0)});
      scf::YieldOp::create(builder_, loc);
    });
  }
  Value checkedInt32(Location loc, Value wide) {
    auto low = compare(loc, arith::CmpIPredicate::sge, wide, integer(loc, INT32_MIN));
    auto high = compare(loc, arith::CmpIPredicate::sle, wide, integer(loc, INT32_MAX));
    guard(loc, arith::AndIOp::create(builder_, loc, low, high), 4);
    return arith::TruncIOp::create(builder_, loc, builder_.getI32Type(), wide);
  }
  SmallVector<Value> dimensions(Location loc, Value tensor) {
    SmallVector<Value> result;
    const auto rank = cast<RankedTensorType>(tensor.getType()).getRank();
    for (std::int64_t axis = 0; axis < rank; ++axis)
      result.push_back(tensor::DimOp::create(builder_, loc, tensor, index(loc, axis)));
    return result;
  }
  Value checkedCount(Location loc, ArrayRef<Value> dimensions) {
    auto z = index(loc, 0), one = index(loc, 1);
    Value hasZero = arith::ConstantIntOp::create(builder_, loc, 0, 1);
    for (auto d : dimensions) {
      guard(loc, compare(loc, arith::CmpIPredicate::sge, d, z), 1);
      hasZero = arith::OrIOp::create(builder_, loc, hasZero,
                                     compare(loc, arith::CmpIPredicate::eq, d, z));
    }
    Value count = arith::SelectOp::create(builder_, loc, hasZero, z, one);
    auto maximum = index(loc, std::numeric_limits<std::int64_t>::max() / 4);
    for (auto d : dimensions) {
      auto safe = arith::SelectOp::create(builder_, loc,
                                          compare(loc, arith::CmpIPredicate::eq, d, z), one, d);
      auto limit = arith::DivUIOp::create(builder_, loc, maximum, safe);
      guard(loc, compare(loc, arith::CmpIPredicate::ule, count, limit), 2);
      count = arith::MulIOp::create(builder_, loc, count, d);
    }
    return count;
  }
  Value castTensor(Location loc, Value value, Type target) {
    if (value.getType() == target)
      return value;
    return tensor::CastOp::create(builder_, loc, target, value);
  }
  Value reductionScratch(Location loc, Value count) {
    checkedCount(loc, {count});
    auto scratchType = MemRefType::get({ShapedType::kDynamic}, builder_.getF32Type());
    return memref::AllocOp::create(builder_, loc, scratchType, ValueRange{count});
  }
  Value scratchLoad(Location loc, Value scratch, Value i, unsigned width, Value base = {}) {
    Value offset = width == 1 ? i : arith::MulIOp::create(builder_, loc, i, index(loc, width));
    if (base)
      offset = arith::AddIOp::create(builder_, loc, base, offset);
    if (width == 1)
      return memref::LoadOp::create(builder_, loc, scratch, ValueRange{offset});
    return vector::LoadOp::create(builder_, loc, VectorType::get({width}, builder_.getF32Type()),
                                  scratch, ValueRange{offset});
  }
  void scratchStore(Location loc, Value value, Value scratch, Value i, unsigned width,
                    Value base = {}) {
    Value offset = width == 1 ? i : arith::MulIOp::create(builder_, loc, i, index(loc, width));
    if (base)
      offset = arith::AddIOp::create(builder_, loc, base, offset);
    if (width == 1)
      memref::StoreOp::create(builder_, loc, value, scratch, ValueRange{offset});
    else
      vector::StoreOp::create(builder_, loc, value, scratch, ValueRange{offset});
  }
  Value scratchReduction(Location loc, Value count, Value scratch, unsigned width = 1,
                         Value base = {}) {
    const auto z = index(loc, 0), one = index(loc, 1), two = index(loc, 2);
    const auto vectorType = VectorType::get({width}, builder_.getF32Type());
    const Type resultType = width == 1 ? Type(builder_.getF32Type()) : Type(vectorType);
    const auto load = [&](Value i) { return scratchLoad(loc, scratch, i, width, base); };
    const auto store = [&](Value value, Value i) {
      scratchStore(loc, value, scratch, i, width, base);
    };
    scf::WhileOp::create(
        builder_, loc, TypeRange{builder_.getIndexType()}, ValueRange{count},
        [&](OpBuilder &, Location, ValueRange args) {
          auto condition = compare(loc, arith::CmpIPredicate::ugt, args[0], one);
          scf::ConditionOp::create(builder_, loc, condition, args);
        },
        [&](OpBuilder &, Location, ValueRange args) {
          auto length = args[0];
          auto pairs = arith::DivUIOp::create(builder_, loc, length, two);
          auto odd = arith::RemUIOp::create(builder_, loc, length, two);
          auto next = arith::AddIOp::create(builder_, loc, pairs, odd);
          scf::ForOp::create(builder_, loc, z, pairs, one, ValueRange{},
                             [&](OpBuilder &, Location, Value i, ValueRange) {
                               auto first = arith::MulIOp::create(builder_, loc, i, two);
                               auto second = arith::AddIOp::create(builder_, loc, first, one);
                               auto a = load(first);
                               auto b = load(second);
                               auto sum = arith::AddFOp::create(builder_, loc, a, b);
                               store(sum, i);
                               scf::YieldOp::create(builder_, loc);
                             });
          scf::IfOp::create(builder_, loc, compare(loc, arith::CmpIPredicate::ne, odd, z),
                            [&](OpBuilder &, Location) {
                              auto last = arith::SubIOp::create(builder_, loc, length, one);
                              auto tail = load(last);
                              store(tail, pairs);
                              scf::YieldOp::create(builder_, loc);
                            });
          scf::YieldOp::create(builder_, loc, ValueRange{next});
        });
    auto result = scf::IfOp::create(builder_, loc, TypeRange{resultType},
                                    compare(loc, arith::CmpIPredicate::eq, count, z), true, true);
    {
      OpBuilder::InsertionGuard guard(builder_);
      builder_.setInsertionPointToStart(&result.getThenRegion().front());
      Value empty = zero(loc);
      if (width != 1)
        empty = vector::BroadcastOp::create(builder_, loc, vectorType, empty);
      scf::YieldOp::create(builder_, loc, ValueRange{empty});
      builder_.setInsertionPointToStart(&result.getElseRegion().front());
      auto value = load(z);
      scf::YieldOp::create(builder_, loc, ValueRange{value});
    }
    return result.getResult(0);
  }
  template <class Callback>
  Value reduction(Location loc, Value count, Value scratch, Callback element, unsigned width = 1) {
    const auto z = index(loc, 0), one = index(loc, 1);
    scf::ForOp::create(builder_, loc, z, count, one, ValueRange{},
                       [&](OpBuilder &, Location, Value i, ValueRange) {
                         scratchStore(loc, element(i), scratch, i, width);
                         scf::YieldOp::create(builder_, loc);
                       });
    return scratchReduction(loc, count, scratch, width);
  }
  Value blockCount(Location loc, Value count) {
    auto block = index(loc, 256);
    auto whole = arith::DivUIOp::create(builder_, loc, count, block);
    auto odd = arith::RemUIOp::create(builder_, loc, count, block);
    auto extra = arith::SelectOp::create(builder_, loc,
                                         compare(loc, arith::CmpIPredicate::ne, odd, index(loc, 0)),
                                         index(loc, 1), index(loc, 0));
    // Quotient/remainder avoids overflow from (count + 255) / 256.
    return arith::AddIOp::create(builder_, loc, whole, extra);
  }
  template <class Callback>
  Value blockedReduction(Location loc, Value count, Value scratch, Callback element,
                         unsigned width) {
    const auto block = index(loc, 256), z = index(loc, 0), one = index(loc, 1);
    const Type type = width == 1 ? Type(builder_.getF32Type())
                                 : Type(VectorType::get({width}, builder_.getF32Type()));
    auto result =
        scf::IfOp::create(builder_, loc, TypeRange{type},
                          compare(loc, arith::CmpIPredicate::ugt, count, block), true, true);
    {
      OpBuilder::InsertionGuard guard(builder_);
      builder_.setInsertionPointToStart(&result.getThenRegion().front());
      auto blocks = blockCount(loc, count);
      auto rootBase = index(loc, 256 * width);
      // Each aligned power-of-two block is a subtree of the original balanced
      // reduction. Its roots must themselves use the same adjacent-pair tree.
      scf::ForOp::create(
          builder_, loc, z, blocks, one, ValueRange{},
          [&](OpBuilder &, Location, Value chunk, ValueRange) {
            auto start = arith::MulIOp::create(builder_, loc, chunk, block);
            auto remaining = arith::SubIOp::create(builder_, loc, count, start);
            auto length = arith::MinUIOp::create(builder_, loc, remaining, block);
            auto sum = reduction(
                loc, length, scratch,
                [&](Value i) { return element(arith::AddIOp::create(builder_, loc, start, i)); },
                width);
            scratchStore(loc, sum, scratch, chunk, width, rootBase);
            scf::YieldOp::create(builder_, loc);
          });
      auto sum = scratchReduction(loc, blocks, scratch, width, rootBase);
      scf::YieldOp::create(builder_, loc, ValueRange{sum});
      builder_.setInsertionPointToStart(&result.getElseRegion().front());
      auto direct = reduction(loc, count, scratch, element, width);
      scf::YieldOp::create(builder_, loc, ValueRange{direct});
    }
    return result.getResult(0);
  }
  Value matmulKernel(Location loc, Value a, Value b, RankedTensorType output,
                     const Matmul &operation, bool wide) {
    if (operation.order != ReductionOrder::BalancedAdjacent || !operation.separatelyRoundedProducts)
      throw LoweringFailure{"unsupported matmul numerical policy"};
    auto left = dimensions(loc, a), right = dimensions(loc, b);
    if (operation.checkInnerExtent)
      guard(loc, compare(loc, arith::CmpIPredicate::eq, left[1], right[0]), 1);
    auto cells = checkedCount(loc, {left[0], right[1]});
    const auto z = index(loc, 0), one = index(loc, 1), two = index(loc, 2), four = index(loc, 4);
    const auto sixteen = index(loc, 16), block = index(loc, 256);
    auto noCells = compare(loc, arith::CmpIPredicate::eq, cells, z);
    auto rowCount = arith::SelectOp::create(builder_, loc, noCells, z, left[0]);
    auto hasPair = compare(loc, arith::CmpIPredicate::uge, right[1], two);
    auto narrowWidth = arith::SelectOp::create(builder_, loc, hasPair, two, one);
    auto hasTile = compare(loc, arith::CmpIPredicate::uge, right[1], four);
    auto smallWidth = arith::SelectOp::create(builder_, loc, hasTile, four, narrowWidth);
    Value width = smallWidth, count = left[1];
    if (wide) {
      width = index(loc, 64);
      auto blockedCount = arith::AddIOp::create(builder_, loc, block, blockCount(loc, left[1]));
      count = arith::SelectOp::create(builder_, loc,
                                      compare(loc, arith::CmpIPredicate::ugt, left[1], block),
                                      blockedCount, left[1]);
    }
    // Empty output must never size scratch from an unused, potentially enormous
    // contraction dimension. All paths/edge kernels reuse this one allocation.
    auto scratchCount = arith::SelectOp::create(builder_, loc, noCells, z, count);
    auto scratch = reductionScratch(loc, checkedCount(loc, {scratchCount, width}));
    auto remainder = arith::RemUIOp::create(builder_, loc, right[1], four);
    auto tiledColumns = arith::SubIOp::create(builder_, loc, right[1], remainder);
    SmallVector<Value> dynamic;
    if (output.isDynamicDim(0))
      dynamic.push_back(left[0]);
    if (output.isDynamicDim(1))
      dynamic.push_back(right[1]);
    auto empty =
        tensor::EmptyOp::create(builder_, loc, output.getShape(), builder_.getF32Type(), dynamic);
    // Explicit serial loops bufferize in place. Scratch is invocation-local;
    // tensor.generate would not guarantee exclusive use of mutable scratch.
    const auto tile = [&](Value row, Value column, Value input, unsigned rows, unsigned columns,
                          bool blocked) -> Value {
      const unsigned lanes = rows * columns;
      const auto vectorType = VectorType::get({lanes}, builder_.getF32Type());
      const auto product = [&](Value k) -> Value {
        Value singleX;
        if (rows == 1)
          singleX = tensor::ExtractOp::create(builder_, loc, a, ValueRange{row, k});
        SmallVector<Value> values;
        for (unsigned c = 0; c < columns; ++c) {
          auto col = arith::AddIOp::create(builder_, loc, column, index(loc, c));
          values.push_back(tensor::ExtractOp::create(builder_, loc, b, ValueRange{k, col}));
        }
        if (lanes == 1) {
          return arith::MulFOp::create(builder_, loc, singleX, values[0]);
        }
        Value lhs, rhs;
        if (rows == 1) {
          lhs = vector::BroadcastOp::create(builder_, loc, vectorType, singleX);
          rhs = vector::FromElementsOp::create(builder_, loc, vectorType, values);
        } else {
          SmallVector<Value> xs, ys;
          for (unsigned r = 0; r < rows; ++r) {
            auto at = arith::AddIOp::create(builder_, loc, row, index(loc, r));
            auto x = tensor::ExtractOp::create(builder_, loc, a, ValueRange{at, k});
            for (unsigned c = 0; c < columns; ++c) {
              xs.push_back(x);
              ys.push_back(values[c]); // Reuse RHS loads across all four rows.
            }
          }
          lhs = vector::FromElementsOp::create(builder_, loc, vectorType, xs);
          rhs = vector::FromElementsOp::create(builder_, loc, vectorType, ys);
        }
        return arith::MulFOp::create(builder_, loc, lhs, rhs);
      };
      auto sum = blocked ? blockedReduction(loc, left[1], scratch, product, lanes)
                         : reduction(loc, left[1], scratch, product, lanes);
      Value result = input;
      for (unsigned r = 0; r < rows; ++r)
        for (unsigned c = 0; c < columns; ++c) {
          Value value = sum;
          if (lanes != 1)
            value = vector::ExtractOp::create(builder_, loc, sum, std::int64_t(r * columns + c));
          auto at = arith::AddIOp::create(builder_, loc, row, index(loc, r));
          auto col = arith::AddIOp::create(builder_, loc, column, index(loc, c));
          result = tensor::InsertOp::create(builder_, loc, value, result, ValueRange{at, col});
        }
      return result;
    };
    const auto rowKernel = [&](unsigned lanes, Value input, Value firstColumn,
                               bool blocked) -> Value {
      auto rows = scf::ForOp::create(
          builder_, loc, z, rowCount, one, ValueRange{input},
          [&](OpBuilder &, Location, Value row, ValueRange rowValues) {
            Value result = rowValues[0];
            if (lanes == 4) {
              auto tiles = scf::ForOp::create(
                  builder_, loc, firstColumn, tiledColumns, four, ValueRange{result},
                  [&](OpBuilder &, Location, Value column, ValueRange values) {
                    auto value = tile(row, column, values[0], 1, 4, blocked);
                    scf::YieldOp::create(builder_, loc, ValueRange{value});
                  });
              auto pair = scf::IfOp::create(builder_, loc, TypeRange{empty.getType()},
                                            compare(loc, arith::CmpIPredicate::uge, remainder, two),
                                            true, true);
              {
                OpBuilder::InsertionGuard guard(builder_);
                builder_.setInsertionPointToStart(&pair.getThenRegion().front());
                auto value = tile(row, tiledColumns, tiles.getResult(0), 1, 2, blocked);
                scf::YieldOp::create(builder_, loc, ValueRange{value});
                builder_.setInsertionPointToStart(&pair.getElseRegion().front());
                scf::YieldOp::create(builder_, loc, tiles.getResults());
              }
              result = pair.getResult(0);
            } else if (lanes == 2)
              result = tile(row, z, result, 1, 2, blocked);
            if (lanes == 1)
              result = tile(row, z, result, 1, 1, blocked);
            else {
              auto odd = arith::RemUIOp::create(builder_, loc, right[1], two);
              auto tail =
                  scf::IfOp::create(builder_, loc, TypeRange{empty.getType()},
                                    compare(loc, arith::CmpIPredicate::ne, odd, z), true, true);
              {
                OpBuilder::InsertionGuard guard(builder_);
                builder_.setInsertionPointToStart(&tail.getThenRegion().front());
                auto col = arith::SubIOp::create(builder_, loc, right[1], one);
                auto value = tile(row, col, result, 1, 1, blocked);
                scf::YieldOp::create(builder_, loc, ValueRange{value});
                builder_.setInsertionPointToStart(&tail.getElseRegion().front());
                scf::YieldOp::create(builder_, loc, ValueRange{result});
              }
              result = tail.getResult(0);
            }
            scf::YieldOp::create(builder_, loc, ValueRange{result});
          });
      return rows.getResult(0);
    };
    if (wide) {
      auto fullRows = arith::SubIOp::create(builder_, loc, rowCount,
                                            arith::RemUIOp::create(builder_, loc, rowCount, four));
      auto fullColumns = arith::SubIOp::create(
          builder_, loc, right[1], arith::RemUIOp::create(builder_, loc, right[1], sixteen));
      auto main =
          scf::ForOp::create(builder_, loc, z, fullRows, four, ValueRange{empty},
                             [&](OpBuilder &, Location, Value row, ValueRange values) {
                               auto cols = scf::ForOp::create(
                                   builder_, loc, z, fullColumns, sixteen, values,
                                   [&](OpBuilder &, Location, Value col, ValueRange outputs) {
                                     auto result = tile(row, col, outputs[0], 4, 16, true);
                                     scf::YieldOp::create(builder_, loc, ValueRange{result});
                                   });
                               scf::YieldOp::create(builder_, loc, cols.getResults());
                             });
      // Remaining rows still process sixteen columns together. Column edges
      // use 4/2/1 lanes, but MUST use blocked reductions with this scratch
      // bound.
      auto bottom =
          scf::ForOp::create(builder_, loc, fullRows, rowCount, one, main.getResults(),
                             [&](OpBuilder &, Location, Value row, ValueRange values) {
                               auto cols = scf::ForOp::create(
                                   builder_, loc, z, fullColumns, sixteen, values,
                                   [&](OpBuilder &, Location, Value col, ValueRange outputs) {
                                     auto result = tile(row, col, outputs[0], 1, 16, true);
                                     scf::YieldOp::create(builder_, loc, ValueRange{result});
                                   });
                               scf::YieldOp::create(builder_, loc, cols.getResults());
                             });
      auto edge = scf::IfOp::create(builder_, loc, TypeRange{empty.getType()},
                                    compare(loc, arith::CmpIPredicate::ne, fullColumns, right[1]),
                                    true, true);
      {
        OpBuilder::InsertionGuard guard(builder_);
        builder_.setInsertionPointToStart(&edge.getThenRegion().front());
        auto value = rowKernel(4, bottom.getResult(0), fullColumns, true);
        scf::YieldOp::create(builder_, loc, ValueRange{value});
        builder_.setInsertionPointToStart(&edge.getElseRegion().front());
        scf::YieldOp::create(builder_, loc, bottom.getResults());
      }
      return edge.getResult(0);
    }
    auto small = scf::IfOp::create(builder_, loc, TypeRange{empty.getType()}, hasTile, true, true);
    {
      OpBuilder::InsertionGuard guard(builder_);
      builder_.setInsertionPointToStart(&small.getThenRegion().front());
      auto value = rowKernel(4, empty, z, false);
      scf::YieldOp::create(builder_, loc, ValueRange{value});
      builder_.setInsertionPointToStart(&small.getElseRegion().front());
      auto narrow =
          scf::IfOp::create(builder_, loc, TypeRange{empty.getType()}, hasPair, true, true);
      {
        OpBuilder::InsertionGuard guard(builder_);
        builder_.setInsertionPointToStart(&narrow.getThenRegion().front());
        auto pair = rowKernel(2, empty, z, false);
        scf::YieldOp::create(builder_, loc, ValueRange{pair});
        builder_.setInsertionPointToStart(&narrow.getElseRegion().front());
        auto single = rowKernel(1, empty, z, false);
        scf::YieldOp::create(builder_, loc, ValueRange{single});
      }
      scf::YieldOp::create(builder_, loc, narrow.getResults());
    }
    return small.getResult(0);
  }
  Value matmul(Location loc, Value a, Value b, RankedTensorType output, const Matmul &operation) {
    // Outlining prevents a large SIMD kernel's register/stack requirements from
    // penalizing narrow shapes in the surrounding source function.
    func::FuncOp helper;
    {
      OpBuilder::InsertionGuard guard(builder_);
      builder_.setInsertionPointToEnd(module_->getBody());
      helper = func::FuncOp::create(
          builder_, loc, "kalandra_fn_matmul_wide_" + std::to_string(nextMatmulHelper_++),
          builder_.getFunctionType({a.getType(), b.getType()}, {output}));
      helper.setPrivate();
      builder_.setInsertionPointToStart(helper.addEntryBlock());
      auto result =
          matmulKernel(loc, helper.getArgument(0), helper.getArgument(1), output, operation, true);
      func::ReturnOp::create(builder_, loc, ValueRange{result});
    }
    auto left = dimensions(loc, a), right = dimensions(loc, b);
    auto useWide = arith::AndIOp::create(
        builder_, loc, compare(loc, arith::CmpIPredicate::uge, left[0], index(loc, 4)),
        compare(loc, arith::CmpIPredicate::uge, right[1], index(loc, 16)));
    auto dispatch = scf::IfOp::create(builder_, loc, TypeRange{output}, useWide, true, true);
    {
      OpBuilder::InsertionGuard guard(builder_);
      builder_.setInsertionPointToStart(&dispatch.getThenRegion().front());
      auto call = func::CallOp::create(builder_, loc, helper, ValueRange{a, b});
      scf::YieldOp::create(builder_, loc, call.getResults());
      builder_.setInsertionPointToStart(&dispatch.getElseRegion().front());
      auto small = matmulKernel(loc, a, b, output, operation, false);
      scf::YieldOp::create(builder_, loc, ValueRange{small});
    }
    return dispatch.getResult(0);
  }
  Value reduce(Location loc, Value tensor, const ReduceSum &operation) {
    if (operation.order != ReductionOrder::BalancedAdjacent || !operation.rowMajor)
      throw LoweringFailure{"unsupported reduction numerical policy"};
    auto shape = dimensions(loc, tensor);
    auto count = checkedCount(loc, shape);
    auto scratch = reductionScratch(loc, count);
    return reduction(loc, count, scratch, [&](Value linear) -> Value {
      SmallVector<Value> indices(shape.size());
      for (std::size_t axis = shape.size(); axis > 0; --axis) {
        indices[axis - 1] = arith::RemUIOp::create(builder_, loc, linear, shape[axis - 1]);
        linear = arith::DivUIOp::create(builder_, loc, linear, shape[axis - 1]);
      }
      return tensor::ExtractOp::create(builder_, loc, tensor, indices);
    });
  }
  Value elementwise(Location loc, Value a, Value b, RankedTensorType output, TokenKind op) {
    const bool tensorA = isa<RankedTensorType>(a.getType());
    const bool tensorB = b && isa<RankedTensorType>(b.getType());
    auto shape = dimensions(loc, tensorA ? a : b);
    if (tensorA && tensorB) {
      auto other = dimensions(loc, b);
      for (std::size_t axis = 0; axis < shape.size(); ++axis)
        guard(loc, compare(loc, arith::CmpIPredicate::eq, shape[axis], other[axis]), 1);
    }
    checkedCount(loc, shape);
    SmallVector<Value> dynamic;
    for (std::size_t axis = 0; axis < shape.size(); ++axis)
      if (output.isDynamicDim(axis))
        dynamic.push_back(shape[axis]);
    Value empty =
        tensor::EmptyOp::create(builder_, loc, output.getShape(), builder_.getF32Type(), dynamic);
    SmallVector<Value> indices;
    const auto zero = index(loc, 0), one = index(loc, 1);
    std::function<Value(std::size_t, Value)> loop = [&](std::size_t axis, Value tensor) -> Value {
      if (axis == shape.size()) {
        Value left = tensorA ? tensor::ExtractOp::create(builder_, loc, a, indices).getResult() : a;
        Value result;
        if (!b) {
          result = arith::NegFOp::create(builder_, loc, left);
        } else {
          Value right =
              tensorB ? tensor::ExtractOp::create(builder_, loc, b, indices).getResult() : b;
          const char *arithmetic = op == TokenKind::Plus    ? "arith.addf"
                                   : op == TokenKind::Minus ? "arith.subf"
                                   : op == TokenKind::Slash ? "arith.divf"
                                                            : "arith.mulf";
          result = binary(loc, arithmetic, left, right);
        }
        return tensor::InsertOp::create(builder_, loc, result, tensor, indices);
      }
      auto iteration = scf::ForOp::create(builder_, loc, zero, shape[axis], one, ValueRange{tensor},
                                          [&](OpBuilder &, Location, Value i, ValueRange args) {
                                            indices.push_back(i);
                                            auto result = loop(axis + 1, args[0]);
                                            indices.pop_back();
                                            scf::YieldOp::create(builder_, loc, ValueRange{result});
                                          });
      return iteration.getResult(0);
    };
    return loop(0, empty);
  }
  struct Frame {
    std::unordered_map<ValueId, Value> values;
    std::unordered_map<SymbolId, Value> symbols;
  };
  Value expression(Frame &frame, ValueId id) {
    if (auto found = frame.values.find(id); found != frame.values.end())
      return found->second;
    const auto &node = input_.expressions[id];
    auto loc = location(node.span);
    auto value = std::visit(
        [&](const auto &operation) -> Value {
          using T = std::decay_t<decltype(operation)>;
          if constexpr (std::is_same_v<T, Float32Literal>) {
            llvm::APFloat number(llvm::APFloat::IEEEsingle(), llvm::APInt(32, operation.bits));
            return arith::ConstantFloatOp::create(builder_, loc, builder_.getF32Type(), number);
          } else if constexpr (std::is_same_v<T, Int32Literal>) {
            return arith::ConstantIntOp::create(builder_, loc, operation.value, 32);
          } else if constexpr (std::is_same_v<T, SymbolRead>)
            return frame.symbols.at(operation.symbol);
          else if constexpr (std::is_same_v<T, ScalarUnary>) {
            auto operand = expression(frame, operation.operand);
            if (node.type.element == NumericType::Int32) {
              if (operation.operation == TokenKind::Plus)
                return operand;
              auto wide = arith::ExtSIOp::create(builder_, loc, builder_.getI64Type(), operand);
              return checkedInt32(loc, arith::SubIOp::create(builder_, loc, integer(loc, 0), wide));
            }
            return operation.operation == TokenKind::Minus
                       ? arith::NegFOp::create(builder_, loc, operand).getResult()
                       : operand;
          } else if constexpr (std::is_same_v<T, ScalarBinary>) {
            auto a = expression(frame, operation.left), b = expression(frame, operation.right);
            if (node.type.element == NumericType::Int32) {
              a = arith::ExtSIOp::create(builder_, loc, builder_.getI64Type(), a);
              b = arith::ExtSIOp::create(builder_, loc, builder_.getI64Type(), b);
              if (operation.operation == TokenKind::Slash || operation.operation == TokenKind::Percent)
                guard(loc, compare(loc, arith::CmpIPredicate::ne, b, integer(loc, 0)), 4);
              const char *op = operation.operation == TokenKind::Plus ? "arith.addi"
                               : operation.operation == TokenKind::Minus ? "arith.subi"
                               : operation.operation == TokenKind::Star ? "arith.muli"
                               : operation.operation == TokenKind::Percent ? "arith.remsi" : "arith.divsi";
              return checkedInt32(loc, binary(loc, op, a, b));
            }
            const char *name = operation.operation == TokenKind::Plus    ? "arith.addf"
                               : operation.operation == TokenKind::Minus ? "arith.subf"
                               : operation.operation == TokenKind::Star  ? "arith.mulf"
                                                                         : "arith.divf";
            return binary(loc, name, a, b);
          } else if constexpr (std::is_same_v<T, TensorUnary>) {
            return elementwise(loc, expression(frame, operation.operand), {},
                               cast<RankedTensorType>(type(node.type)), operation.operation);
          } else if constexpr (std::is_same_v<T, TensorBinary>) {
            auto a = expression(frame, operation.left), b = expression(frame, operation.right);
            return elementwise(loc, a, b, cast<RankedTensorType>(type(node.type)),
                               operation.operation);
          } else if constexpr (std::is_same_v<T, TensorLiteral>) {
            SmallVector<Value> elements;
            for (auto child : operation.elements)
              elements.push_back(expression(frame, child));
            return tensor::FromElementsOp::create(builder_, loc, type(node.type), elements);
          } else if constexpr (std::is_same_v<T, FunctionCall>) {
            SmallVector<Value> arguments;
            for (std::size_t i = 0; i < operation.arguments.size(); ++i) {
              auto argument = expression(frame, operation.arguments[i]);
              arguments.push_back(
                  castTensor(loc, argument, functions_[operation.function].getArgumentTypes()[i]));
            }
            auto call =
                func::CallOp::create(builder_, loc, functions_[operation.function], arguments);
            return castTensor(loc, call.getResult(0), type(node.type));
          } else if constexpr (std::is_same_v<T, Matmul>) {
            auto a = expression(frame, operation.left), b = expression(frame, operation.right);
            return matmul(loc, a, b, cast<RankedTensorType>(type(node.type)), operation);
          } else if constexpr (std::is_same_v<T, ReduceSum>)
            return reduce(loc, expression(frame, operation.input), operation);
          else if constexpr (std::is_same_v<T, DeviceSelection> || std::is_same_v<T, Transfer> ||
                             std::is_same_v<T, TaskOperation> ||
                             std::is_same_v<T, ParallelOperation> ||
                             std::is_same_v<T, CatchOperation> ||
                             std::is_same_v<T, MatchOperation> ||
                             std::is_same_v<T, ErrorFieldRead> ||
                             std::is_same_v<T, FailOperation>) {
            throw LoweringFailure{"task operation requires continuation lowering"};
          } else if constexpr (std::is_same_v<T, ShapeCheck>) {
            auto input = expression(frame, operation.input);
            for (const auto &requirement : operation.requirements) {
              auto actual =
                  tensor::DimOp::create(builder_, loc, input, index(loc, requirement.axis));
              guard(loc,
                    compare(loc, arith::CmpIPredicate::eq, actual, index(loc, requirement.extent)),
                    1);
            }
            return castTensor(loc, input, type(node.type));
          }
        },
        node.operation);
    frame.values.emplace(id, value);
    return value;
  }
  void body(FunctionId id) {
    auto function = functions_[id];
    auto *entry = function.addEntryBlock();
    builder_.setInsertionPointToStart(entry);
    Frame frame;
    for (std::size_t i = 0; i < input_.functions[id].parameters.size(); ++i)
      frame.symbols.emplace(input_.functions[id].parameters[i], entry->getArgument(i));
    Value result;
    for (const auto &statement : input_.functions[id].body) {
      result = expression(frame, statement.value);
      if (statement.binding)
        frame.symbols.emplace(*statement.binding, result);
    }
    auto value = castTensor(function.getLoc(), result, function.getResultTypes()[0]);
    func::ReturnOp::create(builder_, function.getLoc(), value);
  }
  void interfaceWrapper(const std::string &name,
                        const std::string &symbol = "kalandra_test_entry") {
    auto found =
        std::ranges::find_if(input_.functions, [&](const auto &f) { return f.name == name; });
    if (found == input_.functions.end())
      throw LoweringFailure{"interface entry must name a function"};
    const auto id = static_cast<FunctionId>(found - input_.functions.begin());
    SmallVector<Type> arguments;
    for (auto parameter : found->parameters) {
      const auto &t = input_.symbols[parameter].type;
      if (!t.tensor)
        arguments.push_back(type(t));
      else
        arguments.push_back(
            MemRefType::get(SmallVector<std::int64_t>(t.shape.size(), ShapedType::kDynamic),
                            builder_.getF32Type()));
    }
    builder_.setInsertionPointToEnd(module_->getBody());
    auto function =
        func::FuncOp::create(builder_, location(found->declaration), symbol,
                             builder_.getFunctionType(arguments, functions_[id].getResultTypes()));
    function->setAttr("llvm.emit_c_interface", builder_.getUnitAttr());
    builder_.setInsertionPointToStart(function.addEntryBlock());
    SmallVector<Value> operands;
    for (std::size_t i = 0; i < arguments.size(); ++i) {
      Value argument = function.getArgument(i);
      const auto &t = input_.symbols[found->parameters[i]].type;
      if (t.tensor) {
        SmallVector<Value> shape;
        for (std::size_t axis = 0; axis < t.shape.size(); ++axis) {
          auto d = memref::DimOp::create(builder_, function.getLoc(), argument,
                                         index(function.getLoc(), axis));
          shape.push_back(d);
          if (t.shape[axis].constant)
            guard(function.getLoc(),
                  compare(function.getLoc(), arith::CmpIPredicate::eq, d,
                          index(function.getLoc(), *t.shape[axis].constant)),
                  1);
        }
        checkedCount(function.getLoc(), shape);
        auto tensorType = RankedTensorType::get(
            SmallVector<std::int64_t>(t.shape.size(), ShapedType::kDynamic), builder_.getF32Type());
        argument = bufferization::ToTensorOp::create(builder_, function.getLoc(), tensorType,
                                                     argument, true, false);
        argument = castTensor(function.getLoc(), argument, type(t));
      }
      operands.push_back(argument);
    }
    auto call = func::CallOp::create(builder_, function.getLoc(), functions_[id], operands);
    func::ReturnOp::create(builder_, function.getLoc(), call.getResults());
  }
  const TypedModule &input_;
  OpBuilder builder_;
  OwningOpRef<ModuleOp> module_;
  std::vector<func::FuncOp> functions_;
  unsigned nextMatmulHelper_ = 0;
};
} // namespace
std::expected<BackendOutput, std::string> lowerNative(const TypedModule &input,
                                                      std::optional<std::string> testEntry,
                                                      const std::vector<std::string> &exports) {
  if (auto error = numericCapabilityError(input, NumericTarget::Cpu))
    return std::unexpected(*error);
  if (hasPlacement(input))
    return std::unexpected("placement-aware IR requires a placement-capable execution backend");
  if (std::ranges::any_of(input.functions, [](const auto &f) { return f.resultType.fallible; }) ||
      std::ranges::any_of(input.expressions, [](const auto &e) {
        return std::holds_alternative<TaskOperation>(e.operation) ||
               std::holds_alternative<ParallelOperation>(e.operation) ||
               std::holds_alternative<CatchOperation>(e.operation) ||
               std::holds_alternative<MatchOperation>(e.operation);
      })) {
    if (!exports.empty())
      return std::unexpected("CPU bridge exports require ordinary synchronous functions");
    return lowerTaskNative(input, testEntry);
  }
  DialectRegistry registry;
  registerAllDialects(registry);
  registerAllExtensions(registry);
  registerAllToLLVMIRTranslations(registry);
  MLIRContext context(registry);
  context.loadAllAvailableDialects();
  static std::once_flag passRegistration;
  std::call_once(passRegistration, [] { registerAllPasses(); });
  try {
    auto module = Lowerer(input, context).run(testEntry, exports);
    if (failed(verify(*module)))
      return std::unexpected("generated tensor MLIR failed verification");
    BackendOutput result;
    {
      llvm::raw_string_ostream source(result.mlir);
      module->print(source);
    }
    PassManager pipeline(&context);
    pipeline.enableVerifier(true);
    const char *passes = "one-shot-bufferize{bufferize-function-boundaries},convert-linalg-to-"
                         "loops,buffer-deallocation-pipeline,convert-bufferization-to-memref";
    if (failed(parsePassPipeline(passes, pipeline)))
      return std::unexpected("cannot construct pinned lowering pipeline");
    if (failed(pipeline.run(*module)))
      return std::unexpected("native MLIR lowering failed");
    SmallVector<memref::CopyOp> copies;
    module->walk([&](memref::CopyOp op) { copies.push_back(op); });
    for (auto copy : copies) {
      OpBuilder builder(copy);
      auto loc = copy.getLoc();
      const auto rank = cast<MemRefType>(copy.getSource().getType()).getRank();
      SmallVector<Value> indices;
      std::function<void(std::int64_t)> emitCopy = [&](std::int64_t axis) {
        if (axis == rank) {
          auto value = memref::LoadOp::create(builder, loc, copy.getSource(), indices);
          memref::StoreOp::create(builder, loc, value, copy.getTarget(), indices);
          return;
        }
        auto zero = arith::ConstantIndexOp::create(builder, loc, 0);
        auto one = arith::ConstantIndexOp::create(builder, loc, 1);
        auto count = memref::DimOp::create(builder, loc, copy.getSource(), axis);
        scf::ForOp::create(builder, loc, zero, count, one, ValueRange{},
                           [&](OpBuilder &, Location, Value index, ValueRange) {
                             indices.push_back(index);
                             emitCopy(axis + 1);
                             indices.pop_back();
                             scf::YieldOp::create(builder, loc);
                           });
      };
      emitCopy(0);
      copy.erase();
    }
    PassManager llvmPipeline(&context);
    llvmPipeline.enableVerifier(true);
    if (failed(parsePassPipeline("convert-vector-to-llvm,convert-scf-to-cf,finalize-memref-to-llvm{"
                                 "use-generic-functions},"
                                 "convert-to-llvm,reconcile-unrealized-casts",
                                 llvmPipeline)) ||
        failed(llvmPipeline.run(*module)))
      return std::unexpected("LLVM dialect lowering failed");
    llvm::LLVMContext llvmContext;
    auto native = translateModuleToLLVMIR(*module, llvmContext);
    if (!native)
      return std::unexpected("LLVM translation failed");
    if (auto error = addCheckedInvocationABI(*native))
      return std::unexpected(*error);
    native->setTargetTriple(llvm::Triple("arm64-apple-macosx"));
    for (auto &function : *native)
      if (function.getName().starts_with("kalandra_fn_"))
        function.addFnAttr(llvm::Attribute::NoInline);
    std::string errors;
    llvm::raw_string_ostream errorStream(errors);
    if (llvm::verifyModule(*native, &errorStream))
      return std::unexpected("generated LLVM IR failed verification: " + errors);
    {
      llvm::raw_string_ostream llvmOutput(result.llvm);
      native->print(llvmOutput, nullptr);
    }
    return result;
  } catch (const LoweringFailure &failure) {
    return std::unexpected(failure.message);
  }
}
} // namespace kalandra
