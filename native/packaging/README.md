# Kalandra native editor tools

This package contains the native source checker, formatter, parser and language
server for macOS Apple Silicon:

- `bin/kalandra-check`: check source or an explicit native project manifest.
- `bin/kalandra-fmt`: print formatted source, or use `--check` without writes.
- `bin/kalandra-parse`: validate native syntax.
- `bin/kalandra-lsp`: provide editor services over stdin/stdout.

Extract the package to a directory you control and add its `bin` directory to
PATH. The VS Code extension can use `kalandra-lsp` on PATH, or its absolute path
in the **Kalandra Native: Server Path** user setting. Native source files use `.k`.

```sh
kalandra-check --project path/to/kalandra.toml
kalandra-check path/to/main.k
kalandra-fmt --check path/to/main.k
kalandra-parse path/to/main.k
```

These tools require the matching LLVM runtime from the pinned development
toolchain (currently LLVM 23.1.3). LLVM is an external dependency and is not
included in this archive. The binaries retain their platform loader dependency
paths; install the matching toolchain at those paths. Moving this package does
not relocate LLVM. Read the package's `share/kalandra-native-tools/toolchain.json`
for the build configuration and required LLVM version. A Debug or Release build
is preserved as such; this development package is not a qualified release.

`SHA256SUMS` covers the installed package files, and the archive has a separate
`.sha256` checksum. Checksums detect accidental changes, not publisher identity;
these packages are not signed or notarized.

The package does not include `kalandrac`, generated-program runtimes, GPU tools,
or a VS Code extension. Compiler/runtime distribution remains a separate step.
No source checkout, Bun, Node or Python is needed to run these native tools.
They preserve the compiler's documented language, synchronous analysis and
resource limits. The language server does not execute application code.

Project: https://github.com/kalandra-lang/kalandra
Licenses and attribution: `share/licenses/kalandra-native-tools`.
