#include "kalandra/Backend.h"
#include "CollectionMetadata.h"
#include "NativeLayout.h"
#include "RecordLayout.h"
#include "kalandra/NumericConversion.h"
#include "kalandra/StrictFloat.h"
#include "mlir/Dialect/Arith/IR/Arith.h"
#include "mlir/Dialect/Bufferization/IR/Bufferization.h"
#include "mlir/Dialect/Func/IR/FuncOps.h"
#include "mlir/Dialect/LLVMIR/LLVMDialect.h"
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
#include "mlir/Target/LLVMIR/TypeToLLVM.h"
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
    if (hasRecordCollections(input_) || hasOrdinaryStrings(input_)) {
      const auto ptr = LLVM::LLVMPointerType::get(builder_.getContext());
      for (const auto &[name, signature] : std::vector<std::pair<std::string, FunctionType>>{
               {"kalandra_record_alloc", builder_.getFunctionType({builder_.getI64Type()}, {ptr})},
               {"kalandra_record_cleanup", builder_.getFunctionType({}, {})},
               {"kalandra_record_array_validate",
                builder_.getFunctionType({ptr, builder_.getI64Type(), builder_.getI64Type()}, {})},
               {"kalandra_record_validate",
                builder_.getFunctionType({ptr, builder_.getI64Type(), builder_.getI64Type()},
                                         {})}}) {
        auto fn = func::FuncOp::create(builder_, builder_.getUnknownLoc(), name, signature);
        fn.setPrivate();
      }
    }
    if (hasOrdinaryStrings(input_)) {
      const auto ptr = LLVM::LLVMPointerType::get(builder_.getContext());
      for (const auto &[name, signature] : std::vector<std::pair<std::string, FunctionType>>{
               {"kalandra_string_literal",
                builder_.getFunctionType({ptr, ptr, builder_.getI64Type()}, {})},
               {"kalandra_string_validate", builder_.getFunctionType({ptr}, {})},
               {"kalandra_string_length", builder_.getFunctionType({ptr}, {builder_.getI64Type()})},
               {"kalandra_string_byte_length",
                builder_.getFunctionType({ptr}, {builder_.getI64Type()})},
               {"kalandra_string_concat", builder_.getFunctionType({ptr, ptr, ptr}, {})},
               {"kalandra_string_equal",
                builder_.getFunctionType({ptr, ptr}, {builder_.getI64Type()})}}) {
        auto fn = func::FuncOp::create(builder_, builder_.getUnknownLoc(), name, signature);
        fn.setPrivate();
      }
    }
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
    if (main == input_.functions.end() || !main->parameters.empty() ||
        (main->resultType.builtin != BuiltinValue::Numeric &&
         main->resultType.builtin != BuiltinValue::Bool &&
         main->resultType.builtin != BuiltinValue::String) ||
        (main->resultType.tensor && main->resultType.shape.size() > cli::maximumCollectionRank))
      throw LoweringFailure{
          "native entry requires fn main() -> float32, int32, uint32, int64, "
          "uint64, float64, Bool, String or a CPU numeric array/tensor with no parameters"};
    builder_.setInsertionPointToEnd(module_->getBody());
    const auto entryName =
        main->resultType.tensor                            ? "kalandra_collection_entry"
        : main->resultType.builtin == BuiltinValue::String ? "kalandra_string_entry"
        : main->resultType.builtin == BuiltinValue::Bool   ? "kalandra_bool_entry"
        : main->resultType.element == NumericType::Float64 ? "kalandra_float64_entry"
        : main->resultType.element == NumericType::UInt64  ? "kalandra_uint64_entry"
        : main->resultType.element == NumericType::Int64   ? "kalandra_int64_entry"
        : main->resultType.element == NumericType::UInt32  ? "kalandra_uint32_entry"
        : main->resultType.element == NumericType::Int32   ? "kalandra_int32_entry"
                                                           : "kalandra_entry";
    auto entry = func::FuncOp::create(
        builder_, location(main->declaration), entryName,
        builder_.getFunctionType({}, {type(main->declaredResult.value_or(main->resultType))}));
    entry->setAttr("llvm.emit_c_interface", builder_.getUnitAttr());
    builder_.setInsertionPointToStart(entry.addEntryBlock());
    const auto mainId = static_cast<FunctionId>(main - input_.functions.begin());
    auto call = func::CallOp::create(builder_, entry.getLoc(), functions_[mainId], ValueRange{});
    if ((hasRecordCollections(input_) || hasOrdinaryStrings(input_)) && !main->resultType.tensor &&
        main->resultType.builtin != BuiltinValue::String)
      func::CallOp::create(builder_, entry.getLoc(), "kalandra_record_cleanup", TypeRange{},
                           ValueRange{});
    func::ReturnOp::create(builder_, entry.getLoc(), call.getResults());
    if (testEntry)
      interfaceWrapper(*testEntry);
    return std::move(module_);
  }

