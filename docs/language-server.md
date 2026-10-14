# Editor diagnostics

The Kalandra language server provides live syntax, name-resolution and type diagnostics, plus go-to-definition, find-references, rename, type hover and completion for open buffers. It uses the compiler’s `analyze` and `analyzeProject` APIs. Open buffers override disk contents; the stdio host reads reachable local imports and discovers workspace sources for references and rename. Analysis never executes source or imported packages.

## Running it

Configure an editor's LSP client with:

- Command: the absolute path to `bun`.
- Arguments: the absolute path to `packages/language-server/src/stdio.ts` in this checkout.
- Language/filetype: `kalandra`, associated with `.kalandra` files during the port.
- Optional initialization options: `{ "strictNames": true }` to turn unresolved-name warnings into errors. The default matches the CLI's gradual name checking. Add `"sourceExcludes": ["archive/**", "**/*.test.kalandra"]` to narrow workspace discovery.

After `bun run build:packages`, use `dist/language-server/stdio.js` instead. The built server bundles its dependencies and is verified outside the workspace. The source server requires the installed workspace dependencies. `bun run lsp` is a convenient terminal entry point; an editor should launch Bun directly as described above.

The server communicates only through LSP messages on stdin/stdout. It is not an interactive terminal program. Shutdown and exit follow the standard LSP lifecycle; stdout is reserved for protocol traffic.

## Behavior

The server implements initialization, open/change/close synchronization, push diagnostics, shutdown and exit using the installed `vscode-languageserver` implementation. It advertises incremental synchronization and UTF-16 positions. Full-document changes are also accepted. Compiler offsets are converted through `vscode-languageserver-textdocument`, including CRLF and astral Unicode.

Each published diagnostic preserves its compiler code, message and severity, adds `source: "kalandra"`, and includes an editor range. Open/change reports include the document version. Stale or duplicate versions and changes to unopened documents are ignored. Closing a document clears its diagnostics and releases its buffer. An untitled document works without a saved path.

The portable package entry exports `documentDiagnostics`, `DocumentStore`, and `WorkspaceDocuments`; importing that entry does not start a server. `WorkspaceDocuments` accepts a URI/read host and a diagnostics publisher. `stdio.ts` is the executable host adapter.

## Go to definition

The server advertises `definitionProvider` and handles `textDocument/definition`. Local references resolve through semantic symbol identities, so parameters, nested scopes and shadowed names point to their own declarations. Functions and types select their name tokens; quick-function parameters select their first bound occurrence.

Named local imports follow aliases and re-exports to the original declaration. Namespace members, including re-exported namespaces, follow the compiler's resolved import graph. Selecting a namespace itself goes to the target module's start. Target positions come from the current unsaved buffers when open, otherwise the disk source used in the analysis. The project API now retains semantic models and resolved dependency edges in `result.modules`, including syntactically valid modules with semantic errors.

External JavaScript packages, builtins, unresolved references, arbitrary object fields and mixed wildcard-rest copies do not produce guessed targets. Syntactically broken modules may have no model to navigate. Definition requests analyze a fresh buffer snapshot; edits overtaking a disk read discard the old result, and cancelled requests return no location. No source is executed.

## Find references

The server advertises `referencesProvider` and handles `textDocument/references`. It follows the same semantic identities as definition lookup, including lexical shadowing, parameters, local import aliases, re-exports and namespace member chains. Matching spelling in strings, comments and arbitrary object fields does not count as a reference.

A request discovers eligible `.kalandra` files under the selected source root within a configured workspace, then analyzes those files, open buffers and their reachable local dependencies using captured unsaved overlays and cached disk reads. This includes unopened importers when querying an exported declaration. Discovery is refreshed for each request, so newly created and deleted files are reflected without a filesystem watcher. Untitled buffers are searched individually, and separate source roots remain isolated. Hosts without discovery and files outside configured roots retain open-graph behavior.

Results contain deduplicated UTF-16 token ranges. `includeDeclaration` includes the original declaration and explicit import aliases; imported source names and re-export expressions are references. A quick-function parameter's first occurrence serves as its implicit declaration. Namespace imports share their target module identity but do not invent a declaration token at the module start. External packages, unknown names and mixed wildcard-rest copies have no guessed references. Requests overtaken by edits or cancellation return an empty list.

Definition, reference and hover ranges now distinguish every function and quick-function parameter, including parameters beyond the first.

## Rename

The server advertises `renameProvider.prepareProvider` and implements `textDocument/prepareRename` and `textDocument/rename`. Prepare returns the editable name range and placeholder; unsupported targets return null. Rename returns a proposed workspace edit and never writes files or changes open buffers itself.

Supported names include local variables, function/type declarations, ordinary and quick-function parameters, annotations, decorator names, and explicit import/namespace aliases. Quick-parameter and decorator edits preserve the `@` prefix. Renaming an export follows unaliased imports, re-exports and namespace members. Explicit aliases stay independent: renaming `answer` changes `answer as local` to `result as local`, while renaming `local` leaves the original export untouched. Implicit namespace names, unaliased external imports, builtins, unresolved names and arbitrary record/object properties are unsupported.

