#include "kalandra/Backend.h"
#ifdef KALANDRA_HAS_METAL_SOURCE
#include "kalandra/MetalSource.h"
#endif
#include "llvm/AsmParser/Parser.h"
#include "llvm/IR/Module.h"
#include "llvm/IR/Verifier.h"
#include "llvm/Support/FileSystem.h"
#include "llvm/Support/FileUtilities.h"
#include "llvm/Support/Program.h"
#include "llvm/Support/SourceMgr.h"
#include <algorithm>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <span>

namespace {
bool write(const std::filesystem::path &path, const std::string &contents) {
  std::ofstream output(path, std::ios::binary);
  output << contents;
  output.close();
  return bool(output);
}
} // namespace
int main(int argc, char **argv) {
  std::vector<char *> filtered{argv[0]};
  std::string target = "cpu";
  bool selectedTarget = false;
  for (int i = 1; i < argc; ++i) {
    const std::string_view option = argv[i];
    if (option == "--target") {
      if (selectedTarget || i + 1 >= argc) {
        std::cerr << "one complete --target option is required\n";
        return 2;
      }
      selectedTarget = true;
      target = argv[++i];
    } else {
      filtered.push_back(argv[i]);
      if ((option == "-o" || option == "--emit-mlir" || option == "--emit-llvm" ||
           option == "--test-entry") &&
          i + 1 < argc)
        filtered.push_back(argv[++i]);
    }
  }
  if (target == "metal") {
#ifdef KALANDRA_HAS_METAL_SOURCE
    char build[] = "--build";
    bool hasBuild = false;
    for (std::size_t i = 1; i < filtered.size(); ++i) {
      std::string_view option = filtered[i];
      if (option == "-o" && i + 1 < filtered.size())
        ++i;
      else if (option == "--build")
        hasBuild = true;
    }
    if (!hasBuild)
      filtered.push_back(build);
    return kalandra::compileMetalCommand(static_cast<int>(filtered.size()), filtered.data());
#else
    std::cerr << "Metal source support is disabled; configure both KALANDRA_BUILD_METAL_RUNTIME "
                 "and KALANDRA_BUILD_METAL_PROOF\n";
    return 2;
#endif
  }
  if (target != "cpu") {
    std::cerr << "unsupported native target: " << target << '\n';
    return 2;
  }
  const std::span<char *> arguments(filtered);
  if (arguments.size() < 2) {
    std::cerr << "usage: kalandrac source.kalandra -o executable [--emit-mlir file] [--emit-llvm "
                 "file] [--test-entry function] [--sanitize|--thread-sanitize] [-O0|-O2] [--target "
                 "cpu|metal]\n";
    return 2;
  }
  std::filesystem::path output, mlirPath, llvmPath;
  std::optional<std::string> testEntry;
  bool sanitize = false, threadSanitize = false;
  std::string optimization = "-O0";
  for (std::size_t i = 2; i < arguments.size(); ++i) {
    const std::string option = arguments[i];
    if ((option == "-o" || option == "--emit-mlir" || option == "--emit-llvm" ||
         option == "--test-entry") &&
        i + 1 < arguments.size()) {
      const std::string value = arguments[++i];
      if (option == "-o")
        output = value;
      else if (option == "--emit-mlir")
        mlirPath = value;
      else if (option == "--emit-llvm")
        llvmPath = value;
      else
        testEntry = value;
    } else if (option == "--sanitize")
      sanitize = true;
    else if (option == "--thread-sanitize")
      threadSanitize = true;
    else if (option == "-O0" || option == "-O2")
      optimization = option;
    else {
      std::cerr << "unknown or incomplete option: " << option << '\n';
      return 2;
    }
  }
  if (sanitize && threadSanitize) {
    std::cerr << "--sanitize and --thread-sanitize are separate builds\n";
    return 2;
  }
  if (output.empty()) {
    std::cerr << "missing -o executable\n";
    return 2;
  }
  std::vector<std::filesystem::path> paths{arguments[1]};
  for (const auto &path : {output, mlirPath, llvmPath}) {
    if (path.empty())
      continue;
    for (const auto &previous : paths) {
      std::error_code error;
      const bool equivalent = std::filesystem::equivalent(path, previous, error);
      std::error_code firstError, secondError;
      const auto a = std::filesystem::weakly_canonical(path, firstError);
      const auto b = std::filesystem::weakly_canonical(previous, secondError);
      if ((!error && equivalent) || (!firstError && !secondError && a == b)) {
        std::cerr << "source and output paths must be distinct\n";
        return 2;
      }
    }
    paths.push_back(path);
  }
  auto source = kalandra::loadSource(arguments[1]);
  if (!source) {
    std::cerr << arguments[1] << ": " << source.error() << '\n';
    return 1;
  }
  auto typed = kalandra::check(kalandra::parse(*source));
  if (!typed.ok()) {
    for (const auto &d : typed.diagnostics)
      std::cerr << kalandra::renderDiagnostic(**source, d);
    return 1;
  }
  auto lowered = kalandra::lowerNative(*typed.module, testEntry);
  if (!lowered) {
    std::cerr << "native lowering: " << lowered.error() << '\n';
    return 1;
  }
  if (sanitize || threadSanitize) {
    llvm::LLVMContext context;
    llvm::SMDiagnostic diagnostic;
    auto module = llvm::parseAssemblyString(lowered->llvm, diagnostic, context);
    if (!module) {
      std::cerr << "cannot prepare LLVM sanitizer attributes\n";
      return 1;
    }
    for (auto &function : *module)
      if (!function.isDeclaration())
        function.addFnAttr(threadSanitize ? llvm::Attribute::SanitizeThread
                                          : llvm::Attribute::SanitizeAddress);
    if (llvm::verifyModule(*module, &llvm::errs()))
      return 1;
    lowered->llvm.clear();
    llvm::raw_string_ostream outputIR(lowered->llvm);
    module->print(outputIR, nullptr);
  }
  if (!mlirPath.empty() && !write(mlirPath, lowered->mlir)) {
    std::cerr << "cannot write MLIR\n";
    return 1;
  }
  if (!llvmPath.empty() && !write(llvmPath, lowered->llvm)) {
    std::cerr << "cannot write LLVM IR\n";
    return 1;
  }
  llvm::SmallString<256> temporary;
  int descriptor = -1;
  if (auto error = llvm::sys::fs::createTemporaryFile("kalandra", "ll", descriptor, temporary)) {
    std::cerr << "cannot create linker input: " << error.message() << '\n';
    return 1;
  }
  llvm::FileRemover removeIR(temporary);
  {
    llvm::raw_fd_ostream file(descriptor, true);
    file << lowered->llvm;
    file.close();
    if (file.has_error()) {
      std::cerr << "cannot write linker input\n";
      return 1;
    }
  }
  llvm::SmallString<256> linkedOutput;
  if (auto error = llvm::sys::fs::createUniqueFile(output.string() + ".tmp-%%%%%%", descriptor,
                                                   linkedOutput)) {
    std::cerr << "cannot create output: " << error.message() << '\n';
    return 1;
  }
  llvm::sys::fs::closeFile(descriptor);
  llvm::FileRemover removeOutput(linkedOutput);
  std::vector<std::string> command{KALANDRA_CLANGXX,
                                   optimization,
                                   "-ffp-contract=off",
                                   "-Wno-override-module",
                                   std::string(temporary),
                                   threadSanitize ? KALANDRA_THREAD_SANITIZED_RUNTIME
                                   : sanitize     ? KALANDRA_SANITIZED_RUNTIME
                                                  : KALANDRA_RUNTIME,
                                   "-o",
                                   std::string(linkedOutput)};
  const auto main = std::ranges::find_if(typed.module->functions,
                                       [](const auto &f) { return f.name == "main"; });
  if (main != typed.module->functions.end() && main->resultType.element == kalandra::NumericType::Int32)
    command.insert(command.begin() + 5,
                   threadSanitize ? KALANDRA_INT32_THREAD_SANITIZED_ENTRY
                   : sanitize ? KALANDRA_INT32_SANITIZED_ENTRY : KALANDRA_INT32_ENTRY);
  if (sanitize) {
    command.push_back("-fsanitize=address,undefined");
    command.push_back("-fno-sanitize-recover=all");
  }
  if (threadSanitize)
    command.push_back("-fsanitize=thread");
  std::vector<llvm::StringRef> invocation(command.begin(), command.end());
  std::string error;
  const auto status = llvm::sys::ExecuteAndWait(command[0], invocation, {}, {}, 0, 0, &error);
  if (status != 0) {
    std::cerr << "native link failed: " << error << '\n';
    return 1;
  }
  std::error_code publishError;
  std::filesystem::rename(std::filesystem::path(std::string(linkedOutput)), output, publishError);
  if (publishError) {
    std::cerr << "cannot publish executable: " << publishError.message() << '\n';
    return 1;
  }
  return 0;
}
