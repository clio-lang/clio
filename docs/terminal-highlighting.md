# Terminal syntax highlighting

```sh
bun run cli highlight examples/modules/math.kalandra
bun run cli highlight examples/modules/math.kalandra --color always
bun run cli highlight examples/modules/math.kalandra --color never
```

Highlighting uses Kalandra's lexer to color keywords, strings, numbers, identifiers, punctuation and comments. It does not load imports, evaluate user code, or create files. Colors describe lexical tokens, not inferred types or symbol roles.

The default `--color auto` enables ANSI colors for terminal stdout, unless `NO_COLOR` is nonempty or `TERM` is `dumb`. Piped or redirected stdout receives plain source. Explicit `always` and `never` override automatic detection.

Whitespace, comments, Unicode, line endings and the presence or absence of a final newline are preserved. Removing the inserted ANSI color codes recovers the source text exactly. The command expects UTF-8 and rejects invalid encoding rather than silently replacing bytes.

Unreadable files, invalid options and lexer errors return a nonzero status. Diagnostics go to stderr, with no partial source written to stdout. This command does not parse or type-check: lexically valid incomplete syntax can be highlighted. Use `check` or `build` to validate a program.
