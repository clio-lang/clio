import { expect, test } from "bun:test";
import { mkdtemp, rm, chmod, stat, symlink, lstat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { formatSource, parse } from "../packages/compiler/src/index.js";
import corpus from "./fixtures/clio/corpus.json";
import { verifyFormatCli } from "./helpers/format-cli.js";

const shape = (value: unknown) =>
  JSON.stringify(value, (key, value) => (key === "span" ? undefined : value));
function formatted(text: string) {
  const source = { path: "format.kalandra", text };
  const result = formatSource(source);
  expect(result.diagnostics).toEqual([]);
  expect(result.text).toBeDefined();
  expect(shape(parse({ ...source, text: result.text! }).program)).toBe(
    shape(parse(source).program),
  );
  expect(formatSource({ ...source, text: result.text! }).text).toBe(
    result.text,
  );
  return result.text!;
}

test("formatter preserves the AST and is idempotent for all 177 accepted legacy fixtures", () => {
  expect(corpus.accepted).toHaveLength(177);
  for (const item of corpus.accepted) {
    try {
      formatted(item.source);
    } catch (error) {
      throw new Error(`Formatting failed for ${item.name}`, { cause: error });
    }
  }
});

test("formatter normalizes operator spacing, two-space indentation, continuations, and CRLF", () => {
  expect(formatted("fn  double  n:\r\n    n*2   \r\n")).toBe(
    "fn double n:\n  n * 2\n",
  );
  expect(formatted("values = [\n      1\n      2\n]\n")).toBe(
    "values = [\n  1\n  2\n]\n",
  );
  expect(formatted("value = 1\n    + 2")).toBe("value = 1\n  + 2\n");
  expect(formatted("x=1+2")).toBe("x = 1 + 2\n");
});

test("formatter preserves comment text, order, placement, and literal bytes", () => {
  const text =
    "-- leading 🦉  \r\nfn f x:\r\n    -- inner\r\n    x+1-- inline  \r\n\r\n-- last";
  expect(formatted(text)).toBe(
    "-- leading 🦉  \nfn f x:\n  -- inner\n  x + 1  -- inline  \n\n-- last\n",
  );
  expect(formatted('value = "multi\r\n  line  "')).toBe(
    'value = "multi\r\n  line  "\n',
  );
  expect(formatted('f"literal { x  +  1 }  tail"')).toBe(
    'f"literal { x  +  1 }  tail"\n',
  );
  expect(formatted('"-- not a comment"')).toBe('"-- not a comment"\n');
});

test("formatter retains significant adjacency and unusual legacy bodies", () => {
  for (const text of [
    "values[0]",
    "values [0]",
    "a-1",
    "fn outer x:\nfn inner y: x+y\ninner",
    "# key:\n    key: value",
    "fn f x:\n    if x:\n        x\n    else:\n        0",
  ]) {
    const result = parse({ path: "format.kalandra", text });
    expect(result.program).toBeDefined();
    formatted(text);
  }
});

test("empty and comment-only files format; invalid files produce no output", () => {
  expect(formatted("   \n\n")).toBe("");
  expect(formatted("-- note  ")).toBe("-- note  \n");
  for (const text of ["fn :", "[1", 'f"broken {x"', "x\n\tbad"]) {
    const result = formatSource({ path: "bad.kalandra", text });
    expect(result.text).toBeUndefined();
    expect(result.diagnostics.some((d) => d.severity === "error")).toBe(true);
  }
});

async function fixture(action: (root: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "kalandra-format-"));
  try {
    await action(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
const cli = resolve("packages/cli/src/index.ts");
test("CLI provides non-writing stdout/check and explicit writes, rejecting invalid source", () =>
  fixture((root) => verifyFormatCli(cli, root)));

test("format writes preserve permissions and follow symlinks without replacing the link", () =>
  fixture(async (root) => {
    const target = join(root, "target.kalandra"),
      link = join(root, "link.kalandra");
    await Bun.write(target, "value=1");
    await chmod(target, 0o640);
    await symlink(target, link);
    const result = Bun.spawnSync([
      process.execPath,
      cli,
      "fmt",
      link,
      "--write",
    ]);
    expect(result.exitCode).toBe(0);
    expect(await Bun.file(target).text()).toBe("value = 1\n");
    expect((await stat(target)).mode & 0o777).toBe(0o640);
    expect((await lstat(link)).isSymbolicLink()).toBe(true);
    for (const flags of [
      ["--check", "--write"],
      ["--strict"],
      ["--watch"],
      ["--write", "--write"],
    ])
      expect(
        Bun.spawnSync([process.execPath, cli, "fmt", target, ...flags])
          .exitCode,
      ).toBe(1);
  }));
