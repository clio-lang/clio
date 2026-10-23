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
// Only compiler-owned resources move with the installed prefix. LLVM, SPIR-V
// tools, Clang and Apple's Metal toolchain remain explicit external dependencies.
#ifdef KALANDRA_INSTALLED_COMPILER
std::filesystem::path resourceRoot() {
  static int anchor;
  std::error_code error;
  auto executable =
      std::filesystem::canonical(llvm::sys::fs::getMainExecutable(nullptr, &anchor), error);
  if (error)
    throw std::runtime_error("cannot locate installed Metal compiler executable");
  return executable.parent_path() / KALANDRA_RUNTIME_RELATIVE_DIR;
}
#endif
std::string resource(const char *configured, bool include = false) {
#ifdef KALANDRA_INSTALLED_COMPILER
  auto path = resourceRoot() / (include ? std::filesystem::path("headers/metal")
                                        : std::filesystem::path(configured).filename());
  std::error_code error;
  bool present = include ? std::filesystem::is_directory(path, error)
                         : std::filesystem::is_regular_file(path, error);
  if (!present)
    throw std::runtime_error("installed Metal resource is missing: " + path.string());
  return path.string();
#else
  (void)include;
  return configured;
#endif
}
} // namespace
void buildMetalProgram(const std::filesystem::path &directory,
                       const std::map<std::string, std::string> &outputs,
                       const std::string &variant) {
  const auto strict = resource(KALANDRA_GPU_STRICT);
  const auto strict64 = resource(KALANDRA_GPU_STRICT64);
  const auto extract = resource(KALANDRA_GPU_EXTRACT);
  const auto include = resource(KALANDRA_GPU_INCLUDE, true);
  const auto metal = resource(variant == "optimized"          ? KALANDRA_GPU_METAL_OPTIMIZED
                              : variant == "sanitized"        ? KALANDRA_GPU_METAL_SANITIZED
                              : variant == "thread-sanitized" ? KALANDRA_GPU_METAL_THREAD_SANITIZED
                                                              : KALANDRA_GPU_METAL_DEBUG);
  const auto core = resource(variant == "optimized"          ? KALANDRA_GPU_CORE_OPTIMIZED
                             : variant == "sanitized"        ? KALANDRA_GPU_CORE_SANITIZED
                             : variant == "thread-sanitized" ? KALANDRA_GPU_CORE_THREAD_SANITIZED
                                                             : KALANDRA_GPU_CORE_DEBUG);
  for (const auto &[name, contents] : outputs) {
    if (!name.starts_with("kernel") || !name.ends_with(".mlir"))
      continue;
    auto base = (directory / std::filesystem::path(name).stem()).string();
    const bool numeric = contents.find("@kalandra_numeric_v1_") != std::string::npos;
    run({numeric ? strict64 : strict, base + ".mlir", base + ".lowered.mlir"});
    run({KALANDRA_GPU_OPT, base + ".lowered.mlir", "--verify-each",
         "--pass-pipeline=builtin.module(canonicalize,cse,convert-gpu-to-spirv,spirv.module(spirv-"
         "lower-abi-attrs,spirv-update-vce))",
         "-o", base + ".converted.mlir"});
    run({extract, base + ".converted.mlir", base + ".kernel.mlir", "--metal-compiler-rounding"});
    run({KALANDRA_GPU_TRANSLATE, "--no-implicit-module", "--serialize-spirv", base + ".kernel.mlir",
         "-o", base + ".spv"});
    run({KALANDRA_GPU_VALIDATE, "--target-env", "vulkan1.0", base + ".spv"});
    std::vector<std::string> cross{KALANDRA_GPU_CROSS,
                                   base + ".spv",
                                   "--msl",
                                   "--msl-version",
                                   numeric ? KALANDRA_GPU_TYPED_MSL_VERSION : "20200",
                                   "--output",
                                   base + ".metal"};
    if (contents.find("@kalandra_elementwise_v3(") != std::string::npos ||
        contents.find("// kalandra.numeric.indirect") != std::string::npos)
      cross.insert(cross.end(), {"--msl-argument-buffers", "--msl-argument-buffer-tier", "1",
                                 "--msl-device-argument-buffer", "0",
                                 "--msl-force-active-argument-buffer-resources"});
    run(std::move(cross));
    run({KALANDRA_GPU_METAL_COMPILER, "-isysroot", KALANDRA_GPU_METAL_SDK,
         std::string("-std=") + (numeric ? KALANDRA_GPU_TYPED_METAL_LANGUAGE : "macos-metal2.2"),
         "-fno-fast-math", "-ffp-contract=off",
         "-fmodules-cache-path=" + (directory / "module-cache").string(), "-c", base + ".metal",
         "-o", base + ".air"});
    run({KALANDRA_GPU_METAL_COMPILER, base + ".air", "-o", base + ".metallib"});
  }
  // Each entry is independently validated/lowered before offline linking.
  // Runtime loading verifies all entry interfaces before publishing the bundle.
  for (const auto &[name, contents] : outputs) {
    (void)contents;
    if (!name.starts_with("kernel") || !name.ends_with(".mlir"))
      continue;
    auto stem = std::filesystem::path(name).stem().string();
    if (!outputs.contains(stem + "-rows2.mlir"))
      continue;
    auto base = (directory / stem).string();
    run({KALANDRA_GPU_METAL_COMPILER, base + ".air", base + "-rows2.air", base + "-quad.air", "-o",
         base + ".metallib"});
  }
  llvm::SmallString<256> temporary;
  int descriptor = -1;
  auto executable = directory / "program";
  if (auto error = llvm::sys::fs::createUniqueFile(executable.string() + ".tmp-%%%%%%", descriptor,
                                                   temporary))
    throw std::runtime_error(error.message());
  llvm::sys::fs::closeFile(descriptor);
  llvm::FileRemover cleanup(temporary);
  std::vector<std::string> command{KALANDRA_GPU_CLANG, "-std=c++23",        "-Wall", "-Wextra",
                                   "-Werror",          "-ffp-contract=off", "-I",    include};
  if (variant == "optimized") {
    command.push_back("-O2");
  } else if (variant == "sanitized") {
    command.insert(command.end(), {"-O1", "-g", "-fsanitize=address,undefined",
                                   "-fno-sanitize-recover=all", "-fno-omit-frame-pointer"});
  } else if (variant == "thread-sanitized") {
    command.insert(command.end(), {"-O1", "-g", "-fsanitize=thread", "-fno-omit-frame-pointer"});
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
