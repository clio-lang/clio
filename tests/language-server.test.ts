import { fileWorkspaceHost } from "../packages/language-server/src/file-host.js";
import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { analyzeProject } from "../packages/compiler/src/index.js";
import {
  WorkspaceDocuments,
  DocumentStore,
} from "../packages/language-server/src/index.js";
import { verifyLanguageServer } from "./helpers/lsp-client.js";

describe("editor buffer diagnostics", () => {
  test("unsaved buffers use compiler diagnostics and clear repaired errors", () => {
    const store = new DocumentStore();
    const first = store.open(
      "untitled:test",
      "kalandra",
      1,
      'Number n = "bad"',
    )!;
    expect(first.diagnostics[0]).toMatchObject({
      code: "KAL3111",
      severity: 1,
      source: "kalandra",
    });
    expect(
      store.change("untitled:test", 2, [{ text: "Number n = 42" }])!
        .diagnostics,
    ).toEqual([]);
    expect(
      store.change("untitled:test", 3, [{ text: "fn broken:" }])!.diagnostics
        .length,
    ).toBeGreaterThan(0);
  });
  test("incremental edits use UTF-16 positions across CRLF and astral Unicode", () => {
    const store = new DocumentStore({ strictNames: true });
    const first = store.open(
      "untitled:unicode",
      "kalandra",
      1,
      'label = "🌍"\r\n["🌍" missing]',
    )!;
    expect(first.diagnostics[0]!.range).toEqual({
      start: { line: 1, character: 6 },
      end: { line: 1, character: 13 },
    });
    expect(
      store.change("untitled:unicode", 2, [
        {
          range: {
            start: { line: 1, character: 6 },
            end: { line: 1, character: 13 },
          },
          text: "42",
        },
      ])!.diagnostics,
    ).toEqual([]);
  });
  test("versions, document isolation, close and reopen", () => {
    const store = new DocumentStore();
    store.open("untitled:a", "kalandra", 10, "x = 1");
    expect(
      store.open("untitled:b", "kalandra", 1, 'Number n = "bad"')!.diagnostics
        .length,
    ).toBe(1);
    expect(store.change("untitled:a", 9, [{ text: "!" }])).toBeUndefined();
    expect(store.change("untitled:a", 10, [{ text: "!" }])).toBeUndefined();
    expect(
      store.change("untitled:unknown", 1, [{ text: "!" }]),
    ).toBeUndefined();
    expect(store.close("untitled:a")).toEqual({
      uri: "untitled:a",
      diagnostics: [],
    });
    expect(
      store.open("untitled:a", "kalandra", 1, "x = 1")!.diagnostics,
    ).toEqual([]);
  });
  test("name strictness is configurable and no code is executed", () => {
    expect(
      new DocumentStore().open("untitled:a", "kalandra", 1, "unknown ()")!
        .diagnostics[0]!.severity,
    ).toBe(2);
    expect(
      new DocumentStore({ strictNames: true }).open(
        "untitled:a",
        "kalandra",
        1,
        "unknown ()",
      )!.diagnostics[0]!.severity,
    ).toBe(1);
  });
});
test("stdio LSP initialization, Unicode frames, edits, diagnostics, and shutdown", async () => {
  await verifyLanguageServer(resolve("packages/language-server/src/stdio.ts"));
}, 15000);