**Search scope includes discovered workspace sources, open buffers, and their reachable dependencies.** Unopened importers inside that source policy participate in edits and collision checks. Files outside it are not guaranteed to be updated; see the discovery exclusions below. Untitled buffers are handled individually. Existing analysis errors anywhere in the searched sources block rename.

New names must be single identifiers, excluding reserved keywords. The server reanalyzes all proposed source changes and rejects declaration/import/type conflicts, captured references and formerly unresolved names that would acquire a binding. Unrelated sibling declarations remain allowed. Reanalysis performs no code execution and does not guarantee backend build success.

Clients supporting `workspace.workspaceEdit.documentChanges` receive versioned edits for open buffers and null versions for disk files. Other clients receive plain `changes` without version guards. Stale or cancelled requests return no edit; conflicts return an LSP error explaining the rejection. Disk changes after the snapshot still require client-side review. No file or module-path renaming is performed.

## Type hover

The server advertises `hoverProvider` and returns plain-text type information with a UTF-16 range for the selected name or member. It uses the compiler's inferred types and annotations, without introducing separate editor inference rules. Variables, parameters, function/type declaration names, import aliases, namespace members, and known record fields are supported.

Examples include `value: Number`, `items: Array<Number>`, `echo: fn (String) -> String`, and `wait: async fn (Number) -> Number`. The `async` marker describes an async function; its displayed return component is the compiler's signature type, not an additional Promise wrapper invented by hover. Type values display as `Type<Box>` and gradual unknowns remain `Any`. Deep nested type descriptions are abbreviated.

Hover and definition lookup share the same snapshot analysis. Unsaved dependency signatures are reflected, and obsolete or cancelled requests return no result. Whitespace, comments, strings, and syntactically invalid modules have no name hover. Documentation comments, overload presentation, runtime inspection remain future work.

## Completion

The server handles `textDocument/completion`, with `.` as a trigger character. Suggestions include lexical names with shadowing, function parameters, hoisted functions/types, local namespace exports and known record fields. Each item carries the compiler's type or signature and a UTF-16 text edit replacing the whole identifier at the cursor. Later variables in the immediate scope and sibling-scope names are excluded. Quick-function parameter suggestions stay within their own function context.

A temporary analysis snapshot replaces only the cursor word with a unique identifier. This supports partial names, blank expression positions and trailing dots without changing the stored document or publishing recovery diagnostics. Unsaved dependency signatures are included; stale and cancelled requests return no items. Comments and literal text suppress completion, while formatted-string interpolations remain code.

Dynamic `Any` members are not invented. This first implementation has no auto-imports, snippets or keyword suggestions, and unrelated syntax errors can prevent completion. It uses the same full-snapshot compiler analysis as hover and definition.

## Workspace source discovery

The file host recursively lists `.kalandra` files under the selected source root only when that root is contained in a folder supplied through `workspaceFolders` or `rootUri`. With a manifest, discovery starts at `build.source`, so files elsewhere in the project do not enter references or rename. It skips dot-prefixed files/directories, `node_modules`, `dist`, `build`, `coverage`, symlink entries, separately configured nested workspace roots, and directories with their own `kalandra.toml` (including unsaved or invalid manifests). These default exclusions always apply. Additional exclusions come from the `sourceExcludes` initialization option; `.gitignore` and editor exclusion settings are not interpreted. Explicitly opened files and reachable imports still participate even when excluded from discovery; explicit imports still follow compiler resolution rules and can reach a dependency excluded from discovery.

Discovery is on demand for references, prepare-rename and rename. Hover, completion, definition and push diagnostics retain their existing open-buffer behavior. Discovery does not publish diagnostics for every scanned file. The portable `WorkspaceHost` can implement optional `listSources(root, overlays)`; hosts without it continue to search open graphs.

A scan allows at most 50,000 directory entries and 64 directory levels. Enumeration failures or exceeded limits return an explicit request error instead of a partial result; choose a narrower workspace root in that case. Files outside configured roots are never recursively scanned using their fallback parent directory. Scans overtaken by buffer changes are discarded.

`sourceExcludes` is an array of up to 100 source-root-relative, case-sensitive patterns (at most 512 characters each). `*` matches within a segment, `?` matches one character, and a whole-segment `**` matches any depth, including zero directories in `**/*.test.kalandra`. A matching directory prunes its subtree: use `archive` or `archive/**`. Absolute paths, parent/empty segments, trailing slashes, backslashes, negation, brace expansion and character classes are rejected during initialization. Settings stay fixed until restart.

