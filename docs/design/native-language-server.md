# Native language server

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

The server implements the [Language Server Protocol 3.17](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/) lifecycle and advertises incremental document synchronization (`TextDocumentSyncKind.Incremental`) and UTF-16 positions, plus `hoverProvider: true`, `definitionProvider: true` and `referencesProvider: true`:

- `initialize`, `initialized`, `shutdown`, `exit`.
- `textDocument/didOpen`, `didChange`, `didSave`, `didClose`.
- `textDocument/publishDiagnostics`, including open-buffer versions, compiler codes, source names and severity.
- `textDocument/hover` for checked token types and function signatures.
- `textDocument/definition` for resolved source declaration locations.
- `textDocument/references` for resolved occurrences in open/project source graphs.

Changes can replace a UTF-16 range or supply full replacement text without a range. Apply changes in their array order against the evolving buffer: later ranges refer to the text after earlier changes. Full replacements and ranged edits can be mixed; the compiler checks the final buffer once. Empty change arrays are valid no-ops that advance the version.

Range lines and columns are nonnegative protocol integers. Positions past a line's length clamp to its end, without consuming its line ending. LF, CRLF and standalone CR delimit editor lines; language acceptance of the source is still decided by the lexer. Newline characters can be replaced by ranges spanning adjacent lines. Positions inside a supplementary scalar's UTF-16 surrogate pair, nonexistent lines, reversed ranges and malformed range fields are rejected. An optional deprecated `rangeLength` must match the replaced UTF-16 units, including line-ending units, and requires a range.

Each notification is transactional: text and version are committed only after every edit and budget check passes. An invalid later edit leaves earlier edits in that notification unapplied. Versions must increase; duplicate/older changes are ignored. Invalid notifications are logged with `window/logMessage` rather than receiving request responses. A client that has sent an invalid change should resynchronize with a full replacement at a newer version. Unsupported requests receive a method-not-found response. Before initialization and after shutdown, request handling follows the lifecycle state.

Opening or changing a file rechecks all open roots against the current set of unsaved buffers. Changed dependency signatures therefore recheck their callers. Diagnostics can point into unopened disk dependencies as well as open buffers; duplicates from overlapping roots are removed. Correcting errors or closing roots clears previous publications. Closing a dependency replaces its unsaved contents with its disk version for remaining open callers. Published open-document diagnostics carry that document's version; closed/disk documents do not.

Checks are synchronous and process messages in order. There are no background checks that can finish out of order. This first implementation does not debounce, cancel a running check or skip already queued older work. Version checking prevents a received older buffer from replacing a newer one; asynchronous stale-result suppression is future work.

The server accepts local UTF-8 `file:` URIs, including percent-encoded paths and `localhost`. Remote authorities, other schemes, invalid escapes, NUL/line breaks, queries/fragments and non-`.k` paths are rejected. Resolvable symlinks/normalized paths share compiler identity, so the same file cannot be opened twice under aliases. Publications preserve the client's open URI and clear previous URI spellings when ownership changes.

Errors with reliable source ranges appear as diagnostics. Source-less loading/configuration failures are logged instead of inventing source ranges. Compiler recovery and diagnostic limits still apply: this is not an exhaustive error list for every malformed graph.

## Type information on hover

For example, hovering `double` at its declaration or a direct call can show:

```kalandra
fn double(value: int64) -> int64
```

Hover also covers binding/parameter declarations and reads, named function references, function-valued bindings and calls, record field declarations/reads, nominal type declarations, imported function/record names and aliases, and numeric/Bool/String literals. Imported aliases at direct call sites follow the compiler's resolved target and display the local call spelling. Closure captures stay private; displayed parameters exclude lifted environments. String literal contents are omitted from hover text.

Types come from a newly checked source graph using all current open buffers and the configured package mappings. This includes contextual numeric inference and current unsaved dependency signatures. Tensor shapes show fixed extents or `?`, without private inference identities. Error channels show named families and canonical union members, preserving the distinction between a factory's errors and its returned callable's errors.

The server returns `MarkupContent`, respecting the client's first supported plain-text/Markdown preference and using plain text by default. Markdown signatures are fenced as Kalandra code. The returned range covers the hovered token in its original file using UTF-16 positions. Whitespace, comments, punctuation, unopened documents and unmapped positions return `null`. Malformed request parameters return an invalid-params response. Invalid lines or positions inside surrogate pairs return `null`.

A graph with any parse/type error returns no hover information because the checker does not publish partial typed IR. Previous successful types are not reused. Imported error-alias hover presentations, general operator/expression selections and builtin call signatures are not yet mapped. This is a conservative semantic hover implementation, not name-based guessing.

