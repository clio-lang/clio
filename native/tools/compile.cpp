#include "kalandra/Backend.h"
#include "llvm/Support/FileSystem.h"
#include "llvm/Support/FileUtilities.h"
#include "llvm/Support/Program.h"
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
  const std::span<char *> arguments(argv, static_cast<std::size_t>(argc));
  if (arguments.size() < 2) {
    std::cerr << "usage: kalandrac source.kalandra -o executable [--emit-mlir file] [--emit-llvm "
                 "file] [--test-entry function] [--sanitize] [-O0|-O2]\n";
    return 2;
  }
  std::filesystem::path output, mlirPath, llvmPath;
  std::optional<std::string> testEntry;
  bool sanitize = false;
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
    else if (option == "-O0" || option == "-O2")
      optimization = option;
    else {
      std::cerr << "unknown or incomplete option: " << option << '\n';
      return 2;
    }
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
                                   sanitize ? KALANDRA_SANITIZED_RUNTIME : KALANDRA_RUNTIME,
                                   "-o",
                                   std::string(linkedOutput)};
  if (sanitize) {
    command.push_back("-fsanitize=address,undefined");
    command.push_back("-fno-sanitize-recover=all");
  }
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
