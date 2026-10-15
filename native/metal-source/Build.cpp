#include "Build.h"
#include "Toolchain.h"
#include "llvm/Support/FileSystem.h"
#include "llvm/Support/FileUtilities.h"
#include "llvm/Support/Program.h"
#include <stdexcept>
#include <vector>
namespace {
void run(std::vector<std::string> command) {
  std::vector<llvm::StringRef> args(command.begin(), command.end());
  std::string error;
  if (llvm::sys::ExecuteAndWait(command[0], args, {}, {}, 0, 0, &error) != 0)
    throw std::runtime_error("GPU build stage failed: " + command[0] + " " + error);
}
} // namespace
void buildMetalProgram(const std::filesystem::path &directory,
                       const std::map<std::string, std::string> &outputs,
                       const std::string &variant) {
  for (const auto &[name, contents] : outputs) {
    (void)contents;
    if (!name.starts_with("kernel") || !name.ends_with(".mlir"))
      continue;
    auto base = (directory / std::filesystem::path(name).stem()).string();
    run({KALANDRA_GPU_STRICT, base + ".mlir", base + ".lowered.mlir"});
    run({KALANDRA_GPU_OPT, base + ".lowered.mlir", "--verify-each",
         "--pass-pipeline=builtin.module(canonicalize,cse,convert-gpu-to-spirv,spirv.module(spirv-"
         "lower-abi-attrs,spirv-update-vce))",
         "-o", base + ".converted.mlir"});
    run({KALANDRA_GPU_EXTRACT, base + ".converted.mlir", base + ".kernel.mlir",
         "--metal-compiler-rounding"});
    run({KALANDRA_GPU_TRANSLATE, "--no-implicit-module", "--serialize-spirv", base + ".kernel.mlir",
         "-o", base + ".spv"});
    run({KALANDRA_GPU_VALIDATE, "--target-env", "vulkan1.0", base + ".spv"});
    run({KALANDRA_GPU_CROSS, base + ".spv", "--msl", "--msl-version", "20200", "--output",
         base + ".metal"});
    run({"/usr/bin/xcrun", "--toolchain", KALANDRA_GPU_METAL_TOOLCHAIN, "--sdk", "macosx", "metal",
         "-std=macos-metal2.2", "-fno-fast-math", "-ffp-contract=off",
         "-fmodules-cache-path=" + (directory / "module-cache").string(), "-c", base + ".metal",
         "-o", base + ".air"});
    run({"/usr/bin/xcrun", "--toolchain", KALANDRA_GPU_METAL_TOOLCHAIN, "metal", base + ".air",
         "-o", base + ".metallib"});
  }
  llvm::SmallString<256> temporary;
  int descriptor = -1;
  auto executable = directory / "program";
  if (auto error = llvm::sys::fs::createUniqueFile(executable.string() + ".tmp-%%%%%%", descriptor,
                                                   temporary))
    throw std::runtime_error(error.message());
  llvm::sys::fs::closeFile(descriptor);
  llvm::FileRemover cleanup(temporary);
  const char *metal = KALANDRA_GPU_METAL_DEBUG, *core = KALANDRA_GPU_CORE_DEBUG;
  std::vector<std::string> command{
      KALANDRA_GPU_CLANG, "-std=c++23",        "-Wall", "-Wextra",
      "-Werror",          "-ffp-contract=off", "-I",    KALANDRA_GPU_INCLUDE};
  if (variant == "optimized") {
    command.push_back("-O2");
    metal = KALANDRA_GPU_METAL_OPTIMIZED;
    core = KALANDRA_GPU_CORE_OPTIMIZED;
  } else if (variant == "sanitized") {
    command.insert(command.end(), {"-O1", "-g", "-fsanitize=address,undefined",
                                   "-fno-sanitize-recover=all", "-fno-omit-frame-pointer"});
    metal = KALANDRA_GPU_METAL_SANITIZED;
    core = KALANDRA_GPU_CORE_SANITIZED;
  } else if (variant == "thread-sanitized") {
    command.insert(command.end(), {"-O1", "-g", "-fsanitize=thread", "-fno-omit-frame-pointer"});
    metal = KALANDRA_GPU_METAL_THREAD_SANITIZED;
    core = KALANDRA_GPU_CORE_THREAD_SANITIZED;
  } else
    command.push_back("-O0");
  if (outputs.contains("cpu.ll")) {
    command.push_back("-Wno-override-module");
    command.push_back((directory / "cpu.ll").string());
  }
  command.insert(command.end(),
                 {(directory / "host.cpp").string(), metal, core, "-framework", "Foundation",
                  "-framework", "Metal", "-o", std::string(temporary)});
  run(std::move(command));
  std::filesystem::rename(std::string(temporary), executable);
}
