#include "../lib/RecursiveRecordOps.h"
#include "../lib/TaskRecordOps.h"
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
    ValueType text;
    text.builtin = BuiltinValue::String;
    ValueType textList = list;
    textList.record = 2;
    input.records.push_back({"Texts",
                             {},
                             {{"$tag", integer, {}}, {"text", text, {}}, {"tail", textList, {}}},
                             {{"Empty", {}, {}}, {"More", {}, {1, 2}}}});
    input.records.push_back({"TextWrapper", {}, {{"value", textList, {}}}});
    ValueType array = integer;
    array.tensor = array.array = true;
    array.shape = {{std::nullopt, 1}};
    ValueType flags = array;
    flags.builtin = BuiltinValue::Bool;
    ValueType chain = list;
    chain.record = 4;
    input.records.push_back(
        {"Collections",
         {},
         {{"$tag", integer, {}}, {"values", array, {}}, {"flags", flags, {}}, {"next", chain, {}}},
         {{"End", {}, {}}, {"Link", {}, {1, 2, 3}}}});
    input.records.push_back({"CollectionWrapper", {}, {{"value", chain, {}}}});
    ValueType textArray = array;
    textArray.builtin = BuiltinValue::String;
    ValueType textChain = list;
    textChain.record = 6;
    input.records.push_back(
        {"StringArrays",
         {},
         {{"$tag", integer, {}}, {"items", textArray, {}}, {"next", textChain, {}}},
         {{"End", {}, {}}, {"Link", {}, {1, 2}}}});
    input.records.push_back({"StringArrayWrapper", {}, {{"value", textChain, {}}}});
    ValueType cells = array;
    cells.builtin = BuiltinValue::Record;
    cells.record = 8;
    input.records.push_back({"Cell",
                             {},
                             {{"$tag", integer, {}}, {"text", text, {}}, {"values", array, {}}},
                             {{"Empty", {}, {}}, {"Text", {}, {1}}, {"Data", {}, {2}}}});
    input.records.push_back({"Buckets", {}, {{"cells", cells, {}}}});
    ValueType treeArray = cells;
    treeArray.record = 10;
    input.records.push_back({"Tree", {}, {{"name", text, {}}, {"children", treeArray, {}}}});
    input.records.push_back({"Trees", {}, {{"values", treeArray, {}}}});
    ValueType callable;
    callable.builtin = BuiltinValue::Function;
    callable.callable = std::make_shared<FunctionSignature>(FunctionSignature{{integer}, integer});
    input.records.push_back({"Callable",
                             {},
                             {{"$tag", integer, {}}, {"apply", callable, {}}},
                             {{"Empty", {}, {}}, {"More", {}, {1}}}});
    auto functionArray = callable;
    functionArray.tensor = functionArray.array = true;
    functionArray.shape = {{std::nullopt, 1}};
    input.records.push_back({"FunctionArrays",
                             {},
                             {{"$tag", integer, {}}, {"items", functionArray, {}}},
                             {{"Empty", {}, {}}, {"More", {}, {1}}}});
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
    // Accept a deliberately untrusted descriptor to qualify active/inactive validation,
    // and return a boxed inline wrapper so the harness can outlive its invocation.
    builder.setInsertionPointToEnd(module.getBody());
    auto textFunction = mlir::LLVM::LLVMFuncOp::create(
        builder, loc, "text_box",
        mlir::LLVM::LLVMFunctionType::get(ptr, {ptr, builder.getI64Type()}));
    auto *entry = textFunction.addEntryBlock(builder);
    builder.setInsertionPointToStart(entry);
    mlir::Value emptyText = mlir::LLVM::ZeroOp::create(builder, loc, (*types)[2]);
    emptyText = insert(emptyText, constant(1), 0);
    auto terminal = emitter.box(loc, emptyText, 2);
    require(bool(terminal), "empty text box failed");
    auto descriptorType = (*types)[2].getBody()[1];
    auto descriptor =
        mlir::LLVM::LoadOp::create(builder, loc, descriptorType, entry->getArgument(0));
    auto node =
        insert(insert(insert(emptyText, entry->getArgument(1), 0), descriptor, 1), *terminal, 2);
    mlir::Value holder = mlir::LLVM::ZeroOp::create(builder, loc, (*types)[3]);
    holder = insert(holder, node, 0);
    auto boxedText = emitter.box(loc, holder, 3);
    require(bool(boxedText), "inline String dependency box failed");
    mlir::LLVM::ReturnOp::create(builder, loc, mlir::ValueRange{*boxedText});
    builder.setInsertionPointToEnd(module.getBody());
    auto collectionFunction = mlir::LLVM::LLVMFuncOp::create(
        builder, loc, "collection_box",
        mlir::LLVM::LLVMFunctionType::get(ptr, {ptr, ptr, builder.getI64Type()}));
    auto *collectionEntry = collectionFunction.addEntryBlock(builder);
    builder.setInsertionPointToStart(collectionEntry);
    mlir::Value end = mlir::LLVM::ZeroOp::create(builder, loc, (*types)[4]);
    end = insert(end, constant(1), 0);
    auto boxedEnd = emitter.box(loc, end, 4);
    require(bool(boxedEnd), "collection end box failed");
    mlir::Value link = insert(end, collectionEntry->getArgument(2), 0);
    for (unsigned field = 1; field <= 2; ++field) {
      auto descriptor = mlir::LLVM::LoadOp::create(builder, loc, (*types)[4].getBody()[field],
                                                   collectionEntry->getArgument(field - 1));
      link = insert(link, descriptor, field);
    }
    link = insert(link, *boxedEnd, 3);
    mlir::Value collectionHolder = mlir::LLVM::ZeroOp::create(builder, loc, (*types)[5]);
    collectionHolder = insert(collectionHolder, link, 0);
    auto boxedCollection = emitter.box(loc, collectionHolder, 5);
    require(bool(boxedCollection), "inline collection dependency box failed");
    mlir::LLVM::ReturnOp::create(builder, loc, mlir::ValueRange{*boxedCollection});
    builder.setInsertionPointToEnd(module.getBody());
    auto arrayFunction = mlir::LLVM::LLVMFuncOp::create(
        builder, loc, "string_array_box",
        mlir::LLVM::LLVMFunctionType::get(ptr, {ptr, builder.getI64Type()}));
    auto *arrayEntry = arrayFunction.addEntryBlock(builder);
    builder.setInsertionPointToStart(arrayEntry);
    mlir::Value arrayEnd = mlir::LLVM::ZeroOp::create(builder, loc, (*types)[6]);
    arrayEnd = insert(arrayEnd, constant(1), 0);
    auto boxedArrayEnd = emitter.box(loc, arrayEnd, 6);
    require(bool(boxedArrayEnd), "String array end box failed");
    auto arrayDescriptor = mlir::LLVM::LoadOp::create(builder, loc, (*types)[6].getBody()[1],
                                                      arrayEntry->getArgument(0));
    auto arrayLink =
        insert(insert(insert(arrayEnd, arrayEntry->getArgument(1), 0), arrayDescriptor, 1),
               *boxedArrayEnd, 2);
    mlir::Value arrayHolder = mlir::LLVM::ZeroOp::create(builder, loc, (*types)[7]);
    arrayHolder = insert(arrayHolder, arrayLink, 0);
    auto boxedArray = emitter.box(loc, arrayHolder, 7);
    require(bool(boxedArray), "inline String array dependency box failed");
    mlir::LLVM::ReturnOp::create(builder, loc, mlir::ValueRange{*boxedArray});
    builder.setInsertionPointToEnd(module.getBody());
    auto recordsFunction = mlir::LLVM::LLVMFuncOp::create(
        builder, loc, "record_array_box", mlir::LLVM::LLVMFunctionType::get(ptr, {ptr}));
    auto *recordsEntry = recordsFunction.addEntryBlock(builder);
    builder.setInsertionPointToStart(recordsEntry);
    auto recordsDescriptor = mlir::LLVM::LoadOp::create(builder, loc, (*types)[9].getBody()[0],
                                                        recordsEntry->getArgument(0));
    mlir::Value buckets = mlir::LLVM::ZeroOp::create(builder, loc, (*types)[9]);
    buckets = insert(buckets, recordsDescriptor, 0);
    auto boxedBuckets = emitter.box(loc, buckets, 9);
    require(bool(boxedBuckets), "record array box failed");
    mlir::LLVM::ReturnOp::create(builder, loc, mlir::ValueRange{*boxedBuckets});
    builder.setInsertionPointToEnd(module.getBody());
    auto treesFunction = mlir::LLVM::LLVMFuncOp::create(
        builder, loc, "tree_array_box", mlir::LLVM::LLVMFunctionType::get(ptr, {ptr}));
    auto *treesEntry = treesFunction.addEntryBlock(builder);
    builder.setInsertionPointToStart(treesEntry);
    auto treesDescriptor = mlir::LLVM::LoadOp::create(builder, loc, (*types)[11].getBody()[0],
                                                      treesEntry->getArgument(0));
    mlir::Value trees = mlir::LLVM::ZeroOp::create(builder, loc, (*types)[11]);
    trees = insert(trees, treesDescriptor, 0);
    auto boxedTrees = emitter.box(loc, trees, 11);
    require(bool(boxedTrees), "recursive Tree array box failed");
    mlir::LLVM::ReturnOp::create(builder, loc, mlir::ValueRange{*boxedTrees});
    function("bad_reference");
    mlir::Value listEnd = mlir::LLVM::ZeroOp::create(builder, loc, (*types)[0]);
    listEnd = insert(listEnd, constant(1), 0);
    mlir::Value wrapperValue = mlir::LLVM::ZeroOp::create(builder, loc, (*types)[1]);
    wrapperValue = insert(wrapperValue, listEnd, 0);
    auto wrongReference = emitter.box(loc, wrapperValue, 1);
    auto badList = insert(insert(listEnd, constant(2), 0), *wrongReference, 2);
    auto badBox = emitter.box(loc, badList, 0);
    require(bool(badBox), "bad-reference fixture failed");
    auto badRead = emitter.read(loc, *badBox, 0);
    mlir::LLVM::ReturnOp::create(builder, loc, mlir::ValueRange{extract(*badRead, 0)});
    builder.setInsertionPointToEnd(module.getBody());
    auto callableFunction = mlir::LLVM::LLVMFuncOp::create(
        builder, loc, "callable_box",
        mlir::LLVM::LLVMFunctionType::get(ptr, {ptr, ptr, builder.getI64Type()}));
    auto *callableEntry = callableFunction.addEntryBlock(builder);
    builder.setInsertionPointToStart(callableEntry);
    mlir::Value closure = mlir::LLVM::ZeroOp::create(builder, loc, (*types)[12].getBody()[1]);
    closure =
        insert(insert(closure, callableEntry->getArgument(0), 0), callableEntry->getArgument(1), 1);
    mlir::Value callableValue = mlir::LLVM::ZeroOp::create(builder, loc, (*types)[12]);
    callableValue = insert(insert(callableValue, callableEntry->getArgument(2), 0), closure, 1);
    auto boxedCallable = emitter.box(loc, callableValue, 12);
    require(bool(boxedCallable), "callable field box failed");
    mlir::LLVM::ReturnOp::create(builder, loc, mlir::ValueRange{*boxedCallable});
    builder.setInsertionPointToEnd(module.getBody());
    auto functionArrayFunction = mlir::LLVM::LLVMFuncOp::create(
        builder, loc, "function_array_box",
        mlir::LLVM::LLVMFunctionType::get(ptr, {ptr, builder.getI64Type()}));
    auto *functionArrayEntry = functionArrayFunction.addEntryBlock(builder);
    builder.setInsertionPointToStart(functionArrayEntry);
    auto functionDescriptor = mlir::LLVM::LoadOp::create(builder, loc, (*types)[13].getBody()[1],
                                                         functionArrayEntry->getArgument(0));
    mlir::Value arrayValue = mlir::LLVM::ZeroOp::create(builder, loc, (*types)[13]);
    arrayValue =
        insert(insert(arrayValue, functionArrayEntry->getArgument(1), 0), functionDescriptor, 1);
    auto boxedFunctionArray = emitter.box(loc, arrayValue, 13);
    require(bool(boxedFunctionArray), "function array field box failed");
    mlir::LLVM::ReturnOp::create(builder, loc, mlir::ValueRange{*boxedFunctionArray});
    for (auto [id, name] : {std::pair<std::size_t, const char *>{0, "copy_list"},
                            {12, "copy_callable"},
                            {13, "copy_function_array"},
                            {11, "copy_tree"}}) {
      builder.setInsertionPointToEnd(module.getBody());
      auto copyFunction = mlir::LLVM::LLVMFuncOp::create(
          builder, loc, name,
          mlir::LLVM::LLVMFunctionType::get(builder.getI1Type(), {ptr, ptr, ptr}));
      auto *copyEntry = copyFunction.addEntryBlock(builder);
      builder.setInsertionPointToStart(copyEntry);
      auto copied = emitter.copyReference(loc, copyEntry->getArgument(0), copyEntry->getArgument(1),
                                          copyEntry->getArgument(2), id);
      require(bool(copied), "recursive packet callback emission failed");
      mlir::LLVM::ReturnOp::create(builder, loc, mlir::ValueRange{*copied});
    }
    {
      builder.setInsertionPointToEnd(module.getBody());
      auto listMaker = mlir::LLVM::LLVMFuncOp::create(builder, loc, "make_list",
                                                      mlir::LLVM::LLVMFunctionType::get(ptr, {}));
      builder.setInsertionPointToStart(listMaker.addEntryBlock(builder));
      mlir::Value nil = mlir::LLVM::ZeroOp::create(builder, loc, (*types)[0]);
      nil = insert(nil, constant(1), 0);
      auto tail = emitter.box(loc, nil, 0);
      require(bool(tail), "list packet tail emission failed");
      auto cons = insert(insert(insert(nil, constant(2), 0), constant(42), 1), *tail, 2);
      auto listRoot = emitter.box(loc, cons, 0);
      require(bool(listRoot), "list packet root emission failed");
      mlir::LLVM::ReturnOp::create(builder, loc, mlir::ValueRange{*listRoot});
    }
    {
      builder.setInsertionPointToEnd(module.getBody());
      auto maker = mlir::LLVM::LLVMFuncOp::create(builder, loc, "make_nested_list",
                                                  mlir::LLVM::LLVMFunctionType::get(ptr, {}));
      builder.setInsertionPointToStart(maker.addEntryBlock(builder));
      mlir::Value nil = mlir::LLVM::ZeroOp::create(builder, loc, (*types)[0]);
      nil = insert(nil, constant(1), 0);
      auto tail = emitter.box(loc, nil, 0);
      require(bool(tail), "nested packet end failed");
      auto child = insert(insert(insert(nil, constant(2), 0), constant(42), 1), *tail, 2);
      auto boxedChild = emitter.box(loc, child, 0);
      require(bool(boxedChild), "nested packet child failed");
      auto parent = insert(insert(child, constant(10), 1), *boxedChild, 2);
      auto root = emitter.box(loc, parent, 0);
      require(bool(root), "nested packet root failed");
      mlir::LLVM::ReturnOp::create(builder, loc, mlir::ValueRange{*root});
    }
    for (auto [id, name] : {std::pair<std::size_t, const char *>{0, "read_list_head"},
                            {12, "read_callable_environment"},
                            {13, "read_function_array_data"},
                            {11, "read_tree_data"}}) {
      builder.setInsertionPointToEnd(module.getBody());
      auto reader = mlir::LLVM::LLVMFuncOp::create(
          builder, loc, name,
          mlir::LLVM::LLVMFunctionType::get(id == 0 ? mlir::Type(builder.getI64Type()) : ptr,
                                            {ptr}));
      auto *readerEntry = reader.addEntryBlock(builder);
      builder.setInsertionPointToStart(readerEntry);
      auto value = emitter.read(loc, readerEntry->getArgument(0), id);
      require(bool(value), "packet reader emission failed");
      mlir::Value result = id == 0    ? extract(*value, 1)
                           : id == 12 ? extract(extract(*value, 1), 1)
                           : id == 13 ? extract(extract(*value, 1), 1)
                                      : extract(extract(*value, 0), 1);
      mlir::LLVM::ReturnOp::create(builder, loc, mlir::ValueRange{result});
    }
    function("unsupported");
    TypedModule unsupported;
    ValueType collection;
    collection.builtin = BuiltinValue::TaskError;
    unsupported.records.push_back({"Text", {}, {{"value", collection, {}}}});
    auto unsupportedTypes = lowerRecordTypes(unsupported, context);
    auto unsupportedStorage = planRecordStorage(unsupported);
    require(unsupportedTypes && unsupportedStorage, "unsupported fixture planning failed");
    RecursiveRecordOps unsupportedEmitter(unsupported, *unsupportedStorage, *unsupportedTypes,
                                          builder, module);
    auto textValue = mlir::LLVM::ZeroOp::create(builder, loc, (*unsupportedTypes)[0]);
    require(!unsupportedEmitter.box(loc, textValue, 0),
            "owned collection field silently omitted from dependency plan");
    require(!emitter.box(loc, constant(1), 0) && !emitter.read(loc, constant(1), 0),
            "physical operand validation missing");
    auto nullPointer = mlir::LLVM::ZeroOp::create(builder, loc, ptr);
    require(!emitter.copyReference(loc, constant(1), nullPointer, nullPointer, 0) &&
                !emitter.copyReference(loc, nullPointer, nullPointer, nullPointer,
                                       input.records.size()),
            "recursive packet copy accepted malformed operands or nominal identity");
    mlir::LLVM::ReturnOp::create(builder, loc, mlir::ValueRange{constant(0)});
    require(!emitter.finish(), "recursive array helper generation failed");
    require(mlir::succeeded(mlir::verify(module)), "recursive emitter MLIR verification failed");
    llvm::LLVMContext llvmContext;
    auto native = mlir::translateModuleToLLVMIR(module, llvmContext);
    require(bool(native), "recursive emitter LLVM translation failed");
    auto error = addCheckedInvocationABI(*native, false);
    if (error)
      throw std::runtime_error(*error);
    auto taskTypes = TaskValueTypes::create(input, llvmContext);
    require(bool(taskTypes), "task field physical types failed");
    TaskRecordOps taskOps(input, *taskTypes, *native);
    llvm::IRBuilder<> taskBuilder(llvmContext);
    auto *pointer = taskBuilder.getPtrTy();
    for (auto [field, name] : {std::pair<std::size_t, const char *>{0, "task_project_tag"},
                               {1, "task_project_head"},
                               {2, "task_project_tail"}}) {
      auto *function = llvm::Function::Create(
          llvm::FunctionType::get(taskBuilder.getInt1Ty(), {pointer, pointer, pointer}, false),
          llvm::GlobalValue::ExternalLinkage, name, *native);
      taskBuilder.SetInsertPoint(llvm::BasicBlock::Create(llvmContext, "entry", function));
      auto *failed = llvm::BasicBlock::Create(llvmContext, "failed", function);
      auto *value =
          taskOps.project(taskBuilder, function->getArg(1), 0, field, function->getArg(0), failed);
      taskBuilder.CreateStore(value, function->getArg(2));
      taskBuilder.CreateRet(taskBuilder.getTrue());
      taskBuilder.SetInsertPoint(failed);
      taskBuilder.CreateRet(taskBuilder.getFalse());
    }
    auto *copyField =
        llvm::Function::Create(llvm::FunctionType::get(taskBuilder.getInt1Ty(),
                                                       {pointer, pointer, pointer, pointer}, false),
                               llvm::GlobalValue::ExternalLinkage, "task_copy_tail", *native);
    taskBuilder.SetInsertPoint(llvm::BasicBlock::Create(llvmContext, "entry", copyField));
    auto *failed = llvm::BasicBlock::Create(llvmContext, "failed", copyField);
    auto *copied = taskOps.copyManagedField(taskBuilder, copyField->getArg(0), copyField->getArg(2),
                                            copyField->getArg(3), 0, 2, failed);
    taskBuilder.CreateStore(copied, copyField->getArg(1));
    taskBuilder.CreateRet(taskBuilder.getTrue());
    taskBuilder.SetInsertPoint(failed);
    taskBuilder.CreateRet(taskBuilder.getFalse());
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
