#pragma once
#include "NativeLayout.h"
#include "RecordLLVMTypes.h"
#include "mlir/Dialect/Func/IR/FuncOps.h"
#include "mlir/Target/LLVMIR/TypeToLLVM.h"
#include "llvm/IR/DataLayout.h"
#include "llvm/IR/LLVMContext.h"

namespace kalandra {
// Checked-IR emitter only. Source/transport admission is enforced separately.
class RecursiveRecordOps {
public:
  RecursiveRecordOps(const TypedModule &input, const RecordStoragePlan &storage,
                     const std::vector<mlir::LLVM::LLVMStructType> &types, mlir::OpBuilder &builder,
                     mlir::ModuleOp module)
      : input_(input), storage_(storage), types_(types), builder_(builder), module_(module),
        variants_(input.records.size()) {
    for (std::size_t id = 0; id < input.records.size(); ++id) {
      variants_[id].resize(input.records[id].fields.size());
      for (std::size_t variant = 0; variant < input.records[id].variants.size(); ++variant)
        for (auto slot : input.records[id].variants[variant].fields)
          variants_[id][slot] = variant + 1;
    }
  }
  std::expected<mlir::Value, std::string> box(mlir::Location loc, mlir::Value value,
                                              std::size_t id) {
    if (id >= types_.size() || value.getType() != types_[id])
      return std::unexpected("recursive box requires its checked nominal physical type");
    struct Pending {
      mlir::Value value, active;
      std::size_t id;
    };
    std::vector<Pending> pending{{value, constant(loc, 1, 1), id}};
    llvm::SmallVector<mlir::Value> dependencies;
    std::size_t work = 0;
    while (!pending.empty()) {
      auto current = pending.back();
      pending.pop_back();
      const auto &record = input_.records[current.id];
      for (std::size_t field = 0; field < record.fields.size(); ++field) {
        if (++work > 300000)
          return std::unexpected("recursive box dependency expansion exceeds configured budget");
        const auto &type = record.fields[field].type;
        auto active = current.active;
        if (variants_[current.id][field]) {
          auto tag = extract(loc, current.value, 0);
          auto selected =
              mlir::LLVM::ICmpOp::create(builder_, loc, mlir::LLVM::ICmpPredicate::eq, tag,
                                         constant(loc, variants_[current.id][field]));
          active = mlir::LLVM::AndOp::create(builder_, loc, active, selected);
        }
        auto member = extract(loc, current.value, field);
        if (storage_.fields[current.id][field] == RecordFieldStorage::ManagedReference) {
          auto absent = mlir::LLVM::ZeroOp::create(builder_, loc, pointer());
          dependencies.push_back(
              mlir::LLVM::SelectOp::create(builder_, loc, active, member, absent));
        } else if (type.record && !type.tensor) {
          pending.push_back({member, active, *type.record});
        } else if (!type.tensor && type.builtin == BuiltinValue::String) {
          auto descriptor = slot(loc, member.getType(), 1, alignof(void *));
          mlir::LLVM::StoreOp::create(builder_, loc, member, descriptor);
          auto function = declaration("kalandra_recursive_string_dependency",
                                      {pointer(), builder_.getI64Type()});
          auto selected = mlir::LLVM::ZExtOp::create(builder_, loc, builder_.getI64Type(), active);
          dependencies.push_back(mlir::LLVM::CallOp::create(builder_, loc, function,
                                                            mlir::ValueRange{descriptor, selected})
                                     .getResult());
        } else if (type.tensor && (type.builtin == BuiltinValue::Numeric || isBoolArray(type))) {
          auto descriptor = slot(loc, member.getType(), 1, alignof(void *));
          mlir::LLVM::StoreOp::create(builder_, loc, member, descriptor);
          auto selected = mlir::LLVM::ZExtOp::create(builder_, loc, builder_.getI64Type(), active);
          if (isBoolArray(type)) {
            auto function = declaration("kalandra_recursive_bool_dependency",
                                        {pointer(), builder_.getI64Type()});
            dependencies.push_back(
                mlir::LLVM::CallOp::create(builder_, loc, function,
                                           mlir::ValueRange{descriptor, selected})
                    .getResult());
          } else {
            auto function = declaration(
                "kalandra_recursive_tensor_dependency",
                {pointer(), builder_.getI64Type(), builder_.getI64Type(), builder_.getI64Type()});
            dependencies.push_back(
                mlir::LLVM::CallOp::create(
                    builder_, loc, function,
                    mlir::ValueRange{descriptor, constant(loc, type.shape.size()),
                                     constant(loc, static_cast<unsigned>(type.element)), selected})
                    .getResult());
          }
        } else if (type.tensor ||
                   (type.builtin != BuiltinValue::Numeric && type.builtin != BuiltinValue::Bool)) {
          return std::unexpected("recursive boxes currently require numeric/Bool/String scalars, "
                                 "numeric collections, Bool arrays, inline "
                                 "supported records and managed recursive references");
        }
      }
    }
    const auto [bytes, alignment] = layout(id);
    auto payload = slot(loc, types_[id], 1, alignment);
    mlir::LLVM::StoreOp::create(builder_, loc, value, payload);
    auto table =
        slot(loc, pointer(), std::max<std::size_t>(1, dependencies.size()), alignof(void *));
    for (std::size_t index = 0; index < dependencies.size(); ++index) {
      auto address = mlir::LLVM::GEPOp::create(builder_, loc, pointer(), pointer(), table,
                                               mlir::ValueRange{constant(loc, index)});
      mlir::LLVM::StoreOp::create(builder_, loc, dependencies[index], address);
    }
    auto key = typeKey(loc, id);
    auto function = declaration("kalandra_recursive_make",
                                {pointer(), builder_.getI64Type(), builder_.getI64Type(), pointer(),
                                 pointer(), builder_.getI64Type()});
    return mlir::LLVM::CallOp::create(builder_, loc, function,
                                      mlir::ValueRange{payload, constant(loc, bytes),
                                                       constant(loc, alignment), key, table,
                                                       constant(loc, dependencies.size())})
        .getResult();
  }
  std::expected<mlir::Value, std::string> read(mlir::Location loc, mlir::Value node,
                                               std::size_t id) {
    if (id >= types_.size() || node.getType() != pointer())
      return std::unexpected("recursive read requires a checked nominal reference");
    const auto [bytes, alignment] = layout(id);
    auto function = declaration("kalandra_recursive_read", {pointer(), builder_.getI64Type(),
                                                            builder_.getI64Type(), pointer()});
    auto data =
        mlir::LLVM::CallOp::create(builder_, loc, function,
                                   mlir::ValueRange{node, constant(loc, bytes),
                                                    constant(loc, alignment), typeKey(loc, id)})
            .getResult();
    return mlir::LLVM::LoadOp::create(builder_, loc, types_[id], data).getResult();
  }

private:
  mlir::Type pointer() { return mlir::LLVM::LLVMPointerType::get(builder_.getContext()); }
  mlir::Value constant(mlir::Location loc, std::uint64_t value, unsigned bits = 64) {
    auto type = builder_.getIntegerType(bits);
    return mlir::LLVM::ConstantOp::create(builder_, loc, type,
                                          builder_.getIntegerAttr(type, value));
  }
  mlir::Value extract(mlir::Location loc, mlir::Value value, std::size_t field) {
    return mlir::LLVM::ExtractValueOp::create(
        builder_, loc, value, llvm::ArrayRef<std::int64_t>{static_cast<std::int64_t>(field)});
  }
  mlir::Value slot(mlir::Location loc, mlir::Type type, std::size_t count, std::size_t alignment) {
    auto *operation = builder_.getInsertionBlock()->getParentOp();
    while (!mlir::isa<mlir::func::FuncOp, mlir::LLVM::LLVMFuncOp>(operation))
      operation = operation->getParentOp();
    mlir::OpBuilder::InsertionGuard guard(builder_);
    builder_.setInsertionPointToStart(&operation->getRegion(0).front());
    return mlir::LLVM::AllocaOp::create(builder_, loc, pointer(), type, constant(loc, count),
                                        alignment);
  }
  std::pair<std::uint64_t, std::uint64_t> layout(std::size_t id) {
    llvm::LLVMContext context;
    mlir::LLVM::TypeToLLVMIRTranslator translator(context);
    auto *type = translator.translateType(types_[id]);
    llvm::DataLayout layout(nativeCpuDataLayout);
    return {layout.getTypeAllocSize(type).getFixedValue(), layout.getABITypeAlign(type).value()};
  }
  mlir::Value typeKey(mlir::Location loc, std::size_t id) {
    const auto name = "kalandra_recursive_type_" + std::to_string(id);
    auto global = module_.lookupSymbol<mlir::LLVM::GlobalOp>(name);
    if (!global) {
      mlir::OpBuilder::InsertionGuard guard(builder_);
      builder_.setInsertionPointToStart(module_.getBody());
      global = mlir::LLVM::GlobalOp::create(builder_, loc, builder_.getI8Type(), true,
                                            mlir::LLVM::Linkage::Internal, name,
                                            builder_.getI8IntegerAttr(0));
    }
    return mlir::LLVM::AddressOfOp::create(builder_, loc, global);
  }
  mlir::LLVM::LLVMFuncOp declaration(llvm::StringRef name, llvm::ArrayRef<mlir::Type> arguments) {
    if (auto found = module_.lookupSymbol<mlir::LLVM::LLVMFuncOp>(name))
      return found;
    mlir::OpBuilder::InsertionGuard guard(builder_);
    builder_.setInsertionPointToStart(module_.getBody());
    return mlir::LLVM::LLVMFuncOp::create(builder_, builder_.getUnknownLoc(), name,
                                          mlir::LLVM::LLVMFunctionType::get(pointer(), arguments));
  }
  const TypedModule &input_;
  const RecordStoragePlan &storage_;
  const std::vector<mlir::LLVM::LLVMStructType> &types_;
  mlir::OpBuilder &builder_;
  mlir::ModuleOp module_;
  std::vector<std::vector<std::size_t>> variants_;
};
} // namespace kalandra
