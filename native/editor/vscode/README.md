# Kalandra Native for VS Code

Edit native `.k` source with syntax highlighting, diagnostics, type hover, definition, references, safe rename, scope completion and Format Document. This extension connects VS Code to the C++ `kalandra-lsp`; it does not use the JavaScript prototype.

Build the native server and this extension from a Kalandra checkout:

```sh
cmake --build build/native --target kalandra-lsp
cd native/editor/vscode
bun install --frozen-lockfile --ignore-scripts
bun run package
```

Install `build/native/editor/kalandra-native.vsix` using **Extensions: Install from VSIX**. In User Settings, set **Kalandra Native: Server Path** to the absolute path of your built `kalandra-lsp`, or put the executable on PATH. Open a trusted local workspace and a `.k` file. Native server builds are currently qualified on macOS Apple Silicon; this editor package does not bundle the compiler or its LLVM dependencies.

**Kalandra Native: Project Path** optionally selects a native `.toml` project for package mappings. A relative manifest path requires one workspace folder; use an absolute path in a multi-root window. A single server/manifest serves each window. Without a manifest, the server checks open source roots with relative imports. There is no automatic project discovery or per-folder manifest selection. **Placement** enables placement checking without running GPU work.

Configuration or workspace-folder changes restart the client. Use **Kalandra: Restart Native Language Server** after rebuilding the executable or changing the manifest contents. **Kalandra: Show Native Language Server Output** opens startup/protocol errors. Executables are launched directly, without a shell or automatic build/download. Language-server execution requires Workspace Trust; syntax coloring itself is declarative. Remote/virtual workspaces, a web extension, debugger, semantic coloring and Marketplace publication are not qualified by this package.

Format Document uses the native fixed style and returns editor edits. Completion currently suggests in-scope names and needs parseable surrounding syntax. Hover/navigation/rename retain the native server's checked-graph requirements and documented search limits. This extension does not expand the compiler's supported language/backend subset.

Build tooling uses Bun; VS Code runs the bundled client in its own extension host. The VSIX includes runtime dependency notices and needs no npm install after installation. Its `0.1.0` version identifies this editor package, independently of compiler releases.

For maintainers, `bun test` checks configuration boundaries. Set `KALANDRA_VSCODE_EXECUTABLE` to an installed VS Code executable and run `bun run test:editor` to exercise the packed artifact in an isolated extension host. The test runner uses temporary profiles/workspaces and does not change your normal VS Code settings/extensions.
