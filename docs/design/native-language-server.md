# Native language-server diagnostics

`kalandra-lsp` is the first native editor protocol implementation. It uses the C++ compiler's checker, [source overlays](native-source-overlays.md) and [diagnostic ranges](native-diagnostics.md); it does not invoke the JavaScript prototype or generate/run application code.

## Build and connect

```sh
cmake --build build/native --target kalandra-lsp
build/native/native/kalandra-lsp
```

Configure your editor's language-server client to launch the executable with `.k` documents associated with the `kalandra` language. It communicates over framed stdin/stdout, so running it in an ordinary terminal waits for protocol input. This is a development build; editor extension packaging and installed-command discovery remain work.

Optional arguments:

```sh
build/native/native/kalandra-lsp --project path/to/kalandra.toml
build/native/native/kalandra-lsp --placement --project path/to/kalandra.toml
```

The explicit project manifest is loaded at startup and supplies its entry and local package mappings. No ancestor discovery, dependency installation, unsaved manifest editing or automatic configuration reload is provided. Without it, each open file is checked as a root with relative imports. With it, open files and the project entry are checked using the same open-buffer replacements. `--placement` enables shared CPU/Metal placement checks; it does not guarantee GPU lowering or hardware capability.

## Supported protocol slice

The server implements the [Language Server Protocol 3.17](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/) lifecycle and advertises incremental document synchronization (`TextDocumentSyncKind.Incremental`) and UTF-16 positions:

- `initialize`, `initialized`, `shutdown`, `exit`.
- `textDocument/didOpen`, `didChange`, `didSave`, `didClose`.
- `textDocument/publishDiagnostics`, including open-buffer versions, compiler codes, source names and severity.

Changes can replace a UTF-16 range or supply full replacement text without a range. Apply changes in their array order against the evolving buffer: later ranges refer to the text after earlier changes. Full replacements and ranged edits can be mixed; the compiler checks the final buffer once. Empty change arrays are valid no-ops that advance the version.

Range lines and columns are nonnegative protocol integers. Positions past a line's length clamp to its end, without consuming its line ending. LF, CRLF and standalone CR delimit editor lines; language acceptance of the source is still decided by the lexer. Newline characters can be replaced by ranges spanning adjacent lines. Positions inside a supplementary scalar's UTF-16 surrogate pair, nonexistent lines, reversed ranges and malformed range fields are rejected. An optional deprecated `rangeLength` must match the replaced UTF-16 units, including line-ending units, and requires a range.

Each notification is transactional: text and version are committed only after every edit and budget check passes. An invalid later edit leaves earlier edits in that notification unapplied. Versions must increase; duplicate/older changes are ignored. Invalid notifications are logged with `window/logMessage` rather than receiving request responses. A client that has sent an invalid change should resynchronize with a full replacement at a newer version. Unsupported requests receive a method-not-found response. Before initialization and after shutdown, request handling follows the lifecycle state.

Opening or changing a file rechecks all open roots against the current set of unsaved buffers. Changed dependency signatures therefore recheck their callers. Diagnostics can point into unopened disk dependencies as well as open buffers; duplicates from overlapping roots are removed. Correcting errors or closing roots clears previous publications. Closing a dependency replaces its unsaved contents with its disk version for remaining open callers. Published open-document diagnostics carry that document's version; closed/disk documents do not.

Checks are synchronous and process messages in order. There are no background checks that can finish out of order. This first implementation does not debounce, cancel a running check or skip already queued older work. Version checking prevents a received older buffer from replacing a newer one; asynchronous stale-result suppression is future work.

The server accepts local UTF-8 `file:` URIs, including percent-encoded paths and `localhost`. Remote authorities, other schemes, invalid escapes, NUL/line breaks, queries/fragments and non-`.k` paths are rejected. Resolvable symlinks/normalized paths share compiler identity, so the same file cannot be opened twice under aliases. Publications preserve the client's open URI and clear previous URI spellings when ownership changes.

Errors with reliable source ranges appear as diagnostics. Source-less loading/configuration failures are logged instead of inventing source ranges. Compiler recovery and diagnostic limits still apply: this is not an exhaustive error list for every malformed graph.

## Limits and qualification

Protocol headers are bounded to 8 KiB, frame bodies to 32 MiB and JSON nesting to 128 levels. Open buffers share the existing source budget (16 MiB including one separator byte per buffer) and file-count limit (128). Reachable module graphs have their own existing compiler limits. Each notification permits at most 1,024 changes. Transactional editing also has a 128 MiB work budget: charge the original buffer once, each replacement plus one unit, and the current buffer for each ranged edit. This bounds the initial simple scan/copy implementation; large edit batches may require full replacement or smaller notifications. Every intermediate buffer must fit the shared open-buffer byte budget. These are explicit bounds, not responsiveness guarantees. No source files are written.

Malformed JSON with valid framing returns a parse error and leaves the session usable. Invalid, duplicate, oversized or truncated framing ends the process with status 2 because a safe next message boundary is unavailable. A normal shutdown/exit returns 0; exit or EOF before shutdown returns 1. Standard output contains only protocol frames. Standard error is reserved for startup/fatal failures.

Independent Python-stdlib protocol tests launch normal and ASan/UBSan builds, exercise interactive pipe framing, lifecycle, versions, Unicode ranges/URIs, source isolation, dependency changes/clearing, project packages, budgets and malformed input. The [initial qualification record](../../native/metal-proof/evidence/native-lsp-2026-10-20.json) covers the first full-sync implementation. [Incremental edit qualification](../../native/metal-proof/evidence/native-lsp-edits-2026-10-20.json) adds sequential/mixed edits, Unicode scalar boundaries, CRLF/CR positions, line-end clamping, transactional failure, deprecated lengths and edit limits. Third-party LLVM libraries are not rebuilt with sanitizers. No real editor or additional operating system is qualified by these protocol tests.

Next: native hover/navigation/completion and formatter integration. Filesystem watching, workspace indexing, asynchronous scheduling and editor distribution remain separate work.
