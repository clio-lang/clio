#include "../lib/RecursiveRecordOps.h"
#include "mlir/IR/Verifier.h"
#include "mlir/Target/LLVMIR/Dialect/Builtin/BuiltinToLLVMIRTranslation.h"
#include "mlir/Target/LLVMIR/Dialect/LLVMIR/LLVMToLLVMIRTranslation.h"
#include "mlir/Target/LLVMIR/Export.h"
#include "llvm/IR/Module.h"
#include "llvm/IR/Verifier.h"
#include "llvm/Support/FileSystem.h"
#include "llvm/Support/raw_ostream.h"
#include <iostream>
#include <stdexcept>
namespace kalandra {
std::optional<std::string> addCheckedInvocationABI(llvm::Module &, bool);
}
using namespace kalandra;
static void require(bool value, const char *message) {
  if (!value)
    throw std::runtime_error(message);
}
int main(int argc, char **argv) {
  try {
    require(argc == 2, "expected output LLVM path");
    TypedModule input;
    ValueType integer;
    integer.element = NumericType::Int64;
    ValueType list;
    list.builtin = BuiltinValue::Record;
    list.record = 0;
    input.records.push_back({"List",
                             {},
                             {{"$tag", integer, {}}, {"head", integer, {}}, {"tail", list, {}}},
                             {{"Nil", {}, {}}, {"Cons", {}, {1, 2}}}});
    input.records.push_back({"Wrapper", {}, {{"value", list, {}}}});
    mlir::MLIRContext context;
    context.loadDialect<mlir::LLVM::LLVMDialect>();
    mlir::registerLLVMDialectTranslation(context);
    mlir::registerBuiltinDialectTranslation(context);
    mlir::OpBuilder builder(&context);
    auto loc = builder.getUnknownLoc();
    auto module = mlir::ModuleOp::create(loc);
    auto types = lowerRecordTypes(input, context);
    auto storage = planRecordStorage(input);
    require(types && storage && hasRecordBacking(input),
            "fixture physical planning/backing recognition failed");
    RecursiveRecordOps emitter(input, *storage, *types, builder, module);
    const auto constant = [&](std::uint64_t value) -> mlir::Value {
      return mlir::LLVM::ConstantOp::create(builder, loc, builder.getI64Type(),
                                            builder.getI64IntegerAttr(value));
    };
    const auto insert = [&](mlir::Value value, mlir::Value field,
                            std::int64_t index) -> mlir::Value {
      return mlir::LLVM::InsertValueOp::create(builder, loc, value, field,
                                               llvm::ArrayRef<std::int64_t>{index});
    };
    const auto extract = [&](mlir::Value value, std::int64_t field) -> mlir::Value {
      return mlir::LLVM::ExtractValueOp::create(builder, loc, value,
                                                llvm::ArrayRef<std::int64_t>{field});
    };
    const auto function = [&](llvm::StringRef name) {
      builder.setInsertionPointToEnd(module.getBody());
      auto f = mlir::LLVM::LLVMFuncOp::create(
          builder, loc, name, mlir::LLVM::LLVMFunctionType::get(builder.getI64Type(), {}));
      builder.setInsertionPointToStart(f.addEntryBlock(builder));
    };
    function("probe");
    mlir::Value nil = mlir::LLVM::ZeroOp::create(builder, loc, (*types)[0]);
    nil = insert(nil, constant(1), 0);
    auto ptr = mlir::LLVM::LLVMPointerType::get(&context);
    auto fake = mlir::LLVM::IntToPtrOp::create(builder, loc, ptr, constant(0x1234));
    nil = insert(nil, fake, 2); // Inactive payload must never become an owned dependency.
    auto boxedNil = emitter.box(loc, nil, 0);
    require(bool(boxedNil), "nil box failed");
    mlir::Value cons = mlir::LLVM::ZeroOp::create(builder, loc, (*types)[0]);
    cons = insert(insert(insert(cons, constant(2), 0), constant(42), 1), *boxedNil, 2);
    auto boxed = emitter.box(loc, cons, 0);
    auto updated = emitter.box(loc, insert(cons, constant(99), 1), 0);
    require(boxed && updated, "shared parent box failed");
    auto first = emitter.read(loc, *boxed, 0), second = emitter.read(loc, *updated, 0);
    require(first && second, "parent projection failed");
    auto tail = emitter.read(loc, extract(*first, 2), 0);
    require(bool(tail), "child read failed");
    mlir::Value wrapper = mlir::LLVM::ZeroOp::create(builder, loc, (*types)[1]);
    wrapper = insert(wrapper, cons, 0);
    auto wrapped = emitter.box(loc, wrapper, 1);
    require(bool(wrapped), "inline wrapper box failed");
    auto unwrapped = emitter.read(loc, *wrapped, 1);
    require(bool(unwrapped), "inline wrapper projection failed");
    auto sum = mlir::LLVM::AddOp::create(builder, loc, extract(*first, 1), extract(*second, 1));
    auto withTag = mlir::LLVM::AddOp::create(builder, loc, sum, extract(*tail, 0));
    auto total =
        mlir::LLVM::AddOp::create(builder, loc, withTag, extract(extract(*unwrapped, 0), 1));
    mlir::LLVM::ReturnOp::create(builder, loc, mlir::ValueRange{total});
    function("wrong_key");
    mlir::Value empty = mlir::LLVM::ZeroOp::create(builder, loc, (*types)[0]);
    empty = insert(empty, constant(1), 0);
    auto one = emitter.box(loc, empty, 0);
    auto wrong = emitter.read(loc, *one, 1); // Same physical layout, different nominal token.
    require(bool(wrong), "wrong-key fixture emitter failed");
    mlir::LLVM::ReturnOp::create(builder, loc, mlir::ValueRange{extract(extract(*wrong, 0), 0)});
    function("forged");
    auto unknown = mlir::LLVM::IntToPtrOp::create(builder, loc, ptr, constant(0x1230));
    auto forged = emitter.read(loc, unknown, 0);
    require(bool(forged), "forged reference emitter failed");
    mlir::LLVM::ReturnOp::create(builder, loc, mlir::ValueRange{extract(*forged, 0)});
    function("unsupported");
    TypedModule unsupported;
    ValueType text;
    text.builtin = BuiltinValue::String;
    unsupported.records.push_back({"Text", {}, {{"value", text, {}}}});
    auto unsupportedTypes = lowerRecordTypes(unsupported, context);
    auto unsupportedStorage = planRecordStorage(unsupported);
    require(unsupportedTypes && unsupportedStorage, "unsupported fixture planning failed");
    RecursiveRecordOps unsupportedEmitter(unsupported, *unsupportedStorage, *unsupportedTypes,
                                          builder, module);
    auto textValue = mlir::LLVM::ZeroOp::create(builder, loc, (*unsupportedTypes)[0]);
    require(!unsupportedEmitter.box(loc, textValue, 0),
            "owned String field silently omitted from dependency plan");
    require(!emitter.box(loc, constant(1), 0) && !emitter.read(loc, constant(1), 0),
            "physical operand validation missing");
    mlir::LLVM::ReturnOp::create(builder, loc, mlir::ValueRange{constant(0)});
    require(mlir::succeeded(mlir::verify(module)), "recursive emitter MLIR verification failed");
    llvm::LLVMContext llvmContext;
    auto native = mlir::translateModuleToLLVMIR(module, llvmContext);
    require(bool(native), "recursive emitter LLVM translation failed");
    auto error = addCheckedInvocationABI(*native, false);
    if (error)
      throw std::runtime_error(*error);
    require(!llvm::verifyModule(*native, &llvm::errs()),
            "checked recursive LLVM verification failed");
    for (auto &global : native->globals())
      require(!global.hasGlobalUnnamedAddr(), "nominal tokens could be merged by value");
    std::error_code outputError;
    llvm::raw_fd_ostream output(argv[1], outputError, llvm::sys::fs::OF_Text);
    require(!outputError, "cannot open LLVM output");
    native->print(output, nullptr);
    output.flush();
    require(!output.has_error(), "cannot write LLVM output");
    module.erase();
    std::cout << "recursive emitter verified\n";
  } catch (const std::exception &error) {
    std::cerr << error.what() << '\n';
    return 1;
  }
}
