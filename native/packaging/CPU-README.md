# Kalandra native CPU compiler

This package adds `bin/kalandra` and its private CPU runtime archives to the
native editor tools. Add `bin` to PATH, then compile a `.k` file or explicit
native project manifest:

```sh
kalandra new my-app
kalandra --project my-app/kalandra.toml -o program
./program
```

For an existing project, compile with `kalandra --project path/to/kalandra.toml -o program`,
or pass a `.k` source file directly.

`new` creates an offline two-module parallel-map starter. Its parent directory
must exist, and its destination must not exist; existing files/directories and
symlinks are never replaced or merged. No packages are fetched or hooks run.

The compiler locates `lib/kalandra/native` relative to its actual executable,
including when invoked through a symlink or PATH. Keep this directory with the
compiler when moving the package. Missing resources fail without falling back
to development build files. Normal, ASan/UBSan (`--sanitize`) and separate TSan
(`--thread-sanitize`) runtime archives are included. `-O0` and `-O2` select the
existing native compilation modes.

LLVM/MLIR libraries, Clang 23.1.3, and the macOS SDK remain external dependencies
from the pinned development toolchain at its linked/configured paths. Moving
this package does not relocate Clang or LLVM. Generated ordinary executables
link the CPU runtime statically and do not require the package or LLVM to run;
sanitized programs additionally need their platform sanitizer runtime.

This is the macOS ARM64 CPU package. Metal/GPU builds are not included, even if
the development build enables them. No public C/C++ library ABI is introduced:
the archives are compiler-private resources. Signing/notarization, self-contained
toolchain dependencies and additional platform qualification remain release work.
See the accompanying editor-tools README, toolchain metadata, licenses and
SHA256SUMS for the rest of the package contract.

Exact local Git dependencies can be installed explicitly with `kalandra install --project path/to/kalandra.toml`. Installation requires system Git; subsequent project builds verify the activated cache offline. Remote Git URLs, mutable refs and public lockfiles are not supported yet.