Hover rechecks synchronously per request; it does not cache a typed workspace or provide a latency guarantee. Presentation is bounded to 4,096 visited type/error nodes, 32 formatting levels and 16 KiB of text. A presentation that exceeds these limits returns `null`. The [hover qualification record](../../native/metal-proof/evidence/native-lsp-hover-2026-10-20.json) records semantic and framed-protocol tests for normal and sanitized builds.

## Go to definition

`textDocument/definition` returns a standard `Location` containing the original source URI and the declaration identifier's UTF-16 range. It supports binding/parameter reads, named function references and direct/pipeline calls, record field reads, and the mapped declarations themselves. Imported function calls follow the compiler's resolved identity through aliases, package entries and re-export chains to the original declaration. Same-spelled local functions cannot redirect these jumps.

Calls through a function-valued binding jump to that binding's declaration. They do not guess a runtime function target from a name or possible-call set. Captured references, including captures inside nested closures, retain their original lexical definition separately from the compiler's diagnostic/capture locations. Shadowed names jump to the binding selected by the checker.

Definition and hover share checked token resolution. Both use the current unsaved source graph, fail closed when checking fails, and perform fresh synchronous analysis per request. Closing a dependency restores its disk contents and destination positions. The server preserves the URI spelling of an open target document; unopened targets use canonical percent-encoded file URIs. Jumps do not write files or require the destination to be open.

Unmapped tokens, literals, whitespace, keywords, builtins without source declarations, generated helper locations and failed graphs return `null`. The source document must be open under its registered URI. As with hover, malformed parameters return invalid-params, while invalid lines or split-surrogate positions return `null`. Wildcard patterns and builtin cases without source declarations have no source destination. Definition links, workspace symbols and rename are separate work.

The [definition qualification record](../../native/metal-proof/evidence/native-lsp-definition-2026-10-20.json) covers normal and sanitized semantic/protocol checks, including shadowing, nested captures, cross-file aliases/re-exports, package mappings, Unicode URIs, unsaved destination changes, close-to-disk behavior and hover regressions. These are protocol tests, not a real-editor qualification claim.

## Import declaration origins

The compiler retains resolved import metadata for each source name and optional explicit alias, including re-exports and unused imports. Each entry points to the original declaration through the checker's existing export resolution. Function and nominal record IDs support hover; error-family aliases retain their own declaration identity without pretending to be nominal records. These are source-tool metadata, not a second module resolver or runtime behavior change. Invalid graphs still publish no partial typed module.

Definition works on both sides of `from "./library.k" import scale as twice`, following the original `scale` declaration. Function hover uses the selected local spelling; nominal record aliases show their selected name. Error-alias declaration navigation is supported, but their hover presentation remains future work. Re-export tokens follow the original source, including chains and configured packages.

References include both the imported source-name token and an explicit alias token, including unused bindings. These are occurrences of the underlying declaration; `includeDeclaration` controls only the original declaration, not whether alias tokens appear. Metadata keeps the two token roles and the re-export flag distinct for future alias-preserving rename. A reference list alone still does not determine safe rename edits.

The [import-origin qualification record](../../native/metal-proof/evidence/native-lsp-import-origins-2026-10-20.json) covers normal and ASan/UBSan compiler, semantic and protocol checks for imported functions, records, error aliases, re-exports, unused imports, metadata roles, current buffers and original URI/range mapping.

## Type annotations and record construction

The checker retains source-token metadata while resolving annotations and constructing/updating records. Navigation and references therefore use the same nominal types and field indices as compilation, including imported and re-exported types. This metadata is deduplicated by source span and published only with a successful checked module; invalid annotations or constructors provide no partial navigation.

Nominal annotation tokens navigate to the original type declaration. Coverage includes parameter/result annotations, typed bindings, record fields, array element annotations, and nested function parameter/result types. Declared error channels and transparent error-alias members retain source identities too. An alias use points to that alias's declaration rather than collapsing to its canonical error family. Builtin numeric/Bool/String/TaskError and tensor annotation tokens provide checked hover information, but have no invented source declaration or reference identity. Array element and tensor element tokens show their element type rather than the surrounding collection.

A record constructor's type name navigates to the nominal declaration. Construction and immutable-update field labels navigate to the actual field declaration and participate in the same references as field reads. Same-spelled fields in different records remain distinct. Nominal tokens show their declaration header on hover; field labels show their checked value type. Enum construction and pattern roles are described below.

