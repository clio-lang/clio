#include "kalandra/Backend.h"
#include "mlir/Dialect/Arith/IR/Arith.h"
#include "mlir/Dialect/Bufferization/IR/Bufferization.h"
#include "mlir/Dialect/Func/IR/FuncOps.h"
#include "mlir/Dialect/MemRef/IR/MemRef.h"
#include "mlir/Dialect/SCF/IR/SCF.h"
#include "mlir/Dialect/Tensor/IR/Tensor.h"
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
  OwningOpRef<ModuleOp> run(const std::optional<std::string> &testEntry) {
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
    auto main =
        std::ranges::find_if(input_.functions, [](const auto &f) { return f.name == "main"; });
    if (main == input_.functions.end() || !main->parameters.empty() || main->resultType.tensor)
      throw LoweringFailure{"native entry requires fn main() -> float32 with no parameters"};
    builder_.setInsertionPointToEnd(module_->getBody());
    auto entry = func::FuncOp::create(builder_, location(main->declaration), "kalandra_entry",
                                      builder_.getFunctionType({}, {builder_.getF32Type()}));
    entry->setAttr("llvm.emit_c_interface", builder_.getUnitAttr());
    builder_.setInsertionPointToStart(entry.addEntryBlock());
    const auto mainId = static_cast<FunctionId>(main - input_.functions.begin());
    auto call = func::CallOp::create(builder_, entry.getLoc(), functions_[mainId], ValueRange{});
    func::ReturnOp::create(builder_, entry.getLoc(), call.getResults());
    if (testEntry)
      testWrapper(*testEntry);
    return std::move(module_);
  }

