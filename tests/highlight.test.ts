import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  highlightSource,
  useHighlightColor,
} from "../packages/cli/src/highlight.js";
import { verifyHighlightCli } from "./helpers/highlight-cli.js";
import corpus from "./fixtures/clio/corpus.json";
const strip = (text: string) => text.replace(/\x1b\[[0-9;]*m/g, "");

test("highlight preserves corpus source text without synthesized indentation or newlines", () => {
  let highlighted = 0;
  for (const fixture of corpus.accepted) {
    const result = highlightSource(
      { path: "test.kalandra", text: fixture.source },
      true,
    );
    expect(result.diagnostics).toEqual([]);
    expect(strip(result.text!)).toBe(fixture.source);
    highlighted++;
  }
  expect(highlighted).toBe(177);
  for (const text of [
    "",
    "   \n\n",
    "-- comment only 😀\r\n",
    "fn :",
    'f"λ {1 + 2}"',
    '"line one\nline two"',
  ]) {
    const result = highlightSource({ path: "test.kalandra", text }, true);
    expect(result.diagnostics).toEqual([]);
    expect(strip(result.text!)).toBe(text);
  }
});

test("highlight distinguishes comments, strings, numbers and keywords by lexer spans", () => {
  const result = highlightSource(
    { path: "test.kalandra", text: '-- fn 123\nfn value: "123"\n42' },
    true,
  );
  expect(result.text).toContain("\x1b[90m-- fn 123\x1b[0m");
  expect(result.text).toContain('\x1b[32m"123"\x1b[0m');
  expect(result.text).toContain("\x1b[33m42\x1b[0m");
  expect(result.text).toContain("\x1b[35mfn\x1b[0m");
  expect(
    highlightSource({ path: "bad.kalandra", text: "!" }, false).text,
  ).toBeUndefined();
});

test("highlight auto color honors terminal state and explicit mode overrides", () => {
  expect(useHighlightColor("auto", true, {})).toBe(true);
  expect(useHighlightColor("auto", false, {})).toBe(false);
  expect(useHighlightColor("auto", true, { NO_COLOR: "1" })).toBe(false);
  expect(useHighlightColor("auto", true, { TERM: "dumb" })).toBe(false);
  expect(useHighlightColor("always", false, { NO_COLOR: "1" })).toBe(true);
  expect(useHighlightColor("never", true, {})).toBe(false);
});

test("CLI highlighting preserves UTF-8 and CRLF through source and bundled entry points", async () => {
  const directory = await mkdtemp(join(tmpdir(), "kalandra-highlight-"));
  try {
    await verifyHighlightCli(resolve("packages/cli/src/index.ts"), directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