The [type-token qualification record](../../native/metal-proof/evidence/native-lsp-type-tokens-2026-10-20.json) covers normal and ASan/UBSan semantic/protocol checks, nested callable/array annotations, local/imported constructors and updates, nominal field identity, error aliases, source offsets after incremental Unicode/CRLF edits, builtin annotations and invalid-graph isolation. These are source-tool checks, not new runtime/GPU capabilities or real-editor qualification.

## Enum cases and match patterns

Enum and application-error case declarations, qualified constructors (with or without payloads), and qualified match cases now retain their checked source identities. The family token navigates to its type declaration; the case token navigates to the actual variant declaration. Imported/re-exported families and copied error-union layouts preserve the original case and field sources. Identical case or payload names in different variants/families do not merge. Case hover shows its value type, for example `Some: Choice`.

Constructor payload labels and explicit pattern labels, such as `{value:item}`, navigate to the declared payload field and participate in its references. The explicit `item` token declares a separate local binding. Reads and closure captures of that binding navigate to the pattern binding, respecting arm-local scope and shadowing.

A shorthand pattern such as `{value}` has two roles at one source token: a payload-field reference and a local binding declaration. Primary navigation and reference queries on that token select the local binding; reads point back to it. A reference query from the payload field also includes the shorthand token. The source metadata retains that secondary field role independently; collection deduplicates locations within each queried identity. Future rename must expand shorthand where needed to preserve the other role, rather than blindly replacing every reference token.

Builtin `TaskError`/`FaultKind` match cases and builtin payload labels provide checked type hover, but have no invented source declarations. Their pattern-bound locals still have ordinary source identities. Wildcards remain unmapped. Invalid, duplicate, non-exhaustive or otherwise failed graphs expose no partial editor identities. This adds source-tool metadata without changing matching, error handling or GPU capabilities.

The [enum/pattern qualification record](../../native/metal-proof/evidence/native-lsp-enum-tokens-2026-10-20.json) covers normal and ASan/UBSan semantic and protocol tests for case/field separation, explicit and shorthand bindings, closure captures, shadowing, error unions, builtins, imported enum origins, unsaved URI/range changes and failure isolation. Real-editor qualification and safe rename remain future work.

## Find references

[`textDocument/references`](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_references) returns source `Location` entries for the selected checked identity. It covers binding/parameter declarations and reads, nested closure captures, named function references, direct/pipeline calls, function-valued bindings, and record field declarations/reads. Shadowed bindings and fields with the same spelling remain distinct. Imported calls and function references resolve through aliases, re-exports and configured packages to their original declaration.

The search checks eligible discovered workspace sources, open roots within the selected workspace and its configured project entry, using current unsaved buffers. Without configured workspace discovery, it retains the open/project graph search. Each root includes its reachable dependencies. Identity across separately checked graphs uses the canonical original declaration path and byte span, not graph-local numeric IDs or name matching. Results are deduplicated and sorted by canonical path and source position; open documents retain their registered URI spelling. `context.includeDeclaration` is required and controls inclusion of the original declaration. A mapped but unused symbol returns an empty array when declaration inclusion is false.

This is a bounded semantic search with fresh workspace discovery, not a persistent workspace index. Eligible unopened importers in the selected root are searched; excluded paths and other workspace roots are outside its scope. Shorthand patterns still require edits that preserve both roles, so references alone are not sufficient for safe automated rename. Function-valued calls refer to the lexical binding, not every possible runtime target. Unmapped or invalid positions and failed query graphs return `null`, as for definition. If selection succeeds but any searched graph cannot load/check, the request fails with `RequestFailed` (-32803); no partial array is returned. Any erroneous eligible source in the search scope can prevent a search, even if unrelated to the selected symbol. Correct or exclude it from the scope before retrying.

Each graph is checked once during collection and its identifiers indexed once; the implementation does not recheck per token. Queries remain synchronous and uncached. Aggregate composed source scanning is capped at 64 MiB per request (shared dependencies count per root), and unique results at 100,000 locations. Exceeding either budget fails the request rather than truncating it. Existing per-graph compiler limits also apply. No files are modified.

The [references qualification record](../../native/metal-proof/evidence/native-lsp-references-2026-10-20.json) records normal and ASan/UBSan semantic/protocol tests, including declaration filtering, shadowing, nested captures, cross-file aliases/re-exports, deduplication, Unicode/CRLF, current unsaved destination positions, registered URIs and failure isolation. This does not qualify real-editor behavior or full-workspace coverage.

## Workspace source discovery

