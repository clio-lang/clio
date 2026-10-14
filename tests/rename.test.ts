import { expect, test } from "bun:test";
import { WorkspaceDocuments } from "../packages/language-server/src/workspace.js";

type WorkspaceEdit = NonNullable<
  Awaited<ReturnType<WorkspaceDocuments["rename"]>>
>;
type TextDocumentEdit = Extract<
  NonNullable<WorkspaceEdit["documentChanges"]>[number],
  { textDocument: unknown }
>;
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
function apply(edit: WorkspaceEdit | null, sources: Record<string, string>) {
  const result = { ...sources };
  for (const change of edit!.documentChanges as TextDocumentEdit[]) {
    const uri = change.textDocument.uri;
    const text = sources[uri]!;
    const offset = (position: { line: number; character: number }) =>
      text
        .split("\n")
        .slice(0, position.line)
        .reduce((sum, line) => sum + line.length + 1, 0) + position.character;
    for (const edit of [...change.edits].sort(
      (a, b) => offset(b.range.start) - offset(a.range.start),
    ))
      result[uri] =
        result[uri]!.slice(0, offset(edit.range.start)) +
        edit.newText +
        result[uri]!.slice(offset(edit.range.end));
  }
  return result;
}
test("prepare and rename honor lexical identities, UTF-16 and buffer versions without mutating buffers", async () => {
  const workspace = setup();
  const uri = "untitled:rename";
  const text = 'value = 1\r\nfn use value other: value + other\r\n["🌍" value]';
  await workspace.open(uri, "kalandra", 7, text);
  expect(await workspace.prepareRename(uri, { line: 2, character: 8 })).toEqual(
    {
      range: {
        start: { line: 2, character: 6 },
        end: { line: 2, character: 11 },
      },
      placeholder: "value",
    },
  );
  const edit = await workspace.rename(uri, { line: 2, character: 8 }, "answer");
  expect(apply(edit, { [uri]: text })[uri]).toBe(
    'answer = 1\r\nfn use value other: value + other\r\n["🌍" answer]',
  );
  expect(
    (edit!.documentChanges![0] as TextDocumentEdit).textDocument.version,
  ).toBe(7);
  expect(
    (await workspace.prepareRename(uri, { line: 2, character: 8 }))!
      .placeholder,
  ).toBe("value");
  const parameter = await workspace.rename(
    uri,
    { line: 1, character: 15 },
    "second",
  );
  expect(apply(parameter, { [uri]: text })[uri]).toContain(
    "fn use value second: value + second",
  );
});

test("quick parameter rename preserves @ and ignores a separate group", async () => {
  const workspace = setup();
  const uri = "untitled:quick";
  const text = "(@x + @y + @y)\n(@y + @y)";
  await workspace.open(uri, "kalandra", 1, text);
  const prepared = await workspace.prepareRename(uri, {
    line: 0,
    character: 12,
  });
  expect(prepared!.range.start.character).toBe(12);
  expect(prepared!.placeholder).toBe("y");
  expect(
    apply(await workspace.rename(uri, { line: 0, character: 12 }, "item"), {
      [uri]: text,
    })[uri],
  ).toBe("(@x + @item + @item)\n(@y + @y)");
});

test("export renames propagate through unaliased imports and namespace members while preserving explicit aliases", async () => {
  const files = {
    "value.kalandra": "export answer = 42",
    "bridge.kalandra": 'from "./value" import answer\nexport answer',
    "alias.kalandra": 'from "./value" import answer as local\nexport local',
  };
  const workspace = setup(files);
  const uri = "file:///project/main.kalandra";
  const text =
    'import "./bridge" as api\nfrom "./bridge" import answer\nimport "./alias" as other\n[api.answer answer other.local]';
  await workspace.open(uri, "kalandra", 1, text);
  const edit = await workspace.rename(uri, { line: 3, character: 7 }, "result");
  const sources = Object.fromEntries(
    Object.entries(files).map(([path, text]) => [
      "file:///project/" + path,
      text,
    ]),
  );
  const changed = apply(edit, { ...sources, [uri]: text });
  expect(changed["file:///project/value.kalandra"]).toBe("export result = 42");
  expect(changed["file:///project/bridge.kalandra"]).toBe(
    'from "./value" import result\nexport result',
  );
  expect(changed["file:///project/alias.kalandra"]).toBe(
    'from "./value" import result as local\nexport local',
  );
  expect(changed[uri]).toBe(
    'import "./bridge" as api\nfrom "./bridge" import result\nimport "./alias" as other\n[api.result result other.local]',
  );
  expect(
    (edit!.documentChanges as TextDocumentEdit[]).find((change) =>
      change.textDocument.uri.endsWith("value.kalandra"),
    )!.textDocument.version,
  ).toBeNull();
});