private:
  Location location(SourceSpan span) const {
    auto [line, column] = input_.source->location(span.begin);
    return FileLineColLoc::get(builder_.getContext(),
                               input_.source->origin(span.begin).first->path(), line, column);
  }
  Type type(const ValueType &value) {
    if (isOwnedArray(value))
      return recordDescriptor(value);
    if (value.builtin == BuiltinValue::Record) {
      if (auto found = recordTypes_.find(*value.record); found != recordTypes_.end())
        return found->second;
      SmallVector<Type> fields;
      for (const auto &field : input_.records.at(*value.record).fields)
        fields.push_back(field.type.tensor ? recordDescriptor(field.type) : type(field.type));
      return recordTypes_[*value.record] =
                 LLVM::LLVMStructType::getLiteral(builder_.getContext(), fields);
    }
    if (value.builtin == BuiltinValue::Bool)
      return builder_.getI1Type();
    if (value.builtin == BuiltinValue::String) {
      const auto ptr = LLVM::LLVMPointerType::get(builder_.getContext());
      return LLVM::LLVMStructType::getLiteral(builder_.getContext(),
                                              {ptr, ptr, builder_.getI64Type()});
    }
    const Type element =
        (value.element == NumericType::Int64 || value.element == NumericType::UInt64)
            ? Type(builder_.getI64Type())
        : isInteger32(value.element)            ? Type(builder_.getI32Type())
        : value.element == NumericType::Float64 ? Type(builder_.getF64Type())
                                                : Type(builder_.getF32Type());
    if (!value.tensor)
      return element;
    SmallVector<std::int64_t> shape;
    for (const auto &extent : value.shape)
      shape.push_back(extent.constant ? static_cast<std::int64_t>(*extent.constant)
                                      : ShapedType::kDynamic);
    return RankedTensorType::get(shape, element);
  }
  Type recordDescriptor(const ValueType &value) {
    auto ptr = LLVM::LLVMPointerType::get(builder_.getContext());
    auto dims = LLVM::LLVMArrayType::get(builder_.getI64Type(), value.shape.size());
    return LLVM::LLVMStructType::getLiteral(builder_.getContext(),
                                            {ptr, ptr, builder_.getI64Type(), dims, dims});
  }
  SmallVector<Value> recordIndices(Location loc, Value flat, ArrayRef<Value> shape) {
    SmallVector<Value> indices(shape.size());
    for (std::size_t axis = shape.size(); axis > 0; --axis) {
      auto safe = arith::SelectOp::create(
          builder_, loc, compare(loc, arith::CmpIPredicate::eq, shape[axis - 1], index(loc, 0)),
          index(loc, 1), shape[axis - 1]);
      indices[axis - 1] = arith::RemUIOp::create(builder_, loc, flat, safe);
      flat = arith::DivUIOp::create(builder_, loc, flat, safe);
    }
    return indices;
  }
  Value recordPack(Location loc, Value input, const ValueType &field) {
    auto shape = dimensions(loc, input);
    auto element = cast<RankedTensorType>(input.getType()).getElementType();
    auto count = checkedCount(loc, shape, describeNumeric(field.element)->bytes());
    auto bytes = arith::MulIOp::create(builder_, loc, count,
                                       index(loc, describeNumeric(field.element)->bytes()));
    auto bytes64 = arith::IndexCastOp::create(builder_, loc, builder_.getI64Type(), bytes);
    auto ptr = LLVM::LLVMPointerType::get(builder_.getContext());
    Value storage = func::CallOp::create(builder_, loc, "kalandra_record_alloc", TypeRange{ptr},
                                         ValueRange{bytes64})
                        .getResult(0);
    scf::ForOp::create(
        builder_, loc, index(loc, 0), count, index(loc, 1), ValueRange{},
        [&](OpBuilder &, Location, Value i, ValueRange) {
          auto cell = tensor::ExtractOp::create(builder_, loc, input, recordIndices(loc, i, shape));
          auto offset = arith::IndexCastOp::create(builder_, loc, builder_.getI64Type(), i);
          auto address =
              LLVM::GEPOp::create(builder_, loc, ptr, element, storage, ValueRange{offset});
          LLVM::StoreOp::create(builder_, loc, cell, address);
          scf::YieldOp::create(builder_, loc);
        });
    Value result = LLVM::UndefOp::create(builder_, loc, recordDescriptor(field));
    const auto insert = [&](Value value, ArrayRef<int64_t> path) {
      result = LLVM::InsertValueOp::create(builder_, loc, result, value, path);
    };
    insert(storage, {0});
    insert(storage, {1});
    insert(integer(loc, 0), {2});
    Value stride = index(loc, 1);
    auto empty = compare(loc, arith::CmpIPredicate::eq, count, index(loc, 0));
    for (std::size_t axis = shape.size(); axis > 0; --axis) {
      auto canonical = arith::SelectOp::create(builder_, loc, empty, index(loc, 0), stride);
      insert(arith::IndexCastOp::create(builder_, loc, builder_.getI64Type(), shape[axis - 1]),
             {3, static_cast<int64_t>(axis - 1)});
      insert(arith::IndexCastOp::create(builder_, loc, builder_.getI64Type(), canonical),
             {4, static_cast<int64_t>(axis - 1)});
      // Zero-count shapes need no representable suffix product.
      stride = arith::MulIOp::create(builder_, loc, canonical, shape[axis - 1]);
    }
    return result;
  }
  Value descriptorSlot(Location loc, Type type) {
    OpBuilder::InsertionGuard guard(builder_);
    auto *parent = builder_.getInsertionBlock()->getParentOp();
    while (!isa<func::FuncOp>(parent))
      parent = parent->getParentOp();
    builder_.setInsertionPointToStart(&cast<func::FuncOp>(parent).getBody().front());
    return LLVM::AllocaOp::create(builder_, loc, LLVM::LLVMPointerType::get(builder_.getContext()),
                                  type, integer(loc, 1));
  }
  Value stringSlot(Location loc, Value value) {
    auto slot = descriptorSlot(loc, value.getType());
    LLVM::StoreOp::create(builder_, loc, value, slot);
    return slot;
  }
  void validateString(Location loc, Value value) {
    auto slot = stringSlot(loc, value);
    func::CallOp::create(builder_, loc, "kalandra_string_validate", TypeRange{}, ValueRange{slot});
  }
  Type arrayCellType(const ValueType &array) {
    return isBoolArray(array) ? builder_.getI8Type() : type(recordArrayElement(array));
  }
  Value arrayCellRead(Location loc, Value address, const ValueType &array) {
    Value cell = LLVM::LoadOp::create(builder_, loc, arrayCellType(array), address);
    if (isBoolArray(array)) {
      auto one = arith::ConstantIntOp::create(builder_, loc, 1, 8);
      guard(loc, compare(loc, arith::CmpIPredicate::ule, cell, one), 3);
      cell = arith::TruncIOp::create(builder_, loc, builder_.getI1Type(), cell);
    }
    return cell;
  }
  void arrayCellStore(Location loc, Value cell, Value address, const ValueType &array) {
    if (isBoolArray(array))
      cell = arith::ExtUIOp::create(builder_, loc, builder_.getI8Type(), cell);
    LLVM::StoreOp::create(builder_, loc, cell, address);
  }
  std::pair<std::uint64_t, std::uint64_t> recordCellLayout(const ValueType &array) {
    if (isBoolArray(array))
      return {1, 1};
    if (auto found = recordLayouts_.find(*array.record); found != recordLayouts_.end())
      return found->second;
    llvm::LLVMContext context;
    LLVM::TypeToLLVMIRTranslator translator(context);
    llvm::DataLayout layout(nativeCpuDataLayout);
    auto *cell = translator.translateType(type(recordArrayElement(array)));
    return recordLayouts_[*array.record] = {layout.getTypeAllocSize(cell).getFixedValue(),
                                            layout.getABITypeAlign(cell).value()};
  }
  Value recordArrayLength(Location loc, Value input, const ValueType &array) {
    const auto [cellBytes, alignment] = recordCellLayout(array);
    auto address = descriptorSlot(loc, input.getType());
    LLVM::StoreOp::create(builder_, loc, input, address);
    func::CallOp::create(builder_, loc, "kalandra_record_array_validate", TypeRange{},
                         ValueRange{address, integer(loc, cellBytes), integer(loc, alignment)});
    return LLVM::ExtractValueOp::create(builder_, loc, input, ArrayRef<int64_t>{3, 0});
  }
  Value recordArrayStorage(Location loc, const ValueType &array, Value count) {
    const auto cellBytes = recordCellLayout(array).first;
    auto checked = checkedCount(loc, {count}, cellBytes);
    auto bytes = arith::MulIOp::create(builder_, loc, checked, index(loc, cellBytes));
    auto bytes64 = arith::IndexCastOp::create(builder_, loc, builder_.getI64Type(), bytes);
    auto ptr = LLVM::LLVMPointerType::get(builder_.getContext());
    Value storage = func::CallOp::create(builder_, loc, "kalandra_record_alloc", TypeRange{ptr},
                                         ValueRange{bytes64})
                        .getResult(0);
    Value result = LLVM::UndefOp::create(builder_, loc, recordDescriptor(array));
    const auto insert = [&](Value value, ArrayRef<int64_t> path) {
      result = LLVM::InsertValueOp::create(builder_, loc, result, value, path);
    };
    insert(storage, {0});
    insert(storage, {1});
    insert(integer(loc, 0), {2});
    insert(arith::IndexCastOp::create(builder_, loc, builder_.getI64Type(), count), {3, 0});
    auto empty = compare(loc, arith::CmpIPredicate::eq, count, index(loc, 0));
    insert(arith::SelectOp::create(builder_, loc, empty, integer(loc, 0), integer(loc, 1)), {4, 0});
    return result;
  }
  Value recordArrayLiteral(Location loc, const ValueType &array, ArrayRef<Value> elements) {
    auto result = recordArrayStorage(loc, array, index(loc, elements.size()));
    auto storage = LLVM::ExtractValueOp::create(builder_, loc, result, ArrayRef<int64_t>{1});
    auto ptr = LLVM::LLVMPointerType::get(builder_.getContext());
    auto cell = arrayCellType(array);
    for (std::size_t i = 0; i < elements.size(); ++i) {
      auto address =
          LLVM::GEPOp::create(builder_, loc, ptr, cell, storage, ValueRange{integer(loc, i)});
      arrayCellStore(loc, elements[i], address, array);
    }
    return result;
  }
  Value recordUnpack(Location loc, Value input, const ValueType &field) {
    auto ptr = LLVM::LLVMPointerType::get(builder_.getContext());
    Value address;
    {
      // A read inside a map/loop reuses a fixed entry-block descriptor slot.
      // Repeated dynamic stack allocations would grow until the helper returns.
      OpBuilder::InsertionGuard guard(builder_);
      auto *parent = builder_.getInsertionBlock()->getParentOp();
      while (!isa<func::FuncOp>(parent))
        parent = parent->getParentOp();
      builder_.setInsertionPointToStart(&cast<func::FuncOp>(parent).getBody().front());
      address =
          LLVM::AllocaOp::create(builder_, loc, ptr, recordDescriptor(field), integer(loc, 1));
    }
    LLVM::StoreOp::create(builder_, loc, input, address);
    func::CallOp::create(builder_, loc, "kalandra_record_validate", TypeRange{},
                         ValueRange{address, integer(loc, field.shape.size()),
                                    integer(loc, static_cast<unsigned>(field.element))});
    SmallVector<Value> shape, dynamic;
    auto output = cast<RankedTensorType>(type(field));
    for (std::size_t axis = 0; axis < field.shape.size(); ++axis) {
      auto d = LLVM::ExtractValueOp::create(builder_, loc, input,
                                            ArrayRef<int64_t>{3, static_cast<int64_t>(axis)});
      Value extent = arith::IndexCastOp::create(builder_, loc, builder_.getIndexType(), d);
      shape.push_back(extent);
      if (output.isDynamicDim(axis))
        dynamic.push_back(extent);
      else
        guard(loc,
              compare(loc, arith::CmpIPredicate::eq, extent, index(loc, output.getDimSize(axis))),
              1);
    }
    auto count = checkedCount(loc, shape, describeNumeric(field.element)->bytes());
    auto empty =
        tensor::EmptyOp::create(builder_, loc, output.getShape(), output.getElementType(), dynamic);
    auto storage = LLVM::ExtractValueOp::create(builder_, loc, input, ArrayRef<int64_t>{1});
    auto loop = scf::ForOp::create(
        builder_, loc, index(loc, 0), count, index(loc, 1), ValueRange{empty},
        [&](OpBuilder &, Location, Value i, ValueRange args) {
          auto offset = arith::IndexCastOp::create(builder_, loc, builder_.getI64Type(), i);
          auto address = LLVM::GEPOp::create(builder_, loc, ptr, output.getElementType(), storage,
                                             ValueRange{offset});
          auto cell = LLVM::LoadOp::create(builder_, loc, output.getElementType(), address);
          auto inserted =
              tensor::InsertOp::create(builder_, loc, cell, args[0], recordIndices(loc, i, shape));
          scf::YieldOp::create(builder_, loc, ValueRange{inserted});
        });
    return loop.getResult(0);
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
  Value checkedSigned(Location loc, Value wide, unsigned bits) {
    auto constant = [&](std::int64_t value) -> Value {
      return arith::ConstantOp::create(builder_, loc, wide.getType(),
          builder_.getIntegerAttr(wide.getType(), llvm::APInt(bits * 2, static_cast<std::uint64_t>(value), true)));
    };
    auto low = compare(loc, arith::CmpIPredicate::sge, wide, constant(bits == 64 ? INT64_MIN : INT32_MIN));
    auto high = compare(loc, arith::CmpIPredicate::sle, wide, constant(bits == 64 ? INT64_MAX : INT32_MAX));
    guard(loc, arith::AndIOp::create(builder_, loc, low, high), 4);
    return arith::TruncIOp::create(builder_, loc, builder_.getIntegerType(bits), wide);
  }
  Value scalarComparison(Location loc, Value a, Value b, const ValueType &source,
                         ComparisonKind op) {
    using P = arith::CmpIPredicate;
    if (source.builtin == BuiltinValue::Bool || isInteger(source.element)) {
      const bool u = source.builtin == BuiltinValue::Bool || isUnsigned(source.element);
      const auto predicate = op == ComparisonKind::Equal       ? P::eq
                             : op == ComparisonKind::NotEqual  ? P::ne
                             : op == ComparisonKind::Less      ? (u ? P::ult : P::slt)
                             : op == ComparisonKind::LessEqual ? (u ? P::ule : P::sle)
                             : op == ComparisonKind::Greater   ? (u ? P::ugt : P::sgt)
                                                               : (u ? P::uge : P::sge);
      return compare(loc, predicate, a, b);
    }
    const unsigned width = describeNumeric(source.element)->bits;
    const auto integerType = builder_.getIntegerType(width);
    a = arith::BitcastOp::create(builder_, loc, integerType, a);
    b = arith::BitcastOp::create(builder_, loc, integerType, b);
    const auto constant = [&](std::uint64_t bits) -> Value {
      return arith::ConstantIntOp::create(builder_, loc, static_cast<std::int64_t>(bits), width);
    };
    const auto both = [&](Value x, Value y) -> Value {
      return arith::AndIOp::create(builder_, loc, x, y);
    };
    const auto either = [&](Value x, Value y) -> Value {
      return arith::OrIOp::create(builder_, loc, x, y);
    };
    const auto negate = [&](Value x) -> Value {
      return arith::XOrIOp::create(builder_, loc, x,
                                   arith::ConstantIntOp::create(builder_, loc, 1, 1));
    };
    auto magnitude = constant(width == 32 ? UINT64_C(0x7fffffff) : UINT64_C(0x7fffffffffffffff));
    auto infinity = constant(width == 32 ? UINT64_C(0x7f800000) : UINT64_C(0x7ff0000000000000));
    auto zero = constant(0), sign = constant(UINT64_C(1) << (width - 1));
    Value ma = arith::AndIOp::create(builder_, loc, a, magnitude),
          mb = arith::AndIOp::create(builder_, loc, b, magnitude);
    auto ordered = both(compare(loc, P::ule, ma, infinity), compare(loc, P::ule, mb, infinity));
    auto equal = either(compare(loc, P::eq, a, b),
                        both(compare(loc, P::eq, ma, zero), compare(loc, P::eq, mb, zero)));
    Value sa = arith::AndIOp::create(builder_, loc, a, sign),
          sb = arith::AndIOp::create(builder_, loc, b, sign);
    auto negative = compare(loc, P::ne, sa, zero);
    Value sameSignLess = arith::SelectOp::create(
        builder_, loc, negative, compare(loc, P::ugt, a, b), compare(loc, P::ult, a, b));
    Value less =
        arith::SelectOp::create(builder_, loc, compare(loc, P::ne, sa, sb), negative, sameSignLess);
    less = both(negate(equal), less);
    if (op == ComparisonKind::NotEqual)
      return negate(both(ordered, equal));
    Value result = op == ComparisonKind::Equal       ? equal
                   : op == ComparisonKind::Less      ? less
                   : op == ComparisonKind::LessEqual ? either(less, equal)
                   : op == ComparisonKind::Greater   ? negate(either(less, equal))
                                                     : negate(less);
    return both(ordered, result);
  }
  Value integerUnary(Location loc, Value operand, TokenKind op, bool unsignedValue = false) {
    if (op == TokenKind::Plus)
      return operand;
    if (unsignedValue) {
      guard(loc, compare(loc, arith::CmpIPredicate::eq, operand,
                         arith::ConstantIntOp::create(builder_, loc, 0, cast<IntegerType>(operand.getType()).getWidth())), 4);
      return operand;
    }
    const auto bits = cast<IntegerType>(operand.getType()).getWidth();
    auto wide = arith::ExtSIOp::create(builder_, loc, builder_.getIntegerType(bits * 2), operand);
    auto z = arith::ConstantIntOp::create(builder_, loc, 0, bits * 2);
    return checkedSigned(loc, arith::SubIOp::create(builder_, loc, z, wide), bits);
  }
  Value integerBinary(Location loc, Value a, Value b, TokenKind op, bool unsignedValue = false) {
    if (unsignedValue) {
      const auto bits = cast<IntegerType>(a.getType()).getWidth();
      if (bits == 64 && (op == TokenKind::Slash || op == TokenKind::Percent)) {
        guard(loc, compare(loc, arith::CmpIPredicate::ne, b, integer(loc, 0)), 4);
        return binary(loc, op == TokenKind::Slash ? "arith.divui" : "arith.remui", a, b);
      }
      auto wideType = builder_.getIntegerType(bits * 2);
      a = arith::ExtUIOp::create(builder_, loc, wideType, a);
      b = arith::ExtUIOp::create(builder_, loc, wideType, b);
      auto z = arith::ConstantIntOp::create(builder_, loc, 0, bits * 2);
      if (op == TokenKind::Slash || op == TokenKind::Percent)
        guard(loc, compare(loc, arith::CmpIPredicate::ne, b, z), 4);
      if (op == TokenKind::Minus)
        guard(loc, compare(loc, arith::CmpIPredicate::uge, a, b), 4);
      const char *name = op == TokenKind::Plus ? "arith.addi"
                         : op == TokenKind::Minus ? "arith.subi"
                         : op == TokenKind::Star ? "arith.muli"
                         : op == TokenKind::Percent ? "arith.remui" : "arith.divui";
      auto wide = binary(loc, name, a, b);
      auto maximum = arith::ConstantOp::create(builder_, loc, wideType,
          builder_.getIntegerAttr(wideType, llvm::APInt(bits * 2, bits == 64 ? UINT64_MAX : UINT32_MAX)));
      guard(loc, compare(loc, arith::CmpIPredicate::ule, wide, maximum), 4);
      return arith::TruncIOp::create(builder_, loc, builder_.getIntegerType(bits), wide);
    }
    const auto bits = cast<IntegerType>(a.getType()).getWidth();
    if (bits == 64 && (op == TokenKind::Slash || op == TokenKind::Percent)) {
      guard(loc, compare(loc, arith::CmpIPredicate::ne, b, integer(loc, 0)), 4);
      auto exceptional = arith::AndIOp::create(builder_, loc,
          compare(loc, arith::CmpIPredicate::eq, a, integer(loc, INT64_MIN)),
          compare(loc, arith::CmpIPredicate::eq, b, integer(loc, -1)));
      if (op == TokenKind::Slash) {
        guard(loc, compare(loc, arith::CmpIPredicate::eq, exceptional,
                           arith::ConstantIntOp::create(builder_, loc, 0, 1)), 4);
        return arith::DivSIOp::create(builder_, loc, a, b);
      }
      // LLVM srem(INT64_MIN,-1) is poison even though the mathematical remainder is zero.
      auto safe = arith::SelectOp::create(builder_, loc, exceptional, integer(loc, 1), b);
      return arith::RemSIOp::create(builder_, loc, a, safe);
    }
    auto wideType = builder_.getIntegerType(bits * 2);
    a = arith::ExtSIOp::create(builder_, loc, wideType, a);
    b = arith::ExtSIOp::create(builder_, loc, wideType, b);
    if (op == TokenKind::Slash || op == TokenKind::Percent)
      guard(loc, compare(loc, arith::CmpIPredicate::ne, b,
                         arith::ConstantIntOp::create(builder_, loc, 0, bits * 2)), 4);
    const char *name = op == TokenKind::Plus ? "arith.addi"
                       : op == TokenKind::Minus ? "arith.subi"
                       : op == TokenKind::Star ? "arith.muli"
                       : op == TokenKind::Percent ? "arith.remsi" : "arith.divsi";
    return checkedSigned(loc, binary(loc, name, a, b), bits);
  }
  SmallVector<Value> dimensions(Location loc, Value tensor) {
    SmallVector<Value> result;
    const auto rank = cast<RankedTensorType>(tensor.getType()).getRank();
    for (std::int64_t axis = 0; axis < rank; ++axis)
      result.push_back(tensor::DimOp::create(builder_, loc, tensor, index(loc, axis)));
    return result;
  }
  Value checkedCount(Location loc, ArrayRef<Value> dimensions, std::uint64_t elementBytes = 4) {
    auto z = index(loc, 0), one = index(loc, 1);
    Value hasZero = arith::ConstantIntOp::create(builder_, loc, 0, 1);
    for (auto d : dimensions) {
      guard(loc, compare(loc, arith::CmpIPredicate::sge, d, z), 1);
      hasZero = arith::OrIOp::create(builder_, loc, hasZero,
                                     compare(loc, arith::CmpIPredicate::eq, d, z));
    }
    Value count = arith::SelectOp::create(builder_, loc, hasZero, z, one);
    auto maximum = index(loc, std::numeric_limits<std::int64_t>::max() / elementBytes);
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
  Value reductionScratch(Location loc, Value count, Type element = {}) {
    checkedCount(loc, {count}, element ? element.getIntOrFloatBitWidth() / 8 : 4);
    auto scratchType = MemRefType::get({ShapedType::kDynamic}, element ? element : builder_.getF32Type());
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
                         Value base = {}, bool unsignedValue = false) {
    const auto z = index(loc, 0), one = index(loc, 1), two = index(loc, 2);
    const auto elementType = cast<MemRefType>(scratch.getType()).getElementType();
    const auto vectorType = VectorType::get({width}, elementType);
    const Type resultType = width == 1 ? elementType : Type(vectorType);
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
                               Value sum = isa<IntegerType>(elementType)
                                               ? integerBinary(loc, a, b, TokenKind::Plus, unsignedValue)
                                               : Value(arith::AddFOp::create(builder_, loc, a, b));
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
      Value empty = isa<IntegerType>(elementType)
                        ? Value(arith::ConstantIntOp::create(
                              builder_, loc, 0, cast<IntegerType>(elementType).getWidth()))
                    : elementType.isF64()
                        ? Value(arith::ConstantFloatOp::create(builder_, loc, builder_.getF64Type(),
                                                               llvm::APFloat(0.0)))
                        : zero(loc);
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
  Value reduction(Location loc, Value count, Value scratch, Callback element, unsigned width = 1, bool unsignedValue = false) {
    const auto z = index(loc, 0), one = index(loc, 1);
    scf::ForOp::create(builder_, loc, z, count, one, ValueRange{},
                       [&](OpBuilder &, Location, Value i, ValueRange) {
                         scratchStore(loc, element(i), scratch, i, width);
                         scf::YieldOp::create(builder_, loc);
                       });
    return scratchReduction(loc, count, scratch, width, {}, unsignedValue);
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
  Value scalarMatmul(Location loc, Value a, Value b, RankedTensorType output,
                     const Matmul &operation, bool unsignedValue) {
    if (operation.order != ReductionOrder::BalancedAdjacent || !operation.separatelyRoundedProducts)
      throw LoweringFailure{"unsupported matmul numerical policy"};
    auto left = dimensions(loc, a), right = dimensions(loc, b);
    const auto z = index(loc, 0), one = index(loc, 1);
    for (auto extent : {left[0], left[1], right[0], right[1]})
      guard(loc, compare(loc, arith::CmpIPredicate::sge, extent, z), 1);
    if (operation.checkInnerExtent)
      guard(loc, compare(loc, arith::CmpIPredicate::eq, left[1], right[0]), 1);
    const auto cellType = output.getElementType();
    auto cells = checkedCount(loc, {left[0], right[1]}, cellType.getIntOrFloatBitWidth() / 8);
    auto noCells = compare(loc, arith::CmpIPredicate::eq, cells, z);
    auto rows = arith::SelectOp::create(builder_, loc, noCells, z, left[0]);
    // No output cells means no contraction work and no contraction-sized scratch.
    auto scratchCount = arith::SelectOp::create(builder_, loc, noCells, z, left[1]);
    auto scratch = reductionScratch(loc, scratchCount, cellType);
    SmallVector<Value> dynamic;
    if (output.isDynamicDim(0))
      dynamic.push_back(left[0]);
    if (output.isDynamicDim(1))
      dynamic.push_back(right[1]);
    auto empty = tensor::EmptyOp::create(builder_, loc, output.getShape(), cellType, dynamic);
    auto result = scf::ForOp::create(
        builder_, loc, z, rows, one, ValueRange{empty},
        [&](OpBuilder &, Location, Value row, ValueRange rowValues) {
          auto columns = scf::ForOp::create(
              builder_, loc, z, right[1], one, rowValues,
              [&](OpBuilder &, Location, Value column, ValueRange columnValues) {
                auto sum = reduction(loc, left[1], scratch, [&](Value k) -> Value {
                  auto x = tensor::ExtractOp::create(builder_, loc, a, ValueRange{row, k});
                  auto y = tensor::ExtractOp::create(builder_, loc, b, ValueRange{k, column});
                  return isa<IntegerType>(cellType)
                             ? integerBinary(loc, x, y, TokenKind::Star, unsignedValue)
                             : binary(loc, "arith.mulf", x, y);
                }, 1, unsignedValue);
                auto cell = tensor::InsertOp::create(builder_, loc, sum, columnValues[0], ValueRange{row, column});
                scf::YieldOp::create(builder_, loc, ValueRange{cell});
              });
          scf::YieldOp::create(builder_, loc, columns.getResults());
        });
    return result.getResult(0);
  }
  Value matmul(Location loc, Value a, Value b, RankedTensorType output, const Matmul &operation, NumericType element) {
    if (isInteger(element) || element == NumericType::Float64)
      return scalarMatmul(loc, a, b, output, operation, isUnsigned(element));
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
  Value reduce(Location loc, Value tensor, const ReduceSum &operation, NumericType element) {
    if (operation.order != ReductionOrder::BalancedAdjacent || !operation.rowMajor)
      throw LoweringFailure{"unsupported reduction numerical policy"};
    auto shape = dimensions(loc, tensor);
    auto count = checkedCount(loc, shape, describeNumeric(element)->bytes());
    auto scratch = reductionScratch(loc, count, cast<RankedTensorType>(tensor.getType()).getElementType());
    return reduction(loc, count, scratch, [&](Value linear) -> Value {
      SmallVector<Value> indices(shape.size());
      for (std::size_t axis = shape.size(); axis > 0; --axis) {
        indices[axis - 1] = arith::RemUIOp::create(builder_, loc, linear, shape[axis - 1]);
        linear = arith::DivUIOp::create(builder_, loc, linear, shape[axis - 1]);
      }
      return tensor::ExtractOp::create(builder_, loc, tensor, indices);
    }, 1, isUnsigned(element));
  }
  Value convertTensor(Location loc, Value input, RankedTensorType output, NumericType source,
                      NumericType destination) {
    auto shape = dimensions(loc, input);
    checkedCount(loc, shape, describeNumeric(source)->bytes());
    checkedCount(loc, shape, describeNumeric(destination)->bytes());
    SmallVector<Value> dynamic;
    for (std::size_t axis = 0; axis < shape.size(); ++axis)
      if (output.isDynamicDim(axis))
        dynamic.push_back(shape[axis]);
    Value empty =
        tensor::EmptyOp::create(builder_, loc, output.getShape(), output.getElementType(), dynamic);
    SmallVector<Value> indices;
    auto zero = index(loc, 0), one = index(loc, 1);
    std::function<Value(std::size_t, Value)> loop = [&](std::size_t axis, Value tensor) -> Value {
      if (axis == shape.size()) {
        Value lane = tensor::ExtractOp::create(builder_, loc, input, indices);
        auto [converted, valid] = numericConversion(builder_, loc, lane, source, destination);
        guard(loc, valid, 4);
        return tensor::InsertOp::create(builder_, loc, converted, tensor, indices);
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
  Value elementwise(Location loc, Value a, Value b, RankedTensorType output, TokenKind op, NumericType element) {
    const bool tensorA = isa<RankedTensorType>(a.getType());
    const bool tensorB = b && isa<RankedTensorType>(b.getType());
    auto shape = dimensions(loc, tensorA ? a : b);
    if (tensorA && tensorB) {
      auto other = dimensions(loc, b);
      for (std::size_t axis = 0; axis < shape.size(); ++axis)
        guard(loc, compare(loc, arith::CmpIPredicate::eq, shape[axis], other[axis]), 1);
    }
    checkedCount(loc, shape, describeNumeric(element)->bytes());
    SmallVector<Value> dynamic;
    for (std::size_t axis = 0; axis < shape.size(); ++axis)
      if (output.isDynamicDim(axis))
        dynamic.push_back(shape[axis]);
    Value empty =
        tensor::EmptyOp::create(builder_, loc, output.getShape(), output.getElementType(), dynamic);
    SmallVector<Value> indices;
    const auto zero = index(loc, 0), one = index(loc, 1);
    std::function<Value(std::size_t, Value)> loop = [&](std::size_t axis, Value tensor) -> Value {
      if (axis == shape.size()) {
        Value left = tensorA ? tensor::ExtractOp::create(builder_, loc, a, indices).getResult() : a;
        Value result;
        if (!b) {
          result = isInteger(element)
                       ? integerUnary(loc, left, op, isUnsigned(element))
                       : arith::NegFOp::create(builder_, loc, left).getResult();
        } else {
          Value right =
              tensorB ? tensor::ExtractOp::create(builder_, loc, b, indices).getResult() : b;
          const char *arithmetic = op == TokenKind::Plus    ? "arith.addf"
                                   : op == TokenKind::Minus ? "arith.subf"
                                   : op == TokenKind::Slash ? "arith.divf"
                                                            : "arith.mulf";
          result = isInteger(element)
                       ? integerBinary(loc, left, right, op, isUnsigned(element))
                       : binary(loc, arithmetic, left, right);
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
          if constexpr (std::is_same_v<T, Float64Literal>) {
            llvm::APFloat number(llvm::APFloat::IEEEdouble(), llvm::APInt(64, operation.bits));
            return arith::ConstantFloatOp::create(builder_, loc, builder_.getF64Type(), number);
          } else if constexpr (std::is_same_v<T, Float32Literal>) {
            llvm::APFloat number(llvm::APFloat::IEEEsingle(), llvm::APInt(32, operation.bits));
            return arith::ConstantFloatOp::create(builder_, loc, builder_.getF32Type(), number);
          } else if constexpr (std::is_same_v<T, UInt64Literal>) {
            return arith::ConstantOp::create(builder_, loc, builder_.getI64Type(),
                builder_.getIntegerAttr(builder_.getI64Type(), llvm::APInt(64, operation.value)));
          } else if constexpr (std::is_same_v<T, Int32Literal> ||
                               std::is_same_v<T, UInt32Literal> ||
                               std::is_same_v<T, Int64Literal>) {
            return arith::ConstantIntOp::create(builder_, loc, operation.value, node.type.element == NumericType::Int64 ? 64 : 32);
          } else if constexpr (std::is_same_v<T, SymbolRead>)
            return frame.symbols.at(operation.symbol);
          else if constexpr (std::is_same_v<T, ScalarUnary>) {
            auto operand = expression(frame, operation.operand);
            if (isInteger(node.type.element))
              return integerUnary(loc, operand, operation.operation, isUnsigned(node.type.element));
            return operation.operation == TokenKind::Minus
                       ? arith::NegFOp::create(builder_, loc, operand).getResult()
                       : operand;
          } else if constexpr (std::is_same_v<T, StringQuery>) {
            auto value = expression(frame, operation.input);
            auto slot = stringSlot(loc, value);
            return func::CallOp::create(builder_, loc,
                                        operation.kind == StringQueryKind::Length
                                            ? "kalandra_string_length"
                                            : "kalandra_string_byte_length",
                                        TypeRange{builder_.getI64Type()}, ValueRange{slot})
                .getResult(0);
          } else if constexpr (std::is_same_v<T, StringConcat>) {
            auto a = expression(frame, operation.left), b = expression(frame, operation.right);
            auto left = stringSlot(loc, a), right = stringSlot(loc, b);
            auto output = descriptorSlot(loc, type(node.type));
            func::CallOp::create(builder_, loc, "kalandra_string_concat", TypeRange{},
                                 ValueRange{output, left, right});
            return LLVM::LoadOp::create(builder_, loc, type(node.type), output);
          } else if constexpr (std::is_same_v<T, StringLiteral>) {
            LLVM::GlobalOp global;
            {
              OpBuilder::InsertionGuard guard(builder_);
              builder_.setInsertionPointToStart(module_->getBody());
              const auto bytes = operation.value.empty() ? std::string(1, '\0') : operation.value;
              auto storage = LLVM::LLVMArrayType::get(builder_.getI8Type(), bytes.size());
              global =
                  LLVM::GlobalOp::create(builder_, loc, storage, true, LLVM::Linkage::Internal,
                                         "kalandra_string_" + std::to_string(nextStringLiteral_++),
                                         builder_.getStringAttr(bytes));
            }
            auto address = LLVM::AddressOfOp::create(builder_, loc, global);
            auto slot = descriptorSlot(loc, type(node.type));
            func::CallOp::create(builder_, loc, "kalandra_string_literal", TypeRange{},
                                 ValueRange{slot, address, integer(loc, operation.value.size())});
            return LLVM::LoadOp::create(builder_, loc, type(node.type), slot);
          } else if constexpr (std::is_same_v<T, BoolLiteral>) {
            return arith::ConstantIntOp::create(builder_, loc, operation.value, 1);
          } else if constexpr (std::is_same_v<T, RecordValue>) {
            Value value = operation.base
                              ? expression(frame, *operation.base)
                              : Value(LLVM::UndefOp::create(builder_, loc, type(node.type)));
            for (const auto &field : operation.fields) {
              auto member = expression(frame, field.value);
              const auto &fieldType = input_.records[*node.type.record].fields[field.field].type;
              if (fieldType.tensor && !isBoolArray(fieldType))
                member = recordPack(loc, member, fieldType);
              value =
                  LLVM::InsertValueOp::create(builder_, loc, value, member,
                                              ArrayRef<int64_t>{static_cast<int64_t>(field.field)});
            }
            return value;
          } else if constexpr (std::is_same_v<T, RecordFieldRead>) {
            Value member = LLVM::ExtractValueOp::create(
                builder_, loc, expression(frame, operation.input),
                ArrayRef<int64_t>{static_cast<int64_t>(operation.field)});
            if (isBoolArray(node.type)) {
              recordArrayLength(loc, member, node.type);
              return member;
            }
            return node.type.tensor ? recordUnpack(loc, member, node.type) : member;
          } else if constexpr (std::is_same_v<T, ScalarCompare>) {
            auto left = expression(frame, operation.left),
                 right = expression(frame, operation.right);
            if (input_.expressions[operation.left].type.builtin == BuiltinValue::String) {
              auto a = stringSlot(loc, left), b = stringSlot(loc, right);
              auto equal = func::CallOp::create(builder_, loc, "kalandra_string_equal",
                                                TypeRange{builder_.getI64Type()}, ValueRange{a, b})
                               .getResult(0);
              return compare(loc,
                             operation.operation == ComparisonKind::Equal
                                 ? arith::CmpIPredicate::ne
                                 : arith::CmpIPredicate::eq,
                             equal, integer(loc, 0));
            }
            return scalarComparison(loc, left, right, input_.expressions[operation.left].type,
                                    operation.operation);
          } else if constexpr (std::is_same_v<T, ScalarBinary>) {
            auto a = expression(frame, operation.left), b = expression(frame, operation.right);
            if (isInteger(node.type.element))
              return integerBinary(loc, a, b, operation.operation, isUnsigned(node.type.element));
            const char *name = operation.operation == TokenKind::Plus    ? "arith.addf"
                               : operation.operation == TokenKind::Minus ? "arith.subf"
                               : operation.operation == TokenKind::Star  ? "arith.mulf"
                                                                         : "arith.divf";
            return binary(loc, name, a, b);
          } else if constexpr (std::is_same_v<T, NumericConvert>) {
            auto input = expression(frame, operation.input);
            const auto source = input_.expressions[operation.input].type.element;
            if (node.type.tensor)
              return convertTensor(loc, input, cast<RankedTensorType>(type(node.type)), source,
                                   node.type.element);
            auto [converted, valid] =
                numericConversion(builder_, loc, input, source, node.type.element);
            guard(loc, valid, 4);
            return converted;
          } else if constexpr (std::is_same_v<T, TensorUnary>) {
            return elementwise(loc, expression(frame, operation.operand), {},
                               cast<RankedTensorType>(type(node.type)), operation.operation, node.type.element);
          } else if constexpr (std::is_same_v<T, TensorBinary>) {
            auto a = expression(frame, operation.left), b = expression(frame, operation.right);
            return elementwise(loc, a, b, cast<RankedTensorType>(type(node.type)),
                               operation.operation, node.type.element);
          } else if constexpr (std::is_same_v<T, ArrayIndex> || std::is_same_v<T, TensorIndex>) {
            if constexpr (std::is_same_v<T, ArrayIndex>) {
              const auto &array = input_.expressions[operation.input].type;
              if (isOwnedArray(array)) {
                auto input = expression(frame, operation.input);
                Value position = expression(frame, operation.index);
                const auto element = input_.expressions[operation.index].type.element;
                if (isInteger32(element)) {
                  if (isUnsigned(element))
                    position =
                        arith::ExtUIOp::create(builder_, loc, builder_.getI64Type(), position);
                  else
                    position =
                        arith::ExtSIOp::create(builder_, loc, builder_.getI64Type(), position);
                }
                auto count = recordArrayLength(loc, input, array);
                guard(loc, compare(loc, arith::CmpIPredicate::ult, position, count), 5);
                auto storage =
                    LLVM::ExtractValueOp::create(builder_, loc, input, ArrayRef<int64_t>{1});
                auto ptr = LLVM::LLVMPointerType::get(builder_.getContext());
                auto cell = arrayCellType(array);
                auto address =
                    LLVM::GEPOp::create(builder_, loc, ptr, cell, storage, ValueRange{position});
                return arrayCellRead(loc, address, array);
              }
            }
            auto input = expression(frame, operation.input);
            std::vector<ValueId> indices;
            if constexpr (std::is_same_v<T, ArrayIndex>)
              indices = {operation.index};
            else
              indices = operation.indices;
            SmallVector<Value> positions, offsets;
            for (auto id : indices)
              positions.push_back(expression(frame, id));
            auto shape = dimensions(loc, input);
            checkedCount(loc, shape, describeNumeric(node.type.element)->bytes());
            for (std::size_t axis = 0; axis < indices.size(); ++axis) {
              auto position = positions[axis];
              const auto element = input_.expressions[indices[axis]].type.element;
              if (describeNumeric(element)->bits == 32) {
                if (isUnsigned(element))
                  position = arith::ExtUIOp::create(builder_, loc, builder_.getI64Type(), position);
                else
                  position = arith::ExtSIOp::create(builder_, loc, builder_.getI64Type(), position);
              }
              auto limit =
                  arith::IndexCastOp::create(builder_, loc, builder_.getI64Type(), shape[axis]);
              // Unsigned comparison rejects negative signed indices as well as
              // high uint64 indices, before any storage element is extracted.
              guard(loc, compare(loc, arith::CmpIPredicate::ult, position, limit), 5);
              offsets.push_back(
                  arith::IndexCastOp::create(builder_, loc, builder_.getIndexType(), position));
            }
            return tensor::ExtractOp::create(builder_, loc, input, offsets);
          } else if constexpr (std::is_same_v<T, CollectionQuery>) {
            auto input = expression(frame, operation.input);
            const auto &array = input_.expressions[operation.input].type;
            if (isOwnedArray(array))
              return recordArrayLength(loc, input, array);
            auto shape = dimensions(loc, input);
            checkedCount(
                loc, shape,
                describeNumeric(input_.expressions[operation.input].type.element)->bytes());
            if (operation.kind == CollectionQueryKind::Length)
              return arith::IndexCastOp::create(builder_, loc, builder_.getI64Type(), shape[0]);
            const auto output = cast<RankedTensorType>(type(node.type));
            Value result =
                tensor::EmptyOp::create(builder_, loc, output.getShape(), output.getElementType());
            for (std::size_t axis = 0; axis < shape.size(); ++axis) {
              auto extent =
                  arith::IndexCastOp::create(builder_, loc, builder_.getI64Type(), shape[axis]);
              result = tensor::InsertOp::create(builder_, loc, extent, result,
                                                ValueRange{index(loc, axis)});
            }
            return result;
          } else if constexpr (std::is_same_v<T, ArrayToTensor> ||
                               std::is_same_v<T, TensorToArray> ||
                               std::is_same_v<T, TensorReshape>) {
            std::optional<std::vector<ValueId>> dimensionOperands;
            if constexpr (std::is_same_v<T, TensorToArray>)
              dimensionOperands.emplace();
            else
              dimensionOperands = operation.dimensions;
            if (dimensionOperands) {
              auto input = expression(frame, operation.input);
              auto inputShape = dimensions(loc, input);
              auto inputCount =
                  checkedCount(loc, inputShape, describeNumeric(node.type.element)->bytes());
              SmallVector<Value> shape, dynamic, evaluated;
              for (auto id : *dimensionOperands)
                evaluated.push_back(expression(frame, id));
              const auto output = cast<RankedTensorType>(type(node.type));
              if constexpr (std::is_same_v<T, TensorToArray>) {
                shape.push_back(inputCount);
                if (output.isDynamicDim(0))
                  dynamic.push_back(inputCount);
                else
                  guard(loc,
                        compare(loc, arith::CmpIPredicate::eq, inputCount,
                                index(loc, output.getDimSize(0))),
                        1);
              }
              for (std::size_t axis = 0; axis < dimensionOperands->size(); ++axis) {
                auto id = (*dimensionOperands)[axis];
                auto dimension = evaluated[axis];
                const auto element = input_.expressions[id].type.element;
                if (describeNumeric(element)->bits == 32) {
                  if (isUnsigned(element))
                    dimension =
                        arith::ExtUIOp::create(builder_, loc, builder_.getI64Type(), dimension);
                  else
                    dimension =
                        arith::ExtSIOp::create(builder_, loc, builder_.getI64Type(), dimension);
                }
                guard(loc,
                      compare(loc,
                              isUnsigned(element) ? arith::CmpIPredicate::ule
                                                  : arith::CmpIPredicate::sge,
                              dimension, integer(loc, isUnsigned(element) ? INT64_MAX : 0)),
                      1);
                auto d =
                    arith::IndexCastOp::create(builder_, loc, builder_.getIndexType(), dimension);
                shape.push_back(d);
                if (output.isDynamicDim(axis))
                  dynamic.push_back(d);
                else
                  guard(loc,
                        compare(loc, arith::CmpIPredicate::eq, d,
                                index(loc, output.getDimSize(axis))),
                        1);
              }
              auto count = checkedCount(loc, shape, describeNumeric(node.type.element)->bytes());
              // Even a zero-element tensor needs representable row-major strides.
              Value stride = index(loc, 1);
              for (auto axis = shape.rbegin(); axis != shape.rend(); ++axis) {
                auto safe = arith::SelectOp::create(
                    builder_, loc, compare(loc, arith::CmpIPredicate::eq, *axis, index(loc, 0)),
                    index(loc, 1), *axis);
                auto limit = arith::DivUIOp::create(builder_, loc, index(loc, INT64_MAX), safe);
                auto zero = compare(loc, arith::CmpIPredicate::eq, *axis, index(loc, 0));
                guard(loc,
                      arith::OrIOp::create(builder_, loc, zero,
                                           compare(loc, arith::CmpIPredicate::ule, stride, limit)),
                      2);
                stride = arith::MulIOp::create(builder_, loc, stride, *axis);
              }
              guard(loc, compare(loc, arith::CmpIPredicate::eq, inputCount, count), 1);
              auto empty = tensor::EmptyOp::create(builder_, loc, output.getShape(),
                                                   output.getElementType(), dynamic);
              auto loop = scf::ForOp::create(
                  builder_, loc, index(loc, 0), count, index(loc, 1), ValueRange{empty},
                  [&](OpBuilder &, Location, Value i, ValueRange args) {
                    SmallVector<Value> sourceIndices;
                    if constexpr (std::is_same_v<T, ArrayToTensor>)
                      sourceIndices.push_back(i);
                    else {
                      sourceIndices.resize(inputShape.size());
                      Value remaining = i;
                      for (std::size_t axis = inputShape.size(); axis > 0; --axis) {
                        auto safe =
                            arith::SelectOp::create(builder_, loc,
                                                    compare(loc, arith::CmpIPredicate::eq,
                                                            inputShape[axis - 1], index(loc, 0)),
                                                    index(loc, 1), inputShape[axis - 1]);
                        sourceIndices[axis - 1] =
                            arith::RemUIOp::create(builder_, loc, remaining, safe);
                        remaining = arith::DivUIOp::create(builder_, loc, remaining, safe);
                      }
                    }
                    auto element = tensor::ExtractOp::create(builder_, loc, input, sourceIndices);
                    SmallVector<Value> indices(shape.size());
                    Value remaining = i;
                    for (std::size_t axis = shape.size(); axis > 0; --axis) {
                      auto safe = arith::SelectOp::create(
                          builder_, loc,
                          compare(loc, arith::CmpIPredicate::eq, shape[axis - 1], index(loc, 0)),
                          index(loc, 1), shape[axis - 1]);
                      indices[axis - 1] = arith::RemUIOp::create(builder_, loc, remaining, safe);
                      remaining = arith::DivUIOp::create(builder_, loc, remaining, safe);
                    }
                    auto inserted =
                        tensor::InsertOp::create(builder_, loc, element, args[0], indices);
                    scf::YieldOp::create(builder_, loc, ValueRange{inserted});
                  });
              return loop.getResult(0);
            }
            auto input = expression(frame, operation.input);
            auto shape = dimensions(loc, input);
            checkedCount(loc, shape, describeNumeric(node.type.element)->bytes());
            const auto output = cast<RankedTensorType>(type(node.type));
            SmallVector<Value> dynamic;
            if (output.isDynamicDim(0))
              dynamic.push_back(shape[0]);
            auto empty = tensor::EmptyOp::create(builder_, loc, output.getShape(),
                                                 output.getElementType(), dynamic);
            auto loop = scf::ForOp::create(
                builder_, loc, index(loc, 0), shape[0], index(loc, 1), ValueRange{empty},
                [&](OpBuilder &, Location, Value i, ValueRange args) {
                  auto element = tensor::ExtractOp::create(builder_, loc, input, ValueRange{i});
                  auto inserted =
                      tensor::InsertOp::create(builder_, loc, element, args[0], ValueRange{i});
                  scf::YieldOp::create(builder_, loc, ValueRange{inserted});
                });
            return loop.getResult(0);
          } else if constexpr (std::is_same_v<T, ArrayMap>) {
            auto input = expression(frame, operation.input);
            SmallVector<Value> captures;
            for (auto capture : operation.captures)
              captures.push_back(expression(frame, capture));
            const auto &inputType = input_.expressions[operation.input].type;
            const bool ownedInput = isOwnedArray(inputType);
            const bool ownedOutput = isOwnedArray(node.type);
            Value count =
                ownedInput
                    ? Value(arith::IndexCastOp::create(builder_, loc, builder_.getIndexType(),
                                                       recordArrayLength(loc, input, inputType)))
                    : dimensions(loc, input)[0];
            if (!ownedInput)
              checkedCount(loc, {count}, describeNumeric(inputType.element)->bytes());
            Value empty;
            if (ownedOutput) {
              empty = recordArrayStorage(loc, node.type, count);
            } else {
              checkedCount(loc, {count}, describeNumeric(node.type.element)->bytes());
              auto output = cast<RankedTensorType>(type(node.type));
              SmallVector<Value> dynamic;
              if (output.isDynamicDim(0))
                dynamic.push_back(count);
              empty = tensor::EmptyOp::create(builder_, loc, output.getShape(),
                                              output.getElementType(), dynamic);
            }
            auto ptr = LLVM::LLVMPointerType::get(builder_.getContext());
            auto loop = scf::ForOp::create(
                builder_, loc, index(loc, 0), count, index(loc, 1), ValueRange{empty},
                [&](OpBuilder &, Location, Value i, ValueRange args) {
                  Value element;
                  auto position =
                      arith::IndexCastOp::create(builder_, loc, builder_.getI64Type(), i);
                  if (ownedInput) {
                    auto storage =
                        LLVM::ExtractValueOp::create(builder_, loc, input, ArrayRef<int64_t>{1});
                    auto cell = arrayCellType(inputType);
                    auto address = LLVM::GEPOp::create(builder_, loc, ptr, cell, storage,
                                                       ValueRange{position});
                    element = arrayCellRead(loc, address, inputType);
                  } else {
                    element = tensor::ExtractOp::create(builder_, loc, input, ValueRange{i});
                  }
                  SmallVector<Value> arguments{element};
                  arguments.append(captures.begin(), captures.end());
                  auto call = func::CallOp::create(builder_, loc, functions_[operation.function],
                                                   arguments);
                  Value result;
                  if (ownedOutput) {
                    auto storage =
                        LLVM::ExtractValueOp::create(builder_, loc, args[0], ArrayRef<int64_t>{1});
                    auto cell = arrayCellType(node.type);
                    auto address = LLVM::GEPOp::create(builder_, loc, ptr, cell, storage,
                                                       ValueRange{position});
                    arrayCellStore(loc, call.getResult(0), address, node.type);
                    result = args[0];
                  } else {
                    result = tensor::InsertOp::create(builder_, loc, call.getResult(0), args[0],
                                                      ValueRange{i});
                  }
                  scf::YieldOp::create(builder_, loc, ValueRange{result});
                });
            return loop.getResult(0);
          } else if constexpr (std::is_same_v<T, TensorLiteral>) {
            SmallVector<Value> elements;
            for (auto child : operation.elements)
              elements.push_back(expression(frame, child));
            if (isOwnedArray(node.type))
              return recordArrayLiteral(loc, node.type, elements);
            return tensor::FromElementsOp::create(builder_, loc, type(node.type), elements);
          } else if constexpr (std::is_same_v<T, ConditionalOperation>) {
            auto condition = expression(frame, operation.condition);
            auto evaluate = [&](const std::vector<TypedStatement> &statements, ValueId result) {
              auto branch = frame;
              for (const auto &statement : statements) {
                auto value = expression(branch, statement.value);
                if (statement.binding)
                  branch.symbols[*statement.binding] = value;
              }
              auto value = castTensor(loc, expression(branch, result), type(node.type));
              scf::YieldOp::create(builder_, loc, ValueRange{value});
            };
            auto choice =
                scf::IfOp::create(builder_, loc, TypeRange{type(node.type)}, condition, true);
            {
              OpBuilder::InsertionGuard guard(builder_);
              builder_.setInsertionPointToStart(&choice.getThenRegion().front());
              evaluate(operation.whenTrue, operation.trueResult);
              builder_.setInsertionPointToStart(&choice.getElseRegion().front());
              evaluate(operation.whenFalse, operation.falseResult);
            }
            return choice.getResult(0);
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
            return matmul(loc, a, b, cast<RankedTensorType>(type(node.type)), operation, node.type.element);
          } else if constexpr (std::is_same_v<T, ReduceSum>)
            return reduce(loc, expression(frame, operation.input), operation, node.type.element);
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
            if (isOwnedArray(node.type)) {
              auto count = recordArrayLength(loc, input, node.type);
              for (const auto &requirement : operation.requirements)
                guard(
                    loc,
                    compare(loc, arith::CmpIPredicate::eq, count, integer(loc, requirement.extent)),
                    1);
              return input;
            }
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
    for (std::size_t i = 0; i < input_.functions[id].parameters.size(); ++i) {
      const auto parameter = input_.functions[id].parameters[i];
      frame.symbols.emplace(parameter, entry->getArgument(i));
      if (input_.symbols[parameter].type.builtin == BuiltinValue::String)
        validateString(function.getLoc(), entry->getArgument(i));
    }
    Value result;
    for (const auto &statement : input_.functions[id].body) {
      result = expression(frame, statement.value);
      if (statement.binding)
        frame.symbols.emplace(*statement.binding, result);
    }
    auto value = castTensor(function.getLoc(), result, function.getResultTypes()[0]);
    if (input_.functions[id].resultType.builtin == BuiltinValue::String)
      validateString(function.getLoc(), value);
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
      if (!t.tensor || isOwnedArray(t))
        arguments.push_back(type(t));
      else
        arguments.push_back(
            MemRefType::get(SmallVector<std::int64_t>(t.shape.size(), ShapedType::kDynamic),
                            cast<RankedTensorType>(type(t)).getElementType()));
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
      if (t.tensor && !isOwnedArray(t)) {
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
        checkedCount(function.getLoc(), shape, describeNumeric(t.element)->bytes());
        auto tensorType = RankedTensorType::get(
            SmallVector<std::int64_t>(t.shape.size(), ShapedType::kDynamic),
            cast<RankedTensorType>(type(t)).getElementType());
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
  std::unordered_map<std::size_t, Type> recordTypes_;
  std::unordered_map<std::size_t, std::pair<std::uint64_t, std::uint64_t>> recordLayouts_;
  unsigned nextMatmulHelper_ = 0, nextStringLiteral_ = 0;
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
      OpPrintingFlags flags;
      if (!input.source->parts().empty())
        flags.enableDebugInfo();
      module->print(source, flags);
    }
    // Keep the established binary32 CPU path unchanged. Only new scalar binary64
    // operations use the independently qualified strict integer implementation.
    SmallVector<Operation *> doubles;
    module->walk([&](Operation *op) {
      if (isa<arith::AddFOp, arith::SubFOp, arith::MulFOp, arith::DivFOp, arith::NegFOp>(op) &&
          op->getResult(0).getType().isF64())
        doubles.push_back(op);
    });
    for (auto *op : doubles)
      if (failed(lowerStrictCpuFloat(op)))
        return std::unexpected("strict CPU float64 lowering failed");
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
    if (exports.empty())
      for (const auto &function : input.functions)
        if (function.name == "main" && function.resultType.tensor)
          collectionMetadata(*native, function.resultType);
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
