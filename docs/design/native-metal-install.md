# Installing the native Apple Metal compiler

The `native-metal-package` target adds Apple Metal compilation to the relocatable
[CPU compiler bundle](native-cpu-install.md). Configure both
`KALANDRA_BUILD_METAL_RUNTIME=ON` and `KALANDRA_BUILD_METAL_PROOF=ON`, using the
pinned [Apple GPU toolchain](apple-gpu.md), then build:

```sh
cmake --build build/native --target native-metal-package
```

Extract `build/native/native-metal/kalandra-native-metal-macos-arm64.tar.gz`
and add its `bin` directory to PATH. CPU compilation remains available; add
`--target metal` for GPU programs:

```sh
kalandra main.k --target metal -O2 -o app
./app/program
kalandra --project path/to/kalandra.toml --target metal -o app
```

Keep the installed prefix together. `kalandra` resolves its compiler-private
shader tools, host headers and CPU/Metal runtime archives relative to its actual
executable, including a symlink invocation. Missing installed resources never
fall back to source/build-tree copies. The Metal compiler is separate from the
CPU-only installed executable, so CPU packages retain their existing contract.

The archive includes all CPU/editor resources, four Metal runtime variants, the
optimized task-core archive, strict-lowering and extraction executables, private
generated-host headers and Metal dependency metadata. These are compiler resources;
they do not establish the separately planned public C/C++ interoperability ABI.
For direct installation, install `NativeEditorTools`, `NativeCPUCompiler` and then
`NativeMetalCompiler` to the same prefix. The final component replaces `kalandra`
with the CPU/Metal-capable driver. Archive layout requires `bin`, `lib` and `share`.

LLVM/MLIR/Clang 23.1.3, SPIRV-Cross, SPIRV-Tools, Apple's selected Metal compiler
and the macOS SDK remain external. Exact SPIR-V roots and Metal toolchain identity
are recorded under `share/kalandra-native-metal/toolchain.json`. This bundle does
not relocate those dependencies, bundle Apple's compiler, sign/notarize its tools,
or qualify another platform. The existing CPU-only GitHub tag-release workflow
is unchanged; hosted GPU/Metal toolchain qualification is required before adding
this artifact to automated publication.

A generated Metal application is a directory containing `program` and its shader
libraries. Keep those files together when moving the application. Ordinary
applications do not need the Kalandra compiler bundle or LLVM/MLIR to run, but do
require compatible Apple Metal hardware and system frameworks. ASan/UBSan and TSan
host modes additionally require platform sanitizer runtimes.

## Acceptance

After building the target, run:

```sh
ctest --test-dir build/native -R '^native-metal-install$' --output-on-failure
```

This test stages and packages the components, verifies complete checksums and
metadata, extracts into a prefix with spaces and deletes the original stage.
From a working directory outside the checkout, a compiler symlink builds CPU
source and GPU source in normal, optimized, ASan/UBSan and TSan modes. Explicit
project/package imports are checked too. Removing a private shader tool produces
a resource error and preserves the existing application executable. Finally the
test removes the installed compiler bundle, moves all generated applications and
executes them again. The independent CPU/editor installation gates remain in place.