test("explicit aliases rename independently, including exported and namespace aliases", async () => {
  const workspace = setup({ "value.kalandra": "export answer = 1" });
  const bridge = "file:///project/bridge.kalandra";
  const main = "file:///project/main.kalandra";
  const sources = {
    [bridge]: 'from "./value" import answer as local\nexport local',
    [main]: 'import "./bridge" as api\napi.local',
  };
  await workspace.open(bridge, "kalandra", 3, sources[bridge]);
  await workspace.open(main, "kalandra", 2, sources[main]);
  const edit = await workspace.rename(main, { line: 1, character: 5 }, "item");
  expect(apply(edit, sources)).toEqual({
    [bridge]: 'from "./value" import answer as item\nexport item',
    [main]: 'import "./bridge" as api\napi.item',
  });
  const namespace = await workspace.rename(
    main,
    { line: 1, character: 1 },
    "module",
  );
  expect(apply(namespace, sources)[main]).toBe(
    'import "./bridge" as module\nmodule.local',
  );
});

test("rename rejects duplicate declarations and capture in either direction but allows unrelated sibling names", async () => {
  const workspace = setup();
  const uri = "untitled:collisions";
  for (const [index, text] of [
    "value = 1\nother = 2\nvalue",
    "value = 1\nfn read other: value + other",
    "other = 1\nfn read value: other + value",
    "value = 1\nother",
  ].entries()) {
    await workspace.open(uri, "kalandra", index + 1, text);
    const position =
      index === 2 ? { line: 1, character: 9 } : { line: 0, character: 1 };
    await expect(workspace.rename(uri, position, "other")).rejects.toThrow();
  }
  const text = "fn first value: value\nfn second other: other";
  await workspace.open(uri, "kalandra", 5, text);
  expect(
    apply(await workspace.rename(uri, { line: 0, character: 10 }, "other"), {
      [uri]: text,
    })[uri],
  ).toBe("fn first other: other\nfn second other: other");
});

test("rename rejects invalid names and unsupported targets", async () => {
  const workspace = setup();
  const uri = "untitled:invalid";
  await workspace.open(
    uri,
    "kalandra",
    1,
    'value = 1\nNumber\n"hello"\nobject = #field: 1\nobject.field\nfrom "esm:external" import missing\nmissing',
  );
  for (const name of [
    "fn",
    "two words",
    "@item",
    "1name",
    "",
    "item\n",
    "💡",
  ]) {
    await expect(
      workspace.rename(uri, { line: 0, character: 1 }, name),
    ).rejects.toThrow();
  }
  for (const position of [
    { line: 1, character: 1 },
    { line: 2, character: 2 },
    { line: 4, character: 9 },
    { line: 6, character: 2 },
  ]) {
    expect(await workspace.prepareRename(uri, position)).toBeNull();
  }
  expect(
    await workspace.rename(
      "untitled:missing",
      { line: 0, character: 0 },
      "name",
    ),
  ).toBeNull();
});

test("rename discards stale reads", async () => {
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
  const lookup = workspace.rename(uri, { line: 1, character: 1 }, "result");
  while (!release) await Promise.resolve();
  await workspace.change(uri, 2, [{ text: "answer = 2" }]);
  release("export answer = 1");
  expect(await lookup).toBeNull();
});

test("function and type renames include decorators and annotations", async () => {
  const workspace = setup();
  const uri = "untitled:decorator";
  const text = "fn decorate f: f\n@decorate\nfn run: 1\nrun";
  await workspace.open(uri, "kalandra", 1, text);
  expect(
    apply(await workspace.rename(uri, { line: 0, character: 5 }, "wrap"), {
      [uri]: text,
    })[uri],
  ).toBe("fn wrap f: f\n@wrap\nfn run: 1\nrun");
  const typed = "type Box: value\n@params Box\nfn read box: box\nbox = Box 1";
  await workspace.change(uri, 2, [{ text: typed }]);
  expect(
    apply(await workspace.rename(uri, { line: 0, character: 6 }, "Container"), {
      [uri]: typed,
    })[uri],
  ).toBe(
    "type Container: value\n@params Container\nfn read box: box\nbox = Container 1",
  );
});

test("export rename rejects a collision in an open importer", async () => {
  const workspace = setup({ "value.kalandra": "export answer = 1" });
  const uri = "file:///project/main.kalandra";
  await workspace.open(
    uri,
    "kalandra",
    1,
    'from "./value" import answer\nresult = 2\nanswer',
  );
  await expect(
    workspace.rename(uri, { line: 2, character: 2 }, "result"),
  ).rejects.toThrow();
});
