# Kalandra standalone native tools — macOS ARM64

Extract the archive into a directory you control and add its `bin` to PATH.
Keep the entire directory together when moving it. LLVM and its non-system
dynamic dependencies are included under `lib/kalandra/toolchain`; Homebrew and
the development checkout are not runtime requirements.

The CPU variant also includes `kalandra`, its private runtime archives and a
private Clang with compiler resources. Compiling programs still requires Apple's
command-line tools, SDK and system linker. The editor-only variant needs none of
those build tools to check/format source or run the language server. The VS Code
extension is distributed separately. These packages do not include Metal tools.

Read `lib/kalandra/toolchain/standalone.json` for the actual minimum macOS version,
architecture, dependency inventory and signature status. The highest deployment
requirement among all bundled binaries determines the minimum OS. A package
built on a newer OS is not automatically compatible with older macOS releases.

Mach-O files have ad-hoc signatures for integrity after relocation. They have no
Developer ID publisher signature and are not notarized. `SHA256SUMS` and the
archive checksum detect accidental changes; they do not authenticate a publisher.
Dependency licenses are in `share/licenses/kalandra-toolchain`.

No source checkout, Bun, Node or Python is needed to run the tools. This package
is an N5 distribution qualification artifact, not a claim of clean-machine or
broader platform qualification. Project: https://github.com/kalandra-lang/kalandra
