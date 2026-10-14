import { tokenize } from "../packages/compiler/src/syntax/lexer.js";

const keywords = new Set(
  "Fn If Else Await AwaitAll Import From As Export Type List Is And Or Not By In".split(
    " ",
  ),
);
const strings = new Set([
  "StringLiteral",
  "FormatStart",
  "FormatText",
  "FormatEnd",
]);
const virtual = new Set(["Indent", "Dedent", "Newline"]);
const colors = {
  keyword: ["#cf222e", "#ff7b72"],
  string: ["#0a3069", "#a5d6ff"],
  number: ["#0550ae", "#79c0ff"],
  identifier: ["#6639ba", "#d2a8ff"],
  punctuation: ["#24292f", "#c9d1d9"],
  comment: ["#57606a", "#8b949e"],
} as const;
export function escapeCode(text: string) {
  return text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
/** Decode one layer only: source text such as '&lt;' must remain literal. */
export function decodeCode(text: string) {
  return text.replace(
    /&(amp|lt|gt|quot|#39);/g,
    (_, entity: string) =>
      ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" })[entity]!,
  );
}
export function highlightKalandra(text: string) {
  const result = tokenize({ path: "documentation.kalandra", text });
  const spans = result.tokens.flatMap((token) => {
    const name = token.tokenType.name;
    const start = token.startOffset,
      end = token.endOffset! + 1;
    if (
      virtual.has(name) ||
      !Number.isFinite(start) ||
      end <= start ||
      text.slice(start, end) !== token.image
    )
      return [];
    const kind = keywords.has(name)
      ? "keyword"
      : strings.has(name)
        ? "string"
        : name === "NumberLiteral"
          ? "number"
          : name === "Identifier"
            ? "identifier"
            : "punctuation";
    return [{ start, end, kind: kind as keyof typeof colors }];
  });
  for (const comment of result.comments)
    spans.push({
      start: comment.span.start,
      end: comment.span.end,
      kind: "comment",
    });
  spans.sort((a, b) => a.start - b.start || a.end - b.end);
  let cursor = 0,
    html = "";
  for (const span of spans) {
    if (span.start < cursor) continue;
    const [light, dark] = colors[span.kind];
    html +=
      escapeCode(text.slice(cursor, span.start)) +
      `<span class="kalandra-token" style="--shiki-light:${light};--shiki-dark:${dark}">${escapeCode(text.slice(span.start, span.end))}</span>`;
    cursor = span.end;
  }
  return html + escapeCode(text.slice(cursor));
}

/** Tiramisu emits escaped code constants before Svelte compiles the page. */
export function highlightDocumentation(svelte: string) {
  const names = new Set(
    Array.from(
      svelte.matchAll(
        /<CodeBlock\s+language="kalandra"\s+code=\{(__code_\d+)\}/g,
      ),
      (m) => m[1],
    ),
  );
  return svelte.replace(
    /const (__code_\d+|homepageCode)\s*=\s*("(?:[^"\\]|\\.)*")/g,
    (original, name: string, json: string) => {
      if (!names.has(name) && name !== "homepageCode") return original;
      const value: string = JSON.parse(json);
      // Tiramisu's unknown-language fallback may already wrap lines in plain spans.
      const raw =
        name === "homepageCode"
          ? value
          : decodeCode(value.replace(/<[^>]*>/g, ""));
      return `const ${name} = ${JSON.stringify(highlightKalandra(raw))}`;
    },
  );
}
export function kalandraHighlightPlugin() {
  return {
    name: "kalandra-documentation-highlighting",
    enforce: "pre" as const,
    transform(source: string, id: string) {
      if (
        !id.endsWith(".tiramisu.svelte") &&
        !id.endsWith("/src/routes/+page.svelte")
      )
        return;
      return { code: highlightDocumentation(source), map: null };
    },
  };
}
