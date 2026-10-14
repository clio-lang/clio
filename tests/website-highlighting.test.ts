import { test, expect } from "bun:test";
import {
  highlightKalandra,
  highlightDocumentation,
  decodeCode,
} from "../scripts/website-highlighting.js";
const plain = (html: string) => decodeCode(html.replace(/<[^>]*>/g, ""));

test("website highlighting preserves source and escapes HTML, including literal entities", () => {
  for (const source of [
    "",
    "-- λ comment\r\n@params Number\r\nfn f n: n + 1\r\n",
    'fn tag: "<script>&lt;&amp;\\\"</script>"\n',
    "export fn main:\n  [1 2] -> * [await] |double|",
    '"unterminated',
  ]) {
    const html = highlightKalandra(source);
    expect(plain(html)).toBe(source);
    expect(html).not.toContain("<script>");
  }
  expect(highlightKalandra("fn f: 42")).toContain("--shiki-dark:");
});

test("Tiramisu adapter preserves fallback spans and targets only Kalandra constants", () => {
  const source = 'fn f: "&lt;<b>"\n';
  const fallback =
    '<span class="line">fn f: &quot;&amp;lt;&lt;b&gt;&quot;</span>\n';
  const input = `const __code_0 = ${JSON.stringify(fallback)};\nconst __code_1 = "untouched";\n<CodeBlock language="kalandra" code={__code_0} />\n<CodeBlock language="bash" code={__code_1} />`;
  const output = highlightDocumentation(input);
  const html = JSON.parse(
    output.match(/const __code_0 = ("(?:[^"\\]|\\.)*")/)![1]!,
  );
  expect(plain(html)).toBe(source);
  expect(output).toContain('const __code_1 = "untouched";');
  expect(highlightDocumentation('const homepageCode =\n "fn f: 1";')).toContain(
    "kalandra-token",
  );
});

test("JavaScript and shell highlighting preserves source and supplies both theme colors", async () => {
  const { highlightSnippet } =
    await import("../apps/website/src/lib/server/highlight.js");
  for (const [lang, source] of [
    ["javascript", 'export const value = "<script>&lt;";\n'],
    [
      "bash",
      "bun run cli build ../my-app/src/main.kalandra \\\n  -o ../my-app/build --strict --watch",
    ],
  ] as const) {
    const html = await highlightSnippet(source, lang);
    const text = html
      .replace(/<[^>]*>/g, "")
      .replace(/&#x([0-9a-f]+);|&(amp|lt|gt|quot|#39);/gi, (entity, hex) =>
        hex ? String.fromCodePoint(parseInt(hex, 16)) : decodeCode(entity),
      );
    expect(text).toBe(source);
    expect(html).toContain("--shiki-light:");
    expect(html).toContain("--shiki-dark:");
    expect(html).not.toContain("<script>");
  }
});