describe("project-aware editor diagnostics", () => {
  const main = 'from "./value" import value\nNumber result = value';
  function setup(files: Record<string, string>) {
    const reports = new Map<string, any>();
    const host = {
      locate: (uri: string) =>
        uri.startsWith("file:///project/")
          ? { root: "project", path: uri.slice("file:///project/".length) }
          : undefined,
      uri: (_root: string, path: string) => `file:///project/${path}`,
      async read(_root: string, path: string) {
        return files[path] ?? null;
      },
    };
    const workspace = new WorkspaceDocuments(
      host,
      (report) => reports.set(report.uri, report),
      { strictNames: true },
    );
    return { workspace, reports, host };
  }
  test("unsaved dependency signatures update importers and close restores disk", async () => {
    const { workspace, reports } = setup({
      "value.kalandra": "export value = 1",
    });
    await workspace.open("file:///project/main.kalandra", "kalandra", 1, main);
    expect(reports.get("file:///project/main.kalandra").diagnostics).toEqual(
      [],
    );
    await workspace.open(
      "file:///project/value.kalandra",
      "kalandra",
      1,
      'export value = "bad"',
    );
    expect(
      reports.get("file:///project/main.kalandra").diagnostics[0].code,
    ).toBe("KAL3111");
    expect(reports.get("file:///project/main.kalandra").version).toBe(1);
    await workspace.close("file:///project/value.kalandra");
    expect(reports.get("file:///project/main.kalandra").diagnostics).toEqual(
      [],
    );
    expect(reports.get("file:///project/value.kalandra").diagnostics).toEqual(
      [],
    );
  });
  test("unsaved new files satisfy missing imports, and dependency errors clear when detached", async () => {
    const { workspace, reports } = setup({});
    await workspace.open("file:///project/main.kalandra", "kalandra", 1, main);
    expect(
      reports
        .get("file:///project/main.kalandra")
        .diagnostics.some((d: any) => d.code === "KAL4101"),
    ).toBe(true);
    await workspace.open(
      "file:///project/value.kalandra",
      "kalandra",
      1,
      "export value = 1",
    );
    expect(reports.get("file:///project/main.kalandra").diagnostics).toEqual(
      [],
    );
    await workspace.change("file:///project/value.kalandra", 2, [
      { text: 'export Number value = "bad"' },
    ]);
    expect(
      reports.get("file:///project/value.kalandra").diagnostics[0].code,
    ).toBe("KAL3111");
    await workspace.close("file:///project/value.kalandra");
    await workspace.change("file:///project/main.kalandra", 2, [
      { text: "value = 1" },
    ]);
    expect(reports.get("file:///project/main.kalandra").diagnostics).toEqual(
      [],
    );
    expect(reports.get("file:///project/value.kalandra").diagnostics).toEqual(
      [],
    );
  });
  test("disk diagnostics are deduplicated, have no editor version, and refresh after save", async () => {
    const files = { "value.kalandra": 'export Number value = "bad"' };
    const { workspace, reports } = setup(files);
    await workspace.open("file:///project/main.kalandra", "kalandra", 1, main);
    await workspace.open("file:///project/other.kalandra", "kalandra", 1, main);
    expect(
      reports.get("file:///project/value.kalandra").diagnostics.length,
    ).toBe(1);
    expect(
      reports.get("file:///project/value.kalandra").version,
    ).toBeUndefined();
    files["value.kalandra"] = "export Number value = 42";
    await workspace.refresh();
    expect(reports.get("file:///project/value.kalandra").diagnostics).toEqual(
      [],
    );
  });
  test("late disk reads cannot publish diagnostics from superseded buffers", async () => {
    const { host } = setup({});
    let release!: (text: string) => void;
    const disk = new Promise<string>((resolve) => {
      release = resolve;
    });
    const reports: any[] = [];
    const workspace = new WorkspaceDocuments(
      { ...host, read: () => disk },
      (report) => reports.push(report),
    );
    const first = workspace.open(
      "file:///project/main.kalandra",
      "kalandra",
      1,
      main,
    );
    await workspace.change("file:///project/main.kalandra", 2, [
      { text: "value = 42" },
    ]);
    release('export value = "bad"');
    await first;
    expect(reports.length).toBe(1);
    expect(reports[0].version).toBe(2);
    expect(reports[0].diagnostics).toEqual([]);
  });
  test("disposal cancels pending publication and untitled buffers remain single-file", async () => {
    const { workspace, reports } = setup({});
    await workspace.open("untitled:test", "kalandra", 1, 'Number x = "bad"');
    expect(reports.get("untitled:test").diagnostics[0].code).toBe("KAL3111");
    const { host } = setup({});
    let release!: (text: string) => void;
    const disk = new Promise<string>((resolve) => {
      release = resolve;
    });
    const pendingReports: unknown[] = [];
    const pending = new WorkspaceDocuments(
      { ...host, read: () => disk },
      (report) => pendingReports.push(report),
    );
    const run = pending.open(
      "file:///project/main.kalandra",
      "kalandra",
      1,
      main,
    );
    pending.dispose();
    release("export value = 1");
    await run;
    expect(pendingReports).toEqual([]);
  });
});