At initialization the server accepts at most 16 local directory roots from `workspaceFolders`, preferring a non-null array over `rootUri`. Empty folders explicitly disable discovery. If no non-null folder array is supplied, a non-null `rootUri` supplies one root. If both fields are absent and `--project` is configured, the explicit manifest's parent directory is the discovery root. Explicit null/no-folder settings suppress that project fallback. Without a root there is no implicit scan of the working directory or source ancestors. Directory URIs share the existing local/localhost, percent-decoding and canonicalization rules; invalid or inaccessible roots return invalid-params without completing initialization. Deprecated `rootPath` is not used.

The query document selects the most specific containing root. Only that root is discovered, and only open files/project entries inside it are added as roots. Other configured roots and open files outside it cannot contaminate that search. A query outside all configured roots searches only its own dependency graph. When no workspace roots are configured, open graphs and the optional project entry retain the previous search behavior. Diagnostics still recheck open buffers independently of reference discovery.

Discovery recursively lists regular `.k` files, with deterministic sorted results. It skips symlink files/directories (including broken links), and skips directories named `.git`, `.hg`, `.svn`, `node_modules`, `build`, `dist`, `target`, `.cache`, `.svelte-kit` or `.vercel`. These fixed exclusions apply to discovery, not explicitly open files or imports. There is no `.gitignore` interpretation or configurable exclusion glob yet. Explicit imports and package mappings can reach external dependencies; discovery does not crawl their directories or find reverse importers outside the selected workspace. These are search boundaries, not an import sandbox.

Each request rescans the root and reads current source graphs using open-buffer replacements. New/deleted files and disk edits are visible on the next search; closing a buffer restores its disk contents. No source files are written. There is no filesystem watcher, persistent index, debounce or point-in-time filesystem snapshot. Concurrent filesystem mutation is not a qualified atomic snapshot.

Discovery permits at most 512 source files, 20,000 visited directory entries and 32 nested directory levels per selected root; excluded directory entries and symlinks count toward the entry budget but are not traversed. Missing/unreadable directories, entry-inspection failures, unusable source paths and budget exhaustion fail the request with `RequestFailed`, without a partial array. Existing composed-source/graph/result limits apply after discovery. Every eligible candidate graph must load and check successfully; intentionally invalid fixtures should be outside the chosen root or an excluded directory.

The server advertises workspace-folder support with change notifications disabled. Restart it after changing workspace folders or project configuration. The [workspace qualification record](../../native/metal-proof/evidence/native-lsp-workspace-2026-10-20.json) covers normal and ASan/UBSan discovery/protocol tests: unopened callers, fresh disk changes, buffer precedence, URI preservation, root precedence/isolation, nested roots, project/package mappings, external dependencies, exclusions, symlinks, scan limits and failure recovery. These are protocol and filesystem tests, not real-editor or additional-platform qualification.

## Limits and qualification

Protocol headers are bounded to 8 KiB, frame bodies to 32 MiB and JSON nesting to 128 levels. Open buffers share the existing source budget (16 MiB including one separator byte per buffer) and file-count limit (128). Reachable module graphs have their own existing compiler limits. Each notification permits at most 1,024 changes. Transactional editing also has a 128 MiB work budget: charge the original buffer once, each replacement plus one unit, and the current buffer for each ranged edit. This bounds the initial simple scan/copy implementation; large edit batches may require full replacement or smaller notifications. Every intermediate buffer must fit the shared open-buffer byte budget. These are explicit bounds, not responsiveness guarantees. No source files are written.

Malformed JSON with valid framing returns a parse error and leaves the session usable. Invalid, duplicate, oversized or truncated framing ends the process with status 2 because a safe next message boundary is unavailable. A normal shutdown/exit returns 0; exit or EOF before shutdown returns 1. Standard output contains only protocol frames. Standard error is reserved for startup/fatal failures.

Independent Python-stdlib protocol tests launch normal and ASan/UBSan builds, exercise interactive pipe framing, lifecycle, versions, Unicode ranges/URIs, source isolation, dependency changes/clearing, project packages, budgets and malformed input. The [initial qualification record](../../native/metal-proof/evidence/native-lsp-2026-10-20.json) covers the first full-sync implementation. [Incremental edit qualification](../../native/metal-proof/evidence/native-lsp-edits-2026-10-20.json) adds sequential/mixed edits, Unicode scalar boundaries, CRLF/CR positions, line-end clamping, transactional failure, deprecated lengths and edit limits. Third-party LLVM libraries are not rebuilt with sanitizers. No real editor or additional operating system is qualified by these protocol tests.

Next: implement alias/shorthand-aware rename with collision and capture validation. Completion and formatter integration remain work. Filesystem watching, persistent workspace indexing, asynchronous scheduling and editor distribution remain separate work.
