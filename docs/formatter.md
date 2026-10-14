# Formatting Kalandra source

```sh
bun run cli fmt path/to/main.kalandra
bun run cli fmt path/to/main.kalandra --check
bun run cli fmt path/to/main.kalandra --write
```

The default command prints formatted source to stdout and leaves the file unchanged. `--check` writes nothing and exits 1 if formatting is needed, or 0 if the file already matches. `--write` explicitly replaces the file with verified formatted source. Syntax errors fail all modes and leave files unchanged. The initial command accepts one file; recursive/glob discovery and stdin input are not implemented.

## Style and preservation

The formatter normalizes ordinary horizontal whitespace, spaces around operators, colon spacing, and two-space block/continuation indentation where those changes preserve the parsed program. It removes whitespace from blank lines and trailing code whitespace, normalizes line endings outside literals to LF, and ends a nonempty formatted file with one newline. An empty or whitespace-only file becomes empty.

Existing statement and multiline-expression line breaks are retained. Interior blank lines remain in place; trailing blank lines are removed. This version does not wrap long lines, reorder declarations/imports, or rewrite expressions. It preserves adjacency where it can distinguish calls, indexing, formatted strings, and negative literals. Delimiter spacing is conservative rather than a complete AST reprint.

Comments keep their exact text, order and placement relative to code. Comment-only indentation follows nearby code with matching original indentation where available; inline comments are separated from code by two spaces. Intentional spaces inside comment text, including at its end, remain intact. String literals and whole formatted strings—including interpolation source, escapes and literal line endings—are preserved byte-for-byte.

Clio has unusual indentation and adjacency rules. Each formatted candidate is reparsed and compared with the original AST, ignoring source spans only. Literal representations and comment text participate in that comparison. If the styled layout changes the AST, the formatter tries a conservative layout that preserves original indentation and adjacency while normalizing existing horizontal gaps and outside-literal line endings. If that also changes the AST, it returns `KAL4401` with no formatted output. It does not silently repair invalid syntax or change deferred language semantics.

## API and writes

The portable compiler exports `formatSource({ path, text })`, returning `{ diagnostics, text? }`. Formatting performs syntax validation, not name/type checking or compilation. Valid source using runtime/backend features that are still deferred can still be formatted.

CLI writes use a temporary file beside the resolved target, retain its permission bits, and atomically rename the formatted file into place after checking that its content has not changed since reading. Symlink paths update the target while leaving the symlink intact. The operation is one file at a time, not a project-wide transaction.

## Editor formatting

The language server advertises Format Document (`textDocument/formatting`) and formats the current open, unsaved buffer using the same portable formatter. It returns one whole-document edit with UTF-16 positions; the editor applies it. The server does not write to disk or change its buffer until the editor sends a document change.

Invalid or already formatted source, unknown documents, and configuration documents return no edits. Requests superseded by a buffer change, close/reopen, or server disposal before formatting starts are discarded. Cancellation is checked before and after the request. Parsing and formatting are synchronous; they cannot be interrupted midway, and the server cannot retract edits already delivered to the client.

Style is fixed to the CLI rules above, including two-space indentation and LF outside literals. Client formatting options such as tab size do not override it. Range formatting and format-on-type are not implemented.

## Verification

Tests format all 177 accepted pinned Clio fixtures, compare ASTs with source spans removed, and verify idempotence. Focused tests cover comments, CRLF, multiline strings and collections, formatted-string interpolation preservation, negative literals, indexing versus calls, nested and same-indent bodies, empty files, and syntax errors. CLI tests cover stdout/check/write behavior, unchanged invalid files, permissions, symlinks, invalid options, and the isolated built CLI.

Language-server tests cover unsaved buffers, whole-document Unicode/CRLF ranges, unchanged and invalid source, configuration documents, stale snapshots, and buffer isolation. Source and isolated bundled stdio checks verify the advertised capability, edits, repeated requests, editor-applied changes, and unchanged disk contents.