References and rename retain up to 32 recently used compiler graphs across requests in an in-memory index. Each request still discovers files and reads current sources, comparing all cached inputs—including missing imports—before reuse. Graphs using JavaScript package resolution are analyzed afresh so metadata and package availability cannot remain stale. Unchanged Clio-only graphs reuse their semantic models; changing any input rebuilds that entry and its dependency graph. Installed Kalandra package manifests are read and validated as graph inputs too, so changing `build.source` invalidates cached resolution. The Bun file host supplies the TOML parser; portable hosts can supply `parseKalandraManifest`. Manifests are captured separately for rename validation and are never renamed as source. Buffer overlays are validated the same way, while read results are shared within a request. Disposal clears the index and prevents in-flight work from repopulating it. Rename still separately reanalyzes its proposed edits.

This cache persists for the server session, not across restarts. It saves compiler analysis, not discovery or disk reads, and is not an incremental compiler or a persistent on-disk index. Filesystem watchers and finer-grained invalidation remain future work. Very large workspaces should use narrower roots and exclusions. Discovery follows configured lexical paths; symlink aliases are not canonicalized.

## Scope and evidence

File-backed `.kalandra` buffers use project analysis: local imports share export signatures, unsaved new files can satisfy imports, and errors in disk dependencies are published at their own URIs. Every accepted buffer change rechecks all open graphs. Reports from superseded generations are discarded. Shared dependency diagnostics are deduplicated, and errors for dependencies no longer referenced are cleared. Closing a buffer removes its overlay and rechecks importers using the disk version.

For file buffers, the nearest enclosing `kalandra.toml` supplies `[build].source`, using the same discovery and validation code as CLI `build`/`run`. Discovery starts at the source file and searches ancestors, independent of the editor's working directory. The nearest manifest wins; an invalid manifest or a file outside its configured source directory reports `KAL4301` on the affected Clio buffer and blocks navigation/rename instead of falling back to another project.

With no enclosing manifest, the closest containing workspace folder remains the source root; `rootUri` is used when workspace folders are absent. Files outside those roots use their own directory as root. This preserves the editor's existing manifest-free workspace behavior (the CLI uses the entry's directory). A manifest source root outside configured workspace folders can serve open graphs but is not recursively scanned. Untitled and non-file buffers retain single-file analysis. Root-relative imports, missing files and cycles follow the compiler's existing project rules. File URIs containing spaces are supported. File-path aliases and symlink aliases are not unified as editor documents.

Open `kalandra.toml` buffers are configuration overlays, not Clio source code. Their unsaved edits affect project discovery and package parsing; closing them restores disk configuration. Root discovery is repeated for each analysis, so changing, creating, or deleting a manifest changes the selected graph and clears obsolete diagnostics. Definitions, hover, completion, references and rename use that graph. Portable hosts may return a synchronous or asynchronous location from `locate(uri, overlays)`, expose `isConfiguration(uri)`, and receive URI/text overlays in `listSources`; filesystem/TOML discovery remains confined to the Bun file host.

Save notifications and client-supplied watched-file notifications trigger fresh reads, including project and package manifests. The server does not install filesystem watchers or update its root list after initialization; clients that do not send those notifications see disk changes on the next buffer edit. Diagnostics for open files carry versions; diagnostics for disk dependencies do not.

Project analysis stops before lowering, task extraction and code generation. It is not equivalent to a successful `build`. Runtime/emission limitations such as unsupported membership are not editor errors unless the analysis phase also rejects them. It discovers explicit [JavaScript package declarations](javascript-types.md), including JSON configuration overlays. It exposes [Format Document](formatter.md) using the shared formatter on unsaved buffers, returning a whole-document edit with fixed CLI style and no disk writes. Invalid or unchanged source returns no edits. It does not yet infer TypeScript declarations or support dynamic settings changes. Large-document scheduling and incremental compiler analysis remain future work; the document edits are incremental, but each analysis runs on the full current text.

Tests exercise unsaved buffers, syntax and type errors, error clearing, UTF-16/CRLF edits, stale versions, URI isolation, strict-name behavior, and the real stdio process. The isolated build check launches the bundled server without workspace dependencies and verifies initialization, Unicode framing, diagnostics, incremental repair, unsaved dependency signatures, disk fallback on close, definition, reference, prepare-rename, rename, hover, completion and document formatting requests, and graceful shutdown. Completion tests cover lexical visibility, record members, trailing-dot recovery, quick parameters, interpolation, unsaved exports and whole-word edits. Rename tests cover alias preservation, import propagation, shadowing, capture rejection, decorators, annotations, Unicode ranges and both edit representations. Discovery tests cover unopened importers, unsaved overlays, new/deleted files, exclusions, nested roots, scan failures and limits, stale scans, and unopened-file collision rejection. Both source and bundled stdio tests exercise configured exclusions, discovered references and rename edits. Index tests verify actual graph reuse, transitive edits, missing/deleted dependencies, root isolation, eviction and disposal; integration checks catch disk edits without notifications. Tests also cover stale asynchronous reads and root discovery, manifest source-root changes, unsaved configuration, invalid configuration, manifest deletion, nested project isolation, package navigation/rename, workspace-root selection, and dependency-error cleanup. Source and bundled stdio checks verify that a watched manifest change redirects definition lookup to the new source root. Integration in a particular editor extension remains unverified.

Protocol reference: [Language Server Protocol 3.17](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/).
