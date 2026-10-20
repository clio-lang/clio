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

## Installed numerical libraries

The Metal-capable compiler consumes the same Git dependencies and `kalandra.lock`
as CPU builds. Install explicitly, then compile from the verified cache:

```sh
kalandra install --project path/to/kalandra.toml
kalandra --project path/to/kalandra.toml --target metal -O2 -o app
./app/program
```

To restore a checkout from its existing lock, use `install --frozen`. With all
snapshots already available, `install --frozen --offline` verifies the cache
without running Git. Compilation never installs dependencies. Move the complete
project and its `.kalandra` cache together for offline compilation; a fresh
checkout needs an explicit install first.

Each library retains its private dependency versions in CPU workers and GPU
helpers. Relative imports and re-exports retain that owner too. The same eligible
numerical function can run in a CPU worker or be dispatched on a GPU; importing it
does not broaden the supported GPU type/operation subset. Installed sources and
the public lock remain protected from build output. An altered snapshot prevents
compilation before an existing application is replaced.

Once compiled, generated applications do not load source packages or lockfiles.
Their `program` and shader libraries can be moved together and run without the
project cache, original repositories or compiler bundle. Platform/framework and
sanitizer-runtime requirements above still apply.

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


The installed-package acceptance also creates a numerical library with two
versions and a second library that privately depends on the older version.
An application uses the newer version directly. It restores a fresh cache with
`--frozen`, removes both original repositories, relocates the project/cache and
verifies `--frozen --offline` and placement diagnostics. The numerical program
runs an imported helper in a CPU worker, dispatches private/direct helpers on the
GPU, combines their results and checks exact float32 bits for `[105, 107, 109]`.
It runs in all four host modes, checks unchanged source/lock/cache bytes, rejects
snapshot corruption without replacing an existing application, and rejects
outputs inside the cache or at the public lock. Generated applications run again
after deleting their project/cache and after deleting the compiler and moving
the applications.

The [installed-package qualification record](../../native/metal-proof/evidence/native-metal-packages-2026-10-20.json)
records the tested compiler configurations and hardware. These checks qualify
this scoped numerical CPU/Metal path, not new GPU language features, another
platform, authenticated transport, or hosted Metal release automation. ASan/UBSan
and TSan instrument generated host code; they are not shader sanitizers.
