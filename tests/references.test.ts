import { expect, test } from "bun:test";
import { WorkspaceDocuments } from "../packages/language-server/src/workspace.js";

function setup(files: Record<string, string> = {}) {
  return new WorkspaceDocuments(
    {
      locate: (uri) =>
        uri.startsWith("file:///project/")
          ? { root: "project", path: uri.slice(16) }
          : undefined,
      uri: (_root, path) => `file:///project/${path}`,
      read: async (_root, path) => files[path] ?? null,
    },
    () => {},
  );
}

test("references distinguish shadowed names and multiple function parameters", async () => {
  const workspace = setup();
  const uri = "untitled:references";
  await workspace.open(
    uri,
    "kalandra",
    1,
    "value = 1\nfn sum value other: value + other + other\nvalue",
  );
  const uses = await workspace.references(
    uri,
    { line: 1, character: 14 },
    false,
  );
  expect(uses.map((item) => item.range.start.character)).toEqual([28, 36]);
  const all = await workspace.references(uri, { line: 1, character: 28 }, true);
  expect(all.map((item) => item.range.start.character)).toEqual([13, 28, 36]);
  expect(
    (await workspace.definition(uri, { line: 1, character: 28 }))!.range.start
      .character,
  ).toBe(13);
  expect(
    (await workspace.hover(uri, { line: 1, character: 14 }))!.contents,
  ).toEqual({ kind: "plaintext", value: "other: Any" });
  expect(
    (await workspace.references(uri, { line: 0, character: 1 }, false)).map(
      (item) => item.range.start.line,
    ),
  ).toEqual([2]);
});

test("quick parameter identities and implicit declarations stay distinct", async () => {
  const workspace = setup();
  const uri = "untitled:quick-references";
  await workspace.open(uri, "kalandra", 1, "(@x + @y + @y)\n(@y + @y)");
  expect(
    (await workspace.references(uri, { line: 0, character: 12 }, true)).map(
      (item) => item.range.start,
    ),
  ).toEqual([
    { line: 0, character: 6 },
    { line: 0, character: 11 },
  ]);
  expect(
    (await workspace.references(uri, { line: 0, character: 12 }, false)).map(
      (item) => item.range.start,
    ),
  ).toEqual([{ line: 0, character: 11 }]);
});

test("references follow aliases and namespace reexports across open importer graphs", async () => {
  const workspace = setup({
    "value.kalandra": "export answer = 42",
    "bridge.kalandra": 'from "./value" import answer as result\nexport result',
    "names.kalandra": 'import "./value" as data\nexport data',
  });
  const value = "file:///project/value.kalandra";
  const main = "file:///project/main.kalandra";
  const second = "file:///project/second.kalandra";
  await workspace.open(value, "kalandra", 1, "\nexport answer = 42");
  await workspace.open(
    main,
    "kalandra",
    1,
    'from "./bridge" import result as local\n["🌍" local]',
  );
  await workspace.open(
    second,
    "kalandra",
    1,
    'import "./names" as api\napi.data.answer',
  );
  const all = await workspace.references(
    value,
    { line: 1, character: 9 },
    true,
  );
  expect(
    all.map((item) => [
      item.uri.slice(16),
      item.range.start.line,
      item.range.start.character,
    ]),
  ).toEqual([
    ["bridge.kalandra", 0, 22],
    ["bridge.kalandra", 0, 32],
    ["bridge.kalandra", 1, 7],
    ["main.kalandra", 0, 23],
    ["main.kalandra", 0, 33],
    ["main.kalandra", 1, 6],
    ["second.kalandra", 1, 9],
    ["value.kalandra", 1, 7],
  ]);
  const uses = await workspace.references(
    main,
    { line: 1, character: 7 },
    false,
  );
  expect(uses).toHaveLength(5);
  // Selecting import whitespace or the 'as' keyword must not select a symbol.
  expect(
    await workspace.references(main, { line: 0, character: 30 }, true),
  ).toEqual([]);
  await workspace.close(second);
  expect(
    (await workspace.references(value, { line: 1, character: 9 }, true)).some(
      (item) => item.uri === second,
    ),
  ).toBe(false);
});

test("references ignore spelling in literals, comments and dynamic members", async () => {
  const workspace = setup();
  const uri = "untitled:no-guesses";
  await workspace.open(
    uri,
    "kalandra",
    1,
    'answer = 1\n"answer"\n-- answer\nobject = #answer: 2\nobject.answer\nanswer',
  );
  expect(
    (await workspace.references(uri, { line: 0, character: 1 }, true)).map(
      (item) => item.range.start.line,
    ),
  ).toEqual([0, 5]);
  for (const position of [
    { line: 1, character: 2 },
    { line: 2, character: 4 },
    { line: 4, character: 9 },
  ])
    expect(await workspace.references(uri, position, true)).toEqual([]);
  expect(
    await workspace.references(
      "untitled:missing",
      { line: 0, character: 0 },
      true,
    ),
  ).toEqual([]);
});

test("stale reference reads are discarded after edits", async () => {
  let delayed = false;
  let release!: (text: string) => void;
  const workspace = new WorkspaceDocuments(
    {
      locate: (uri) => ({ root: "project", path: uri.slice(16) }),
      uri: (_root, path) => `file:///project/${path}`,
      read: async () =>
        delayed
          ? new Promise<string>((resolve) => {
              release = resolve;
            })
          : "export answer = 1",
    },
    () => {},
  );
  const uri = "file:///project/main.kalandra";
  await workspace.open(
    uri,
    "kalandra",
    1,
    'from "./value" import answer\nanswer',
  );
  delayed = true;
  const lookup = workspace.references(uri, { line: 1, character: 1 }, true);
  while (!release) await Promise.resolve();
  await workspace.change(uri, 2, [{ text: "answer = 2" }]);
  release("export answer = 1");
  expect(await lookup).toEqual([]);
});
