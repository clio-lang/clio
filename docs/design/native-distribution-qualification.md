# Native distribution and platform qualification

N5 is **in progress**. Its agreed scope is macOS ARM64 with CPU/Metal, plus CPU
qualification on Linux x86-64 and Windows x86-64. FreeBSD is deferred by the
publisher. CUDA remains a separate roadmap.

## Distribution contract

The macOS workflow builds external-toolchain and standalone variants of the
editor tools, CPU compiler, and mixed CPU/Metal compiler. The mixed compiler is
the primary macOS language distribution. Its private tools include LLVM/MLIR,
Clang and compiler resources, SPIRV-Cross, SPIRV-Tools, and strict numerical shader
helpers. Every included dependency has an accompanying license and inventory.
Apple's SDK, linker and exact Metal compiler component remain Apple platform
prerequisites; Apple's compiler is not redistributed. The installed driver
checks its Apple signature and pinned version, **32023.864**, before use.

Keep the extracted prefix together. Native tools resolve private dependencies
relative to their installation, including symlink invocation. Missing private
resources produce an error; installed compilers cannot fall back to development
paths. Ordinary generated applications execute without the compiler distribution.
Sanitized applications require the corresponding compiler sanitizer runtime.

macOS dependencies use audited `@loader_path` references with no residual build
RPATHs. Linux packaging recursively vendors approved ELF dependencies and audits
relative `$ORIGIN` search paths. glibc, libstdc++ and libgcc_s remain declared
Linux system runtimes. Windows packaging audits PE imports and places private
LLVM DLLs beside their loaders. Microsoft C++ Build Tools and the Windows SDK
remain Windows compilation prerequisites. Git is required for dependency
installation on each platform.

Windows does not support LLVM ThreadSanitizer. The compiler explicitly rejects
`--thread-sanitize` before replacing an output. Normal, optimized and ASan/UBSan
modes remain required Windows execution gates. This limitation does not change
language types or permit silently uninstrumented sanitizer builds.

## Reproducibility and isolation

Every archive has a SHA-256 sidecar and extracted `SHA256SUMS` inventory. GNU
tar/gzip timestamps, ownership, order and modes are normalized. `SOURCE_DATE_EPOCH`
defaults to zero. macOS qualification independently compiles the source into two
build directories and requires byte-identical standalone editor, CPU and mixed
Metal archives. LLVM's deterministic archiver/indexer and source/debug prefix
mapping are part of that build contract. Signing timestamps and notarization
receipts are separate from the reproducible unsigned inputs.

macOS acceptance relocates downloaded archives into paths with spaces and
Unicode. Native processes run under a sandbox denying the checkout, build tree,
Homebrew and network. Tests verify inventory hashes, signatures, deployment
metadata and every dynamic load. Strict and unfinished-code language-server
protocol suites execute through the sandbox. CPU tests cover all ten numeric
types, Bool/String and collections, workers, three runtime variants, symlink
invocation, missing resources, output preservation and compiler-independent
applications. Metal tests compile all ten numeric types with rank-eight maps,
resident reductions, selected stages, binary64 conversion and CPU workers in
normal, optimized, ASan/UBSan and TSan modes. Hosted tests compile GPU programs;
the same downloaded package executes them on the publisher's physical Mac.

Linux qualification uses a separate downloaded-artifact job without installing
LLVM or building the product. Bubblewrap denies the checkout and network while
allowing the relocated package and system platform tools. Portable CPU acceptance
requires execution of numeric scalars, arrays, tensors, owned records/enums,
Unicode strings, repeated worker awaits and expected errors, with worker counts
1/2/4. It also checks starter projects, pinned local package activation,
frozen/offline reuse, failed-build output preservation and execution after the
compiler is removed. Windows uses the same portable execution contract with its
explicit sanitizer limitation.

## Evidence and open gates

- Hosted run [39942060950](https://github.com/kalandra-lang/kalandra/actions/runs/39942060950)
  proved CPU/editor Developer ID signing, accepted Apple notarization, stapling,
  ticket validation and Gatekeeper assessment. No signing occurred locally.
- Hosted run [39950944721](https://github.com/kalandra-lang/kalandra/actions/runs/39950944721)
  proved byte-identical independent source builds and installed/downloaded
  editor, CPU and mixed Metal package acceptance on the macOS 15 runner.
- Physical GPU execution of that downloaded mixed package found a TSan visibility
  gap at Metal's uninstrumented completion callback. The per-command
  commit/completion synchronization is now explicitly exposed to TSan; a rebuilt
  hosted artifact must pass physical execution before that gate closes.
- The official Linux LLVM/MLIR archive has been verified and the native compiler
  builds. Downloaded-package execution and dependency packaging remain open.
- The official Windows archive omits MLIR. CI builds the matching hash-pinned
  official source against static dependencies from a pinned vcpkg baseline.
  Successful Windows compilation, packaging and downloaded execution remain open.
- Signed mixed-package download/quarantine, selected minimum-OS proof, and final
  current-commit qualification remain open. macOS deployment metadata is measured
  from every included Mach-O; the historical local macOS 27 build is not the
  release minimum. Hosted macOS 15 artifacts are qualified separately.

Branch rehearsals upload workflow artifacts and publish no release. The
[publisher signing setup](native-ci-signing.md) runs entirely on GitHub Actions.
Version-tag publication must remain gated on successful distribution checks.
N6 covers website, onboarding and release preparation. The historical
[local distribution record](../../native/metal-proof/evidence/native-standalone-distribution-2026-10-23.json)
is retained as historical evidence, not substituted for current hosted results.
