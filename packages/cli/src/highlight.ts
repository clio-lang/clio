import { tokenize, type SourceFile } from "@kalandra/compiler";

const keywords = new Set([
  "Fn",
  "If",
  "Else",
  "Await",
  "AwaitAll",
  "Import",
  "From",
  "As",
  "Export",
  "Type",
  "List",
  "Is",
  "And",
  "Or",
  "Not",
  "By",
  "In",
]);
const strings = new Set([
  "StringLiteral",
  "FormatStart",
  "FormatText",
  "FormatEnd",
]);
const virtual = new Set(["Indent", "Dedent", "Newline"]);

/** Insert ANSI colors at lexer spans; all source gaps and line endings stay intact. */
export function highlightSource(source: SourceFile, color: boolean) {
  const result = tokenize(source);
  if (result.diagnostics.length) return { diagnostics: result.diagnostics };
  if (!color) return { diagnostics: result.diagnostics, text: source.text };
  const spans = result.tokens.flatMap((token) => {
    const name = token.tokenType.name;
    const start = token.startOffset,
      end = token.endOffset! + 1;
    if (
      virtual.has(name) ||
      !Number.isFinite(start) ||
      end <= start ||
      source.text.slice(start, end) !== token.image
    )
      return [];
    const code = keywords.has(name)
      ? 35
      : strings.has(name)
        ? 32
        : name === "NumberLiteral"
          ? 33
          : name === "Identifier"
            ? 34
            : 36;
    return [{ start, end, code }];
  });
  for (const comment of result.comments)
    spans.push({ start: comment.span.start, end: comment.span.end, code: 90 });
  spans.sort((a, b) => a.start - b.start || a.end - b.end);
  let cursor = 0,
    text = "";
  for (const span of spans) {
    if (span.start < cursor) continue;
    text +=
      source.text.slice(cursor, span.start) +
      `\x1b[${span.code}m` +
      source.text.slice(span.start, span.end) +
      "\x1b[0m";
    cursor = span.end;
  }
  return {
    diagnostics: result.diagnostics,
    text: text + source.text.slice(cursor),
  };
}

export function useHighlightColor(
  mode: "auto" | "always" | "never",
  tty: boolean,
  env: Readonly<Record<string, string | undefined>>,
) {
  return (
    mode === "always" ||
    (mode === "auto" && tty && !env.NO_COLOR && env.TERM !== "dumb")
  );
}

export async function highlightFile(file: string, args: string[]) {
  let mode: "auto" | "always" | "never" = "auto";
  if (args.length) {
    if (
      args.length !== 2 ||
      args[0] !== "--color" ||
      !["auto", "always", "never"].includes(args[1]!)
    ) {
      console.error(
        "Usage: kalandra highlight <file.kalandra> [--color auto|always|never]",
      );
      process.exitCode = 1;
      return;
    }
    mode = args[1] as typeof mode;
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      await Bun.file(file).arrayBuffer(),
    );
  } catch {
    console.error(`Cannot read source file as UTF-8: ${file}`);
    process.exitCode = 1;
    return;
  }
  const result = highlightSource(
    { path: file, text },
    useHighlightColor(mode, !!process.stdout.isTTY, process.env),
  );
  if (result.text === undefined) {
    for (const diagnostic of result.diagnostics) {
      const offset = diagnostic.span?.start ?? 0,
        prefix = text.slice(0, offset);
      console.error(
        `${file}:${prefix.split("\n").length}:${offset - prefix.lastIndexOf("\n")} ${diagnostic.code}: ${diagnostic.message}`,
      );
    }
    process.exitCode = 1;
    return;
  }
  process.stdout.write(result.text);
}