test("project analysis shares import checks without emitting or enforcing backend limitations", async () => {
  const result = await analyzeProject("main.kalandra", {
    async readSource(path) {
      return (
        {
          "main.kalandra": 'from "./value" import value\nvalue in [1 2]',
          "value.kalandra": "export value = 1",
        }[path] ?? null
      );
    },
  });
  expect(result.diagnostics).toEqual([]);
  expect(result.output).toBeUndefined();
  expect(result.sources.size).toBe(2);
});

test("filesystem host selects the closest workspace and encodes URI paths", async () => {
  const host = fileWorkspaceHost(["file:///project", "file:///project/nested"]);
  expect(await host.locate("file:///project/nested/a%20b.kalandra")).toEqual({
    root: "/project/nested",
    path: "a b.kalandra",
  });
  expect(host.uri("/project/nested", "a b.kalandra")).toBe(
    "file:///project/nested/a%20b.kalandra",
  );
  expect(await host.locate("file:///project-other/main.kalandra")).toEqual({
    root: "/project-other",
    path: "main.kalandra",
  });
  expect(await host.locate("untitled:main.kalandra")).toBeUndefined();
});

describe("go to definition", () => {
  function setup(files: Record<string, string>) {
    return new WorkspaceDocuments(
      {
        locate: (uri) =>
          uri.startsWith("file:///project/")
            ? { root: "project", path: uri.slice(16) }
            : undefined,
        uri: (_root, path) => `file:///project/${path}`,
        async read(_root, path) {
          return files[path] ?? null;
        },
      },
      () => {},
    );
  }
  test("locals and parameters respect shadowing, including equal function and parameter names", async () => {
    const workspace = setup({});
    const uri = "untitled:local";
    await workspace.open(uri, "kalandra", 1, "fn value value: value");
    // A parameter may shadow its own function name.
    expect(await workspace.definition(uri, { line: 0, character: 17 })).toEqual(
      {
        uri,
        range: {
          start: { line: 0, character: 9 },
          end: { line: 0, character: 14 },
        },
      },
    );
    await workspace.change(uri, 2, [
      { text: "value = 1\nfn inner value: value\nvalue" },
    ]);
    expect(
      (await workspace.definition(uri, { line: 2, character: 2 }))!.range.start,
    ).toEqual({ line: 0, character: 0 });
    expect(
      (await workspace.definition(uri, { line: 1, character: 17 }))!.range
        .start,
    ).toEqual({ line: 1, character: 9 });
  });
  test("named aliases and reexports reach the original declaration", async () => {
    const workspace = setup({
      "bridge.kalandra":
        'from "./value" import answer as result\nexport result',
      "value.kalandra": "export answer = 42",
    });
    const uri = "file:///project/main.kalandra";
    await workspace.open(
      uri,
      "kalandra",
      1,
      'from "./bridge" import result as local\nlocal',
    );
    expect(await workspace.definition(uri, { line: 1, character: 2 })).toEqual({
      uri: "file:///project/value.kalandra",
      range: {
        start: { line: 0, character: 7 },
        end: { line: 0, character: 13 },
      },
    });
    expect(
      (await workspace.definition(uri, { line: 0, character: 33 }))!.uri,
    ).toBe("file:///project/value.kalandra");
  });
  test("namespace members and reexported namespaces resolve without guessing object fields", async () => {
    const workspace = setup({
      "bridge.kalandra": 'import "./value" as data\nexport data',
      "value.kalandra": "export answer = 42",
    });
    const uri = "file:///project/main.kalandra";
    await workspace.open(
      uri,
      "kalandra",
      1,
      'import "./bridge" as api\napi.data.answer\nobject = #answer: 2\nobject.answer',
    );
    expect(
      (await workspace.definition(uri, { line: 1, character: 11 }))!.uri,
    ).toBe("file:///project/value.kalandra");
    expect(
      await workspace.definition(uri, { line: 3, character: 9 }),
    ).toBeNull();
  });
  test("unsaved target changes and Unicode positions are reflected", async () => {
    const workspace = setup({ "value.kalandra": "export answer = 1" });
    const uri = "file:///project/main.kalandra";
    await workspace.open(
      uri,
      "kalandra",
      1,
      'from "./value" import answer\n["🌍" answer]',
    );
    await workspace.open(
      "file:///project/value.kalandra",
      "kalandra",
      1,
      "\nexport answer = 2",
    );
    expect(
      (await workspace.definition(uri, { line: 1, character: 7 }))!.range.start,
    ).toEqual({ line: 1, character: 7 });
    await workspace.close("file:///project/value.kalandra");
    expect(
      (await workspace.definition(uri, { line: 1, character: 7 }))!.range.start
        .line,
    ).toBe(0);
  });
  test("functions and type declarations select names rather than bodies", async () => {
    const workspace = setup({});
    const uri = "untitled:names";
    await workspace.open(
      uri,
      "kalandra",
      1,
      "fn add x: x + 1\nadd 2\ntype Box: value\nBox 3",
    );
    expect(
      (await workspace.definition(uri, { line: 1, character: 1 }))!.range,
    ).toEqual({
      start: { line: 0, character: 3 },
      end: { line: 0, character: 6 },
    });
    expect(
      (await workspace.definition(uri, { line: 3, character: 1 }))!.range,
    ).toEqual({
      start: { line: 2, character: 5 },
      end: { line: 2, character: 8 },
    });
  });
  test("builtins, unresolved names, comments, strings and external packages have no source target", async () => {
    const workspace = setup({});
    const uri = "untitled:no-target";
    await workspace.open(
      uri,
      "kalandra",
      1,
      'Number\nunknown\n"unknown"\nfrom "esm:package" import external\nexternal',
    );
    for (const position of [
      { line: 0, character: 1 },
      { line: 1, character: 1 },
      { line: 2, character: 3 },
      { line: 4, character: 1 },
    ])
      expect(await workspace.definition(uri, position)).toBeNull();
  });
});