private:
  Location location(SourceSpan span) const {
    auto [line, column] = input_.source->location(span.begin);
    return FileLineColLoc::get(builder_.getContext(), input_.source->path(), line, column);
  }
  Type type(const ValueType &value) {
    if (!value.tensor)
      return builder_.getF32Type();
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
  template <class Callback>
  Value reduction(Location loc, Value count, Value scratch, Callback element) {
    const auto z = index(loc, 0), one = index(loc, 1), two = index(loc, 2);
    scf::ForOp::create(builder_, loc, z, count, one, ValueRange{},
                       [&](OpBuilder &, Location, Value i, ValueRange) {
                         auto value = element(i);
                         memref::StoreOp::create(builder_, loc, value, scratch, ValueRange{i});
                         scf::YieldOp::create(builder_, loc);
                       });
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
          scf::ForOp::create(
              builder_, loc, z, pairs, one, ValueRange{},
              [&](OpBuilder &, Location, Value i, ValueRange) {
                auto first = arith::MulIOp::create(builder_, loc, i, two);
                auto second = arith::AddIOp::create(builder_, loc, first, one);
                auto a = memref::LoadOp::create(builder_, loc, scratch, ValueRange{first});
                auto b = memref::LoadOp::create(builder_, loc, scratch, ValueRange{second});
                auto sum = arith::AddFOp::create(builder_, loc, a, b);
                memref::StoreOp::create(builder_, loc, sum, scratch, ValueRange{i});
                scf::YieldOp::create(builder_, loc);
              });
          scf::IfOp::create(
              builder_, loc, compare(loc, arith::CmpIPredicate::ne, odd, z),
              [&](OpBuilder &, Location) {
                auto last = arith::SubIOp::create(builder_, loc, length, one);
                auto tail = memref::LoadOp::create(builder_, loc, scratch, ValueRange{last});
                memref::StoreOp::create(builder_, loc, tail, scratch, ValueRange{pairs});
                scf::YieldOp::create(builder_, loc);
              });
          scf::YieldOp::create(builder_, loc, ValueRange{next});
        });
    auto result = scf::IfOp::create(builder_, loc, TypeRange{builder_.getF32Type()},
                                    compare(loc, arith::CmpIPredicate::eq, count, z), true, true);
    {
      OpBuilder::InsertionGuard guard(builder_);
      builder_.setInsertionPointToStart(&result.getThenRegion().front());
      scf::YieldOp::create(builder_, loc, ValueRange{zero(loc)});
      builder_.setInsertionPointToStart(&result.getElseRegion().front());
      auto value = memref::LoadOp::create(builder_, loc, scratch, ValueRange{z});
      scf::YieldOp::create(builder_, loc, ValueRange{value});
    }
    return result.getResult(0);
  }
  Value matmul(Location loc, Value a, Value b, RankedTensorType output, const Matmul &operation) {
    if (operation.order != ReductionOrder::BalancedAdjacent || !operation.separatelyRoundedProducts)
      throw LoweringFailure{"unsupported matmul numerical policy"};
    auto left = dimensions(loc, a), right = dimensions(loc, b);
    if (operation.checkInnerExtent)
      guard(loc, compare(loc, arith::CmpIPredicate::eq, left[1], right[0]), 1);
    auto cells = checkedCount(loc, {left[0], right[1]});
    const auto z = index(loc, 0), one = index(loc, 1);
    // Empty outputs never evaluate a contraction. Do not size scratch from an
    // unused inner extent (which may otherwise overflow allocation arithmetic).
    auto noCells = compare(loc, arith::CmpIPredicate::eq, cells, z);
    auto scratchCount = arith::SelectOp::create(builder_, loc, noCells, z, left[1]);
    auto rowCount = arith::SelectOp::create(builder_, loc, noCells, z, left[0]);
    auto scratch = reductionScratch(loc, scratchCount);
    SmallVector<Value> dynamic;
    if (output.isDynamicDim(0))
      dynamic.push_back(left[0]);
    if (output.isDynamicDim(1))
      dynamic.push_back(right[1]);
    auto empty =
        tensor::EmptyOp::create(builder_, loc, output.getShape(), builder_.getF32Type(), dynamic);
    // Explicit serial loops own one scratch buffer. A tensor.generate region
    // may evaluate cells independently; sharing mutable scratch there would
    // make later parallel lowering unsafe. Each invocation owns its own buffer.
    auto rows = scf::ForOp::create(
        builder_, loc, z, rowCount, one, ValueRange{empty},
        [&](OpBuilder &, Location, Value row, ValueRange rowValues) {
          auto columns = scf::ForOp::create(
              builder_, loc, z, right[1], one, rowValues,
              [&](OpBuilder &, Location, Value column, ValueRange columnValues) {
                auto sum = reduction(loc, left[1], scratch, [&](Value k) -> Value {
                  auto x = tensor::ExtractOp::create(builder_, loc, a, ValueRange{row, k});
                  auto y = tensor::ExtractOp::create(builder_, loc, b, ValueRange{k, column});
                  return arith::MulFOp::create(builder_, loc, x, y);
                });
                auto inserted = tensor::InsertOp::create(builder_, loc, sum, columnValues[0],
                                                         ValueRange{row, column});
                scf::YieldOp::create(builder_, loc, ValueRange{inserted});
              });
          scf::YieldOp::create(builder_, loc, columns.getResults());
        });
    return rows.getResult(0);
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
          } else if constexpr (std::is_same_v<T, SymbolRead>)
            return frame.symbols.at(operation.symbol);
          else if constexpr (std::is_same_v<T, ScalarUnary>) {
            auto operand = expression(frame, operation.operand);
            return operation.operation == TokenKind::Minus
                       ? arith::NegFOp::create(builder_, loc, operand).getResult()
                       : operand;
          } else if constexpr (std::is_same_v<T, ScalarBinary>) {
            auto a = expression(frame, operation.left), b = expression(frame, operation.right);
            const char *name = operation.operation == TokenKind::Plus    ? "arith.addf"
                               : operation.operation == TokenKind::Minus ? "arith.subf"
                               : operation.operation == TokenKind::Star  ? "arith.mulf"
                                                                         : "arith.divf";
            return binary(loc, name, a, b);
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
          else if constexpr (std::is_same_v<T, TaskOperation> ||
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
  void testWrapper(const std::string &name) {
    auto found =
        std::ranges::find_if(input_.functions, [&](const auto &f) { return f.name == name; });
    if (found == input_.functions.end() || found->resultType.tensor)
      throw LoweringFailure{"test entry must name a float32-returning function"};
    const auto id = static_cast<FunctionId>(found - input_.functions.begin());
    SmallVector<Type> arguments;
    for (auto parameter : found->parameters) {
      const auto &t = input_.symbols[parameter].type;
      if (!t.tensor)
        arguments.push_back(builder_.getF32Type());
      else
        arguments.push_back(
            MemRefType::get(SmallVector<std::int64_t>(t.shape.size(), ShapedType::kDynamic),
                            builder_.getF32Type()));
    }
    builder_.setInsertionPointToEnd(module_->getBody());
    auto function =
        func::FuncOp::create(builder_, location(found->declaration), "kalandra_test_entry",
                             builder_.getFunctionType(arguments, {builder_.getF32Type()}));
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
};
} // namespace
std::expected<BackendOutput, std::string> lowerNative(const TypedModule &input,
                                                      std::optional<std::string> testEntry) {
  if (std::ranges::any_of(input.functions, [](const auto &f) { return f.resultType.fallible; }) ||
      std::ranges::any_of(input.expressions, [](const auto &e) {
        return std::holds_alternative<TaskOperation>(e.operation) ||
               std::holds_alternative<ParallelOperation>(e.operation) ||
               std::holds_alternative<CatchOperation>(e.operation) ||
               std::holds_alternative<MatchOperation>(e.operation);
      }))
    return lowerTaskNative(input, testEntry);
  DialectRegistry registry;
  registerAllDialects(registry);
  registerAllExtensions(registry);
  registerAllToLLVMIRTranslations(registry);
  MLIRContext context(registry);
  context.loadAllAvailableDialects();
  static std::once_flag passRegistration;
  std::call_once(passRegistration, [] { registerAllPasses(); });
  try {
    auto module = Lowerer(input, context).run(testEntry);
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
    if (failed(parsePassPipeline("convert-scf-to-cf,finalize-memref-to-llvm{use-generic-functions},"
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
