import {
  createTokenInstance,
  Lexer,
  type IToken,
  type TokenType,
} from "chevrotain";
import type { Diagnostic, SourceFile, SourceSpan } from "../index.js";
import * as T from "./tokens.js";

const lexer = new Lexer(T.physicalTokens);
export interface SourceComment {
  readonly text: string;
  readonly span: SourceSpan;
}
export interface TokenizeResult {
  readonly tokens: IToken[];
  readonly comments: SourceComment[];
  readonly diagnostics: Diagnostic[];
}

/** Chevrotain lexing followed by Clio's indentation and adjacency rules. */
export function tokenize(source: SourceFile): TokenizeResult {
  const diagnostics: Diagnostic[] = [];
  const comments: SourceComment[] = [];
  const lineStarts = [0];
  for (let i = 0; i < source.text.length; i++)
    if (source.text[i] === "\n") lineStarts.push(i + 1);
  const position = (offset: number) => {
    let lo = 0,
      hi = lineStarts.length;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >>> 1;
      if (lineStarts[mid]! <= offset) lo = mid;
      else hi = mid;
    }
    return { line: lo + 1, column: offset - lineStarts[lo]! + 1 };
  };
  const make = (
    type: TokenType,
    start: number,
    end = start,
    image = source.text.slice(start, end),
  ) => {
    const a = position(start),
      b = position(Math.max(start, end - 1));
    return createTokenInstance(
      type,
      image,
      start,
      end - 1,
      a.line,
      b.line,
      a.column,
      b.column,
    );
  };
  const report = (
    code: string,
    message: string,
    start: number,
    end = start + 1,
  ) =>
    diagnostics.push({
      code,
      severity: "error",
      message,
      span: {
        file: source.path,
        start,
        end: Math.min(source.text.length, end),
      },
    });

  function lexSegment(
    text: string,
    base: number,
    interpolation = false,
  ): IToken[] {
    const result = lexer.tokenize(text);
    for (const error of result.errors)
      report(
        "KAL1001",
        `Unsupported character ${text[error.offset] ?? ""}`,
        base + error.offset,
        base + error.offset + error.length,
      );
    for (const comment of result.groups.comments ?? [])
      comments.push({
        text: comment.image,
        span: {
          file: source.path,
          start: base + comment.startOffset,
          end: base + comment.endOffset! + 1,
        },
      });
    const tokens = result.tokens.map((item) =>
      make(
        item.tokenType,
        base + item.startOffset,
        base + item.endOffset! + 1,
        item.image,
      ),
    );
    const expanded: IToken[] = [];
    for (const item of tokens) {
      const previous = expanded.at(-1);
      if (
        item.tokenType === T.StringLiteral &&
        previous &&
        previous.endOffset! + 1 === item.startOffset &&
        [T.Identifier, T.RSquare].includes(previous.tokenType)
      ) {
        expanded.push(
          make(T.FormatStart, item.startOffset, item.startOffset + 1),
        );
        const end = item.endOffset!;
        let cursor = item.startOffset + 1,
          start = cursor;
        while (cursor < end) {
          if (source.text[cursor] === "\\") {
            cursor += 2;
            continue;
          }
          if (source.text[cursor] !== "{") {
            cursor++;
            continue;
          }
          if (cursor > start) expanded.push(make(T.FormatText, start, cursor));
          expanded.push(make(T.InterpolationStart, cursor, cursor + 1));
          let depth = 1,
            close = cursor + 1;
          while (close < end && depth > 0) {
            if (source.text[close] === "\\") {
              close += 2;
              continue;
            }
            if (source.text[close] === "{") depth++;
            if (source.text[close] === "}") depth--;
            if (depth > 0) close++;
          }
          if (depth > 0) {
            report("KAL1005", "Unclosed string interpolation", cursor, end);
            cursor = end;
            start = end;
            break;
          }
          expanded.push(
            ...lexSegment(
              source.text.slice(cursor + 1, close),
              cursor + 1,
              true,
            ),
          );
          expanded.push(make(T.InterpolationEnd, close, close + 1));
          cursor = close + 1;
          start = cursor;
        }
        if (start < end) expanded.push(make(T.FormatText, start, end));
        expanded.push(make(T.FormatEnd, end, end + 1));
      } else if (
        item.tokenType === T.LSquare &&
        previous &&
        previous.endOffset! + 1 === item.startOffset &&
        [T.Identifier, T.Parameter, T.RSquare].includes(previous.tokenType)
      ) {
        expanded.push(
          make(T.SliceStart, item.startOffset, item.endOffset! + 1),
        );
      } else expanded.push(item);
    }
    return interpolation
      ? expanded.filter((item) => item.tokenType !== T.Newline)
      : expanded;
  }

  const raw = lexSegment(source.text, 0);
  const output: IToken[] = [];
  const levels = [0];
  const delimiters: IToken[] = [];
  const opens = new Map<TokenType, TokenType>([
    [T.LParen, T.RParen],
    [T.LSquare, T.RSquare],
    [T.SliceStart, T.RSquare],
    [T.LCurly, T.RCurly],
    [T.InterpolationStart, T.InterpolationEnd],
  ]);
  const closes = new Set(opens.values());
  const continuation = new Set([
    T.Plus,
    T.Minus,
    T.Star,
    T.Slash,
    T.Percent,
    T.Power,
    T.Assign,
    T.Equal,
    T.Arrow,
    T.FatArrow,
    T.And,
    T.Or,
  ]);
  const trailingOperator = new Set([
    T.Plus,
    T.Minus,
    T.Star,
    T.Slash,
    T.Percent,
    T.Power,
  ]);
  let pendingNewline: IToken | undefined;
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i]!;
    if (item.tokenType === T.Newline) {
      if (!delimiters.length) pendingNewline ??= item;
      continue;
    }
    if (pendingNewline && !delimiters.length) {
      const level = item.startColumn! - 1;
      const current = levels.at(-1)!;
      const continued =
        (level >= current && continuation.has(item.tokenType)) ||
        trailingOperator.has(output.at(-1)?.tokenType!);
      if (!continued) {
        output.push(pendingNewline);
        if (level > current) {
          levels.push(level);
          output.push(make(T.Indent, item.startOffset));
        } else if (level < current) {
          if (!levels.includes(level))
            report(
              "KAL1002",
              "Inconsistent indentation",
              item.startOffset,
              item.startOffset + item.image.length,
            );
          while (levels.length > 1 && levels.at(-1)! > level) {
            levels.pop();
            output.push(make(T.Dedent, item.startOffset));
          }
        }
      }
      pendingNewline = undefined;
    }
    if (opens.has(item.tokenType)) delimiters.push(item);
    else if (closes.has(item.tokenType)) {
      const opener = delimiters.at(-1);
      if (!opener || opens.get(opener.tokenType) !== item.tokenType)
        report(
          "KAL1003",
          `Unmatched closing delimiter ${item.image}`,
          item.startOffset,
        );
      else delimiters.pop();
    }
    output.push(item);
    // Clio's '# key:\n ...' shorthand starts a map two columns deeper.
    if (
      item.tokenType === T.Hash &&
      raw[i + 1]?.tokenType === T.Identifier &&
      raw[i + 2]?.tokenType === T.Colon &&
      raw[i + 3]?.tokenType === T.Newline &&
      !delimiters.length
    ) {
      levels.push(levels.at(-1)! + 2);
      output.push(make(T.Indent, item.endOffset! + 1));
    }
  }
  for (const opener of delimiters)
    report("KAL1004", `Unclosed delimiter ${opener.image}`, opener.startOffset);
  const eof = source.text.length;
  if (output.length) output.push(pendingNewline ?? make(T.Newline, eof));
  while (levels.length > 1) {
    levels.pop();
    output.push(make(T.Dedent, eof));
  }
  return { tokens: output, comments, diagnostics };
}
