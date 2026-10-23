# Native distribution and platform qualification

N5 is **in progress**. CPU/editor installation, standalone dependency packaging
and local isolation acceptance now pass on macOS ARM64. This is not yet a signed,
notarized, clean-machine-qualified release or support for another platform.

## Standalone CPU and editor artifacts

```sh
cmake --build build/native --target native-editor-tools-standalone-package native-cpu-standalone-package
```

These additional archives are separate from the external-toolchain packages:

```text
native-editor-tools-standalone/kalandra-native-editor-tools-standalone-macos-arm64.tar.gz
native-cpu-standalone/kalandra-native-cpu-standalone-macos-arm64.tar.gz
```

Each archive has a `.sha256` sidecar and extracted `SHA256SUMS` inventory.
Tar/gzip timestamps, ownership, ordering and permissions are normalized. Set
`SOURCE_DATE_EPOCH` to an unsigned 32-bit epoch; the default is zero. Acceptance
repacks the same binaries from different staging directories and requires identical
archive bytes. This tests reproducible packaging, not independent compiler builds.
Keep the whole extracted directory together. The editor bundle includes LLVM,
Z3 and Zstandard. The CPU bundle adds MLIR, Clang's C++ library, a private Clang
driver, compiler resources and the existing normal/ASan-UBSan/TSan Kalandra
runtime archives. Upstream licenses accompany the dependency inventory.

Native loading uses package-relative `@loader_path` references and macOS system
libraries. Original RPATHs are removed from staging copies; build outputs and
upstream toolchain files are not modified. Unresolved loads, unknown dependency
licenses, duplicate library basenames, non-macOS binaries and missing ARM64 slices
prevent publication. Universal dynamic compiler runtimes are thinned to ARM64.
Binaries are ad-hoc signed after rewriting and verified before archiving. This
provides local integrity, not Developer ID authentication or notarization.

The CPU driver resolves its private Clang and compiler resources beside its
installed runtime directory, including symlink invocation. Missing private tools
fail rather than falling back to development Clang. Apple's SDK, command-line
tools and system linker remain compilation prerequisites. Editor-only tools need
no compiler, SDK, checkout, Homebrew, Bun, Node or Python to run. Ordinary generated
programs have no LLVM/MLIR dependency; sanitized programs need their sanitizer runtime.

`lib/kalandra/toolchain/standalone.json` records dependency hashes, architecture,
external requirements and the highest deployment target among bundled Mach-O
binaries. The local 2026-10-23 artifacts require **macOS 27.0 or later**. This is
measured from the binaries, not inferred from ARM64 code generation. Older OS
compatibility requires building and testing compatible dependencies; changing
metadata is insufficient.

## Qualification gates

```sh
cmake --build build/native --target native-cpu-toolchain kalandra
ctest --test-dir build/native -R '^native-(standalone-.*|distribution-archive|cpu-install|editor-tools-install)$' --output-on-failure
```

The standalone tests extract into paths containing spaces and Unicode, remove
the original staging prefix, verify checksums/signatures, and audit all dynamic
loads. Native subprocesses run under a macOS sandbox denying reads of the
checkout, build tree and Homebrew, and denying network access. A negative read
probe verifies isolation is enforced. Complete strict LSP and unfinished-code
protocol suites run through that sandbox.

CPU acceptance covers all ten numeric result types, Bool/String and array result
families, workers and all three runtime variants. It also checks compiler symlinks,
missing private Clang/dylib failures, preservation of an existing output after
resource failure, and ordinary generated programs running with the compiler bundle
absent. The external-toolchain CPU/editor gates remain independent. Dependency
rejection tests use real Mach-O copies and verify original binaries are unchanged.

The [qualification record](../../native/metal-proof/evidence/native-standalone-distribution-2026-10-23.json)
records local results and artifact hashes. Dependency denial on a development
machine is stronger than a PATH-only test, but does not establish clean-OS,
download/quarantine or hosted-runner compatibility.

The release workflow now builds both standalone archives and gates publication
on a separate `qualify-standalone` job. It downloads artifacts without installing
LLVM/Homebrew or building native code, then runs the isolation tests. Its
`macos-15` ARM64 label follows the current [GitHub runner reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).
Hosted qualification runs are now triggered by relevant pushes to `native`.
Initial runs failed while provisioning the exact pinned LLVM bottle; successful
hosted artifact acceptance remains an open gate. Branch pushes do not publish releases.
The [CI signing setup](native-ci-signing.md) adds a separate hosted signing/notary
job; credentials and an accepted hosted submission are still required.

## Remaining N5 work

- [x] External CPU/editor install, archive and relocation gates.
- [x] Standalone CPU/editor dependencies, private Clang, licenses and deployment metadata.
- [x] Local dependency-denial, sanitizer/worker and missing-resource acceptance.
- [x] Separate downloaded-artifact CI gate implemented.
- [ ] Successful hosted qualification of the exact release artifacts.
- [ ] Clean-machine, download/quarantine and selected minimum-OS qualification.
- [x] Reproducible archive metadata and byte-identical independent staging repacks.
- [ ] Independent source-build reproducibility comparison.
- [ ] Developer ID signing and notarization with publisher credentials.
- [ ] Metal dependency/compiler packaging and release-runner/hardware qualification.
- [ ] CPU runtime/linker/install qualification on Windows, Linux and FreeBSD, in that order.

The earlier local qualification record's missing identity/component observations
were caused by sandbox restrictions. An unrestricted check found the existing
Developer ID Application identity and a cached, signature-verified Metal compiler
matching the pin (32023.864). The external-dependency Metal package subsequently
passed `native-metal-install` on this Mac. No artifact has been Developer ID signed
or submitted for notarization locally. Hosted signing, Metal distribution closure
and release-runner/hardware qualification remain open.
Apple Metal is the first GPU platform; CUDA, distributed execution and C/C++
embedding retain separate roadmaps. N6 covers website, onboarding and release work.