test("invalid redeclarations keep diagnostics instead of crashing the editor", () => {
  const report = new DocumentStore().open(
    "untitled:invalid",
    "kalandra",
    1,
    "value = 1\nfn value value: value",
  );
  expect(
    report!.diagnostics.some((diagnostic) => diagnostic.severity === 1),
  ).toBe(true);
});

test("definition requests discard results when an edit overtakes a disk read", async () => {
  let delayed = false;
  let release!: (text: string) => void;
  const workspace = new WorkspaceDocuments(
    {
      locate: (uri) => ({ root: "project", path: uri.slice(16) }),
      uri: (_root, path) => `file:///project/${path}`,
      async read() {
        return delayed
          ? new Promise<string>((resolve) => {
              release = resolve;
            })
          : "export answer = 1";
      },
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
  const lookup = workspace.definition(uri, { line: 1, character: 1 });
  // Let the graph loader reach the dependency's asynchronous read.
  while (!release) await Promise.resolve();
  await workspace.change(uri, 2, [{ text: "answer = 42" }]);
  release("export answer = 1");
  expect(await lookup).toBeNull();
});

test("quick-function parameter definitions use the first bound occurrence, not the whole group", async () => {
  const workspace = new WorkspaceDocuments(
    { locate: () => undefined, uri: () => "", read: async () => null },
    () => {},
  );
  const uri = "untitled:quick";
  await workspace.open(uri, "kalandra", 1, "fn make: (@x + @x + 123)");
  expect(
    (await workspace.definition(uri, { line: 0, character: 16 }))!.range,
  ).toEqual({
    start: { line: 0, character: 10 },
    end: { line: 0, character: 12 },
  });
  expect(
    await workspace.definition(uri, { line: 0, character: 20 }),
  ).toBeNull();
});

describe("type hover", () => {
  function setup(files: Record<string, string> = {}) {
    return new WorkspaceDocuments(
      {
        locate: (uri) =>
          uri.startsWith("file:///project/")
            ? { root: "project", path: uri.slice(16) }
            : undefined,
        uri: (_root, path) => `file:///project/${path}`,
        async read(_root, path) {
          return files[path] ?? null;
        },
      },
      () => {},
    );
  }
  test("variables and shadowed parameters show their actual semantic types", async () => {
    const workspace = setup();
    const uri = "untitled:hover";
    await workspace.open(
      uri,
      "kalandra",
      1,
      "value = 42\n@params String\nfn echo value: value\nvalue",
    );
    expect(
      (await workspace.hover(uri, { line: 3, character: 2 }))!.contents,
    ).toEqual({ kind: "plaintext", value: "value: Number" });
    expect(
      (await workspace.hover(uri, { line: 2, character: 16 }))!.contents,
    ).toEqual({ kind: "plaintext", value: "value: String" });
    expect(
      (await workspace.hover(uri, { line: 2, character: 9 }))!.contents,
    ).toEqual({ kind: "plaintext", value: "value: String" });
    expect(
      (await workspace.hover(uri, { line: 2, character: 4 }))!.contents,
    ).toEqual({ kind: "plaintext", value: "echo: fn (String) -> String" });
  });
  test("async signatures, array elements, type values and Any remain explicit", async () => {
    const workspace = setup();
    const uri = "untitled:types";
    await workspace.open(
      uri,
      "kalandra",
      1,
      "@params Number\n@returns Number\nfn wait n: await n\nvalues = [1 2]\ntype Box: Number value\nunknown",
    );
    expect(
      (await workspace.hover(uri, { line: 2, character: 4 }))!.contents,
    ).toEqual({
      kind: "plaintext",
      value: "wait: async fn (Number) -> Number",
    });
    expect(
      (await workspace.hover(uri, { line: 3, character: 1 }))!.contents,
    ).toEqual({ kind: "plaintext", value: "values: Array<Number>" });
    expect(
      (await workspace.hover(uri, { line: 4, character: 6 }))!.contents,
    ).toEqual({ kind: "plaintext", value: "Box: Type<Box>" });
    expect(
      (await workspace.hover(uri, { line: 5, character: 1 }))!.contents,
    ).toEqual({ kind: "plaintext", value: "unknown: Any" });
  });
  test("import aliases and namespace members use unsaved exported signatures", async () => {
    const workspace = setup({
      "value.kalandra": "@params Number\nfn double n: n * 2\nexport double",
    });
    const uri = "file:///project/main.kalandra";
    await workspace.open(
      uri,
      "kalandra",
      1,
      'from "./value" import double as local\nimport "./value" as api\nlocal\napi.double',
    );
    expect(
      (await workspace.hover(uri, { line: 2, character: 1 }))!.contents,
    ).toEqual({ kind: "plaintext", value: "local: fn (Number) -> Number" });
    expect(await workspace.hover(uri, { line: 0, character: 28 })).toBeNull();
    expect(
      (await workspace.hover(uri, { line: 0, character: 33 }))!.range,
    ).toEqual({
      start: { line: 0, character: 32 },
      end: { line: 0, character: 37 },
    });
    expect(
      (await workspace.hover(uri, { line: 3, character: 5 }))!.contents,
    ).toEqual({ kind: "plaintext", value: "double: fn (Number) -> Number" });
    await workspace.open(
      "file:///project/value.kalandra",
      "kalandra",
      1,
      "@params String\nfn double n: n\nexport double",
    );
    expect(
      (await workspace.hover(uri, { line: 2, character: 1 }))!.contents,
    ).toEqual({ kind: "plaintext", value: "local: fn (String) -> String" });
  });
  test("hover ranges are UTF-16 and do not cover surrounding strings or whitespace", async () => {
    const workspace = setup();
    const uri = "untitled:unicode";
    await workspace.open(uri, "kalandra", 1, 'value = 42\r\n["🌍" value]');
    expect(
      (await workspace.hover(uri, { line: 1, character: 7 }))!.range,
    ).toEqual({
      start: { line: 1, character: 6 },
      end: { line: 1, character: 11 },
    });
    expect(await workspace.hover(uri, { line: 1, character: 3 })).toBeNull();
    expect(await workspace.hover(uri, { line: 1, character: 5 })).toBeNull();
    await workspace.close(uri);
    expect(await workspace.hover(uri, { line: 0, character: 1 })).toBeNull();
  });
  test("a stale hover request cannot return an old type after an edit", async () => {
    let delayed = false;
    let release!: (text: string) => void;
    const workspace = new WorkspaceDocuments(
      {
        locate: (uri) => ({ root: "project", path: uri.slice(16) }),
        uri: (_root, path) => `file:///project/${path}`,
        async read() {
          return delayed
            ? new Promise<string>((resolve) => {
                release = resolve;
              })
            : "export value = 1";
        },
      },
      () => {},
    );
    const uri = "file:///project/main.kalandra";
    await workspace.open(
      uri,
      "kalandra",
      1,
      'from "./value" import value\nvalue',
    );
    delayed = true;
    const hover = workspace.hover(uri, { line: 1, character: 1 });
    while (!release) await Promise.resolve();
    await workspace.change(uri, 2, [{ text: 'value = "new"' }]);
    release("export value = 1");
    expect(await hover).toBeNull();
  });
});

describe("completion", () => {
  function setup(files: Record<string, string> = {}) {
    return new WorkspaceDocuments(
      {
        locate: (uri) =>
          uri.startsWith("file:///project/")
            ? { root: "project", path: uri.slice(16) }
            : undefined,
        uri: (_root, path) => `file:///project/${path}`,
        async read(_root, path) {
          return files[path] ?? null;
        },
      },
      () => {},
    );
  }
  test("lexical scopes keep shadowing and exclude sibling parameters and later locals", async () => {
    const workspace = setup();
    const uri = "untitled:complete";
    await workspace.open(
      uri,
      "kalandra",
      1,
      "value = 1\n@params String\nfn first value:\n  va\n  later = 2\nfn other sibling: sibling",
    );
    const items = await workspace.complete(uri, { line: 3, character: 4 });
    expect(items.map((item) => item.label)).toEqual(["value"]);
    expect(items[0]!.detail).toBe("String");
    expect(items[0]!.textEdit).toEqual({
      range: {
        start: { line: 3, character: 2 },
        end: { line: 3, character: 4 },
      },
      newText: "value",
    });
    await workspace.change(uri, 2, [
      {
        text: "value = 1\nfn first parameter:\n  \n  later = 2\nfn other sibling: sibling",
      },
    ]);
    const all = (await workspace.complete(uri, { line: 2, character: 2 })).map(
      (item) => item.label,
    );
    expect(all).toContain("parameter");
    expect(all).toContain("first");
    expect(all).not.toContain("sibling");
    expect(all).not.toContain("later");
  });
  test("trailing dot and member prefixes use unsaved namespace types", async () => {
    const workspace = setup({
      "value.kalandra": "export answer = 42\nexport another = 1",
    });
    const uri = "file:///project/main.kalandra";
    await workspace.open(uri, "kalandra", 1, 'import "./value" as api\napi.');
    expect(
      (await workspace.complete(uri, { line: 1, character: 4 })).map(
        (item) => item.label,
      ),
    ).toEqual(["another", "answer"]);
    await workspace.open(
      "file:///project/value.kalandra",
      "kalandra",
      1,
      'export changed = "yes"',
    );
    expect(
      (await workspace.complete(uri, { line: 1, character: 4 })).map((item) => [
        item.label,
        item.detail,
      ]),
    ).toEqual([["changed", "String"]]);
  });
  test("record fields use types but dynamic values do not gain invented members", async () => {
    const workspace = setup();
    const uri = "untitled:fields";
    await workspace.open(
      uri,
      "kalandra",
      1,
      "type Box:\n  Number value\nbox = Box 42\nbox.va",
    );
    expect(
      (await workspace.complete(uri, { line: 3, character: 6 })).map((item) => [
        item.label,
        item.detail,
      ]),
    ).toEqual([["value", "Number"]]);
    await workspace.change(uri, 2, [{ text: "fn inspect unknown: unknown." }]);
    expect(await workspace.complete(uri, { line: 0, character: 28 })).toEqual(
      [],
    );
  });
  test("comments and strings suppress completion; UTF-16 edits replace the whole word", async () => {
    const workspace = setup();
    const uri = "untitled:text";
    await workspace.open(
      uri,
      "kalandra",
      1,
      'value = 1\r\n["🌍" valxx]\n-- val\n"val"',
    );
    const item = (
      await workspace.complete(uri, { line: 1, character: 9 })
    ).find((item) => item.label === "value")!;
    expect(item.textEdit).toEqual({
      range: {
        start: { line: 1, character: 6 },
        end: { line: 1, character: 11 },
      },
      newText: "value",
    });
    expect(await workspace.complete(uri, { line: 1, character: 3 })).toEqual(
      [],
    );
    expect(await workspace.complete(uri, { line: 2, character: 5 })).toEqual(
      [],
    );
    expect(await workspace.complete(uri, { line: 3, character: 3 })).toEqual(
      [],
    );
  });
  test("quick parameters stay in their own group and interpolation remains code", async () => {
    const workspace = setup();
    const uri = "untitled:quick";
    await workspace.open(uri, "kalandra", 1, "(@outer + (@inner + @i))");
    expect(
      (await workspace.complete(uri, { line: 0, character: 21 })).map(
        (item) => item.label,
      ),
    ).toEqual(["inner"]);
    await workspace.change(uri, 2, [{ text: 'value = 1\nf"val {va}"' }]);
    expect(await workspace.complete(uri, { line: 1, character: 4 })).toEqual(
      [],
    );
    expect(await workspace.complete(uri, { line: 1, character: 2 })).toEqual(
      [],
    );
    expect(await workspace.complete(uri, { line: 1, character: 6 })).toEqual(
      [],
    );
    expect(
      (await workspace.complete(uri, { line: 1, character: 9 })).map(
        (item) => item.label,
      ),
    ).toEqual(["value"]);
  });
  test("completing incomplete text never replaces the stored document", async () => {
    const workspace = setup({ "value.kalandra": "export answer = 42" });
    const uri = "file:///project/main.kalandra";
    await workspace.open(uri, "kalandra", 1, 'import "./value" as api\napi.');
    expect(
      (await workspace.complete(uri, { line: 1, character: 4 })).length,
    ).toBe(1);
    expect(await workspace.hover(uri, { line: 0, character: 20 })).toBeNull();
    expect(
      await workspace.complete("untitled:missing", { line: 0, character: 0 }),
    ).toEqual([]);
  });
});

test("stdio rename supports versioned document edits", async () => {
  await verifyLanguageServer(
    resolve("packages/language-server/src/stdio.ts"),
    undefined,
    true,
  );
}, 15000);
