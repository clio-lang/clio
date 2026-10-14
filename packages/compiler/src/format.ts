import type { Diagnostic, SourceFile } from "./index.js";
import { parse } from "./syntax/parse.js";
import { tokenize } from "./syntax/lexer.js";

export interface FormatResult {
  readonly diagnostics: readonly Diagnostic[];
  readonly text?: string;
}

const structure = (program: unknown) =>
  JSON.stringify(program, (key, value) => (key === "span" ? undefined : value));
const operators = new Set([
  "Plus",
  "Minus",
  "Star",
  "Slash",
  "Percent",
  "Power",
  "Equal",
  "GreaterEqual",
  "LessEqual",
  "Greater",
  "Less",
  "Assign",
  "Arrow",
  "FatArrow",
  "And",
  "Or",
  "By",
  "In",
  "Is",
]);
const opens = new Set(["LParen", "LSquare", "SliceStart", "LCurly"]);
const closes = new Set(["RParen", "RSquare", "RCurly"]);

/** Preserve source tokens, comments, and line breaks; verify every proposed layout with the parser. */
export function formatSource(source: SourceFile): FormatResult {
  const parsed = parse(source);
  if (!parsed.program) return { diagnostics: parsed.diagnostics };
  const lexed = tokenize(source);
  const protectedRanges: { start: number; end: number; name: string }[] = [];
  const layout = new Map<number, { original: number; indent: number }>();
  let depth = 0,
    brackets = 0,
    logicalLine = true;
  let formatStart: number | undefined;
  let formatDepth = 0;
  for (const token of lexed.tokens) {
    const name = token.tokenType.name;
    if (name === "Indent") {
      depth++;
      continue;
    }
    if (name === "Dedent") {
      depth--;
      continue;
    }
    if (name === "Newline") {
      logicalLine = true;
      continue;
    }
    if (name === "FormatStart") {
      if (formatDepth++ === 0) formatStart = token.startOffset;
    }
    if (formatDepth > 0) {
      if (name === "FormatEnd" && --formatDepth === 0) {
        protectedRanges.push({
          start: formatStart!,
          end: token.endOffset! + 1,
          name: "StringLiteral",
        });
        formatStart = undefined;
      }
      continue;
    }
    if (!layout.has(token.startLine!)) {
      const continuation =
        !logicalLine && brackets === 0 && layout.size > 0 ? 1 : 0;
      layout.set(token.startLine!, {
        original: token.startColumn! - 1,
        indent:
          Math.max(
            0,
            depth + brackets - (closes.has(name) ? 1 : 0) + continuation,
          ) * 2,
      });
    }
    logicalLine = false;
    if (opens.has(name)) brackets++;
    if (closes.has(name)) brackets--;
    protectedRanges.push({
      start: token.startOffset,
      end: token.endOffset! + 1,
      name,
    });
  }
  // Comments are opaque: keep their exact contents, including intentional trailing spaces.
  for (const comment of lexed.comments) {
    if (
      !protectedRanges.some(
        (range) =>
          range.start <= comment.span.start && range.end >= comment.span.end,
      )
    )
      protectedRanges.push({ ...comment.span, name: "Comment" });
  }
  protectedRanges.sort((a, b) => a.start - b.start);
  const lines = source.text.split("\n");
  const starts: number[] = [];
  let offset = 0;
  for (const line of lines) {
    starts.push(offset);
    offset += line.length + 1;
  }
  const desired = new Map<number, number>();
  for (const [line, info] of layout) desired.set(line, info.indent);
  // A comment-only line follows the nearest code line at the same original indentation.
  for (let index = 0; index < lines.length; index++) {
    if (!/^ *--/.test(lines[index]!)) continue;
    const width = /^ */.exec(lines[index]!)![0].length;
    let distance = Infinity,
      indent = width;
    for (const [line, info] of layout) {
      if (info.original === width && Math.abs(line - index - 1) < distance) {
        distance = Math.abs(line - index - 1);
        indent = info.indent;
      }
    }
    desired.set(index + 1, indent);
  }
  const lineAt = (position: number) => {
    let low = 0,
      high = starts.length;
    while (low + 1 < high) {
      const mid = (low + high) >>> 1;
      if (starts[mid]! <= position) low = mid;
      else high = mid;
    }
    return low + 1;
  };
  function candidate(styled: boolean) {
    let text = "",
      cursor = 0;
    let previous: (typeof protectedRanges)[number] | undefined;
    for (const range of protectedRanges) {
      const gap = source.text.slice(cursor, range.start);
      if (/[\r\n]/.test(gap)) {
        const normalized = gap.replace(/ *\r?\n/g, "\n");
        const last = normalized.lastIndexOf("\n");
        text += normalized.slice(0, last + 1);
        text += styled
          ? " ".repeat(
              desired.get(lineAt(range.start)) ??
                normalized.slice(last + 1).length,
            )
          : normalized.slice(last + 1);
      } else if (!previous) {
        text += styled
          ? " ".repeat(desired.get(lineAt(range.start)) ?? 0)
          : gap;
      } else if (range.name === "Comment") {
        text += "  ";
      } else if (
        styled &&
        (operators.has(previous.name) || operators.has(range.name))
      ) {
        text += " ";
      } else if (styled && range.name === "Colon") {
        // A colon attaches to its key/header; the parser guard handles keyword adjacency.
      } else if (styled && previous.name === "Colon") {
        text += " ";
      } else text += gap.length ? " " : "";
      text += source.text.slice(range.start, range.end);
      cursor = range.end;
      previous = range;
    }
    // Only discard trailing whitespace outside tokens. Literal/comment text stays byte-for-byte intact.
    return text + (text ? "\n" : "");
  }
  const original = structure(parsed.program);
  for (const styled of [true, false]) {
    const text = candidate(styled);
    const checked = parse({ ...source, text });
    if (checked.program && structure(checked.program) === original)
      return { text, diagnostics: [] };
  }
  return {
    diagnostics: [
      {
        code: "KAL4401",
        severity: "error",
        message:
          "Cannot format this source without changing its parsed structure",
        span: { file: source.path, start: 0, end: 0 },
      },
    ],
  };
}
