# Native VS Code integration

The native editor client in [`native/editor/vscode`](../../native/editor/vscode) packages the C++ language server for VS Code. It associates `.k` files with Kalandra, provides TextMate syntax highlighting and bracket/comment rules, and connects diagnostics, hover, definition, references, rename, completion, signature help and formatting to `kalandra-lsp`.

## Build and install

From a native Kalandra checkout:

```sh
cmake --build build/native --target kalandra-lsp
cd native/editor/vscode
bun install --frozen-lockfile --ignore-scripts
bun run package
```

The VSIX is written to `build/native/editor/kalandra-native.vsix` relative to the repository root. In VS Code, run **Extensions: Install from VSIX**, choose that file, and set **Kalandra Native: Server Path** in User Settings to the absolute path of your built `kalandra-lsp`. An executable name on PATH also works. Open a trusted local workspace and a `.k` file. No server installation/build/download happens inside the extension.

The VSIX contains a bundled client and its runtime dependency licenses; installing it does not require npm or Bun. VS Code runs that client in its own extension host. Bun is used only to build/package/test this adapter, not to compile Kalandra. The native server and its LLVM libraries are not bundled: an initial [native editor-tools installation/archive](native-tools-install.md) is now available, while complete compiler/runtime and bundled-LLVM distribution remain N5 work. The initial qualification uses macOS Apple Silicon. Version `0.1.0` identifies this separate editor package, not a compiler language release, and this package has not been published to the Marketplace.

## Configuration and lifecycle

- **Server Path** is a machine setting. It accepts an absolute executable path (including spaces) or one executable name on PATH, without shell command parsing. Workspace settings cannot replace this machine-scoped value.
- **Project Path** optionally supplies one explicit `.toml` manifest to the server for entry/package mappings. A relative path requires exactly one local workspace folder; multi-root windows require an absolute path. Leave it empty for standalone roots with relative imports. A single server/manifest serves the window; per-folder manifests and ancestor discovery are not implemented.
- **Placement** adds the server's placement-checking flag. It does not run code or assert that all checked GPU programs can lower.

Configuration changes and workspace-folder changes serialize a stop/start of the server. **Kalandra: Restart Native Language Server** also restarts it after a rebuild or manifest-content change. **Kalandra: Show Native Language Server Output** opens its log. A failed startup reports settings/output actions without blocking activation on a notification. A failed/stopped client can be restarted; process crashes do not cause an automatic retry loop. Deactivation disposes the client.

Language-server execution requires Workspace Trust, with a runtime trust guard as well as manifest capabilities. The server launches directly with ordinary stdin/stdout; the adapter does not add Node-server transport arguments. Only local-file `.k` documents are selected. Virtual workspaces and the browser extension host are unsupported. Remote-host and additional-platform behavior remain unqualified.

## Editor behavior and limits

All semantic features use native compiler information. The adapter does not expand supported language/backend behavior or introduce prototype semantics. See the [server contract](native-language-server.md) for failed-graph behavior, reference/rename workspace boundaries, bounded completion, resource budgets and synchronous analysis. Configuration/package changes require a restart because the native server loads its manifest at startup.

Format Document uses the [shared native formatter](native-formatter.md). VS Code can minimize the server's full-document replacement and normalize a no-change result to an absent edit list. User source stays unsaved until the editor saves it. The extension does not autoformat on save or edit disk files itself.

TextMate highlighting covers native keywords, numeric and builtin types, operators, numbers, Strings/escapes, comments and call spellings. It is lexical coloring rather than compiler semantic tokens; a function-colored token is not proof of a valid call. Theme colors and ligatures follow the editor's preferences. Debugging, semantic tokens, inlay hints, incomplete-call recovery and other editors remain follow-ups.

## Qualification

```sh
cd native/editor/vscode
bun test
KALANDRA_VSCODE_EXECUTABLE='/Applications/Visual Studio Code.app/Contents/MacOS/Code' bun run test:editor
```

The test script uses an existing VS Code executable, packages the actual VSIX, checks its file allowlist and bundled notices, and installs it with the VS Code CLI into a temporary extension directory/profile. It then launches the installed files in the real Extension Development Host with isolated multi-root fixtures. Normal user settings/extensions are not changed. `KALANDRA_VSCODE_CLI` can select a different CLI, and `KALANDRA_LSP` can select another native server build. Test artifacts/results remain under ignored `build/native/editor`.

Unit tests check launch/configuration boundaries, trust gating, serialized restarts, failed-start recovery and shutdown. TextMate/Oniguruma tests tokenize the grammar. Actual VS Code provider commands exercise imports/hover/definition, unopened-caller references with root isolation, rename proposals, partial-name completion, unsaved dependency diagnostics, applied Unicode/CRLF formatting and idempotence, configured package mappings and manual restart. Member-completion acceptance also applies whole-identifier edits for imported record fields, enum constructors and remaining match cases, record/update/enum payload labels, and shorthand/explicit match payload labels. It checks Field/EnumMember kinds, trigger-character requests, supplied-field exclusion and live imported overlays. Applied edits are followed by checked type hover and cleared diagnostics; original fixture files remain unchanged. These tests do not substitute for additional-platform, accessibility/manual UX or Marketplace acceptance.

The [qualification record](../../native/metal-proof/evidence/native-vscode-2026-10-20.json) records the installed editor version, check list, package and source hashes. The manifest's minimum engine compatibility is not a claim that every supported VS Code version has been tested.

The [member-completion editor qualification](../../native/metal-proof/evidence/native-vscode-members-2026-10-21.json)
records 14 installed-extension-host checks and seven client/grammar/lifecycle tests
on VS Code 1.142.0, macOS ARM64, with the LLVM 23.1.3 native server. These are
provider-command and applied-edit integration checks, not a claim of manual
suggestion-widget, keyboard-selection or accessibility acceptance.

[Checked signature help](native-language-server.md#checked-signature-help) now
connects the native function signature and active argument to the VS Code provider.
Its initial acceptance uses an imported function in the installed extension host.
The analyzed graph must parse and type-check. [Trailing-parenthesis recovery](native-language-server.md#trailing-parenthesis-recovery) now helps at the end of a buffer when arguments are complete; missing arguments require future work.

[Higher-order signature help](native-language-server.md#higher-order-call-signatures)
now follows imported factory results and indexed callbacks in the installed
extension host. The provider checks structural labels, the second active argument
and exact parameter-label ranges for repeated types. It extends existing calls;
no syntax or runtime behavior changes.

Trailing-parenthesis acceptance also requests help for an unsaved imported call
before its closing `)` is typed. It verifies the signature and active argument,
the unchanged buffer/disk source, and the original `L005` diagnostic remaining
visible until the user fixes the source.
