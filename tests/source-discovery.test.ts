import { test, expect } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { fileWorkspaceHost } from "../packages/language-server/src/file-host.js";
import { WorkspaceDocuments } from "../packages/language-server/src/workspace.js";
import { SourceDiscoveryError } from "../packages/language-server/src/source-discovery.js";

async function fixture(
  run: (root: string, uri: (path: string) => string) => Promise<void>,
) {
  const root = await mkdtemp(join(tmpdir(), "kalandra-discovery-"));
  try {
    await run(root, (path) => pathToFileURL(join(root, path)).href);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("discovery scans .kalandra files and excludes generated, hidden, linked, and nested-workspace sources", async () => {
  await fixture(async (root, uri) => {
    for (const directory of [
      "src",
      ".hidden",
      "node_modules",
      "dist",
      "build",
      "coverage",
      "nested",
    ]) {
      await mkdir(join(root, directory));
      await writeFile(join(root, directory, "value.kalandra"), "value = 1");
    }
    await writeFile(join(root, "main.kalandra"), "value = 1");
    await writeFile(join(root, "other.ts"), "export {}");
    await symlink(join(root, "src"), join(root, "linked"));
    await symlink(join(root, "main.kalandra"), join(root, "linked.kalandra"));
    const host = fileWorkspaceHost([uri("") + "/", uri("nested") + "/"]);
    expect(await host.listSources!(root)).toEqual([
      "main.kalandra",
      "src/value.kalandra",
    ]);
    expect(await host.listSources!(join(root, "nested"))).toEqual([
      "value.kalandra",
    ]);
    expect((await host.locate(uri("nested/value.kalandra")))!.root).toBe(
      join(root, "nested"),
    );
    expect(await fileWorkspaceHost([]).listSources!(root)).toEqual([]);
  });
});

test("unopened importers participate in references and rename, with fresh discovery and unsaved overlays", async () => {
  await fixture(async (root, uri) => {
    await writeFile(join(root, "value.kalandra"), "export answer = 1");
    await writeFile(
      join(root, "main.kalandra"),
      'from "./value" import answer\nanswer',
    );
    const reports: unknown[] = [];
    const workspace = new WorkspaceDocuments(
      fileWorkspaceHost([uri("")]),
      (report) => reports.push(report),
    );
    await workspace.open(
      uri("value.kalandra"),
      "kalandra",
      2,
      "\nexport answer = 2",
    );
    const reportCount = reports.length;
    const position = { line: 1, character: 9 };
    const references = await workspace.references(
      uri("value.kalandra"),
      position,
      true,
    );
    expect(references.map((item) => [item.uri, item.range.start.line])).toEqual(
      [
        [uri("main.kalandra"), 0],
        [uri("main.kalandra"), 1],
        [uri("value.kalandra"), 1],
      ],
    );
    const rename = await workspace.rename(
      uri("value.kalandra"),
      position,
      "result",
    );
    const changes = rename!.documentChanges!;
    expect(changes).toHaveLength(2);
    expect(changes[0]).toMatchObject({
      textDocument: { uri: uri("main.kalandra"), version: null },
    });
    expect(changes[1]).toMatchObject({
      textDocument: { uri: uri("value.kalandra"), version: 2 },
    });
    expect(reports.length).toBe(reportCount);
    await writeFile(
      join(root, "second.kalandra"),
      'import "./value" as api\napi.answer',
    );
    expect(
      await workspace.references(uri("value.kalandra"), position, true),
    ).toHaveLength(4);
    await rm(join(root, "main.kalandra"));
    expect(
      await workspace.references(uri("value.kalandra"), position, true),
    ).toHaveLength(2);
    // New unsaved importers also participate even though discovery cannot list them.
    await workspace.open(
      uri("new.kalandra"),
      "kalandra",
      1,
      'from "./value" import answer\nanswer',
    );
    expect(
      await workspace.references(uri("value.kalandra"), position, true),
    ).toHaveLength(4);
  });
});

test("unopened importer collisions and broken sources block rename", async () => {
  await fixture(async (root, uri) => {
    await writeFile(join(root, "value.kalandra"), "export answer = 1");
    await writeFile(
      join(root, "main.kalandra"),
      'from "./value" import answer\nresult = 2\nanswer',
    );
    const workspace = new WorkspaceDocuments(
      fileWorkspaceHost([uri("")]),
      () => {},
    );
    await workspace.open(
      uri("value.kalandra"),
      "kalandra",
      1,
      "export answer = 1",
    );
    await expect(
      workspace.rename(
        uri("value.kalandra"),
        { line: 0, character: 9 },
        "result",
      ),
    ).rejects.toThrow();
    await writeFile(join(root, "main.kalandra"), "fn broken:");
    await expect(
      workspace.rename(
        uri("value.kalandra"),
        { line: 0, character: 9 },
        "result",
      ),
    ).rejects.toThrow("Fix analysis errors");
  });
});

test("discovery failures and limits do not return partial edits", async () => {
  await fixture(async (root, uri) => {
    await writeFile(join(root, "value.kalandra"), "export answer = 1");
    await writeFile(
      join(root, "main.kalandra"),
      'from "./value" import answer\nanswer',
    );
    const workspace = new WorkspaceDocuments(
      fileWorkspaceHost([uri("")], { maxEntries: 1 }),
      () => {},
    );
    await workspace.open(
      uri("value.kalandra"),
      "kalandra",
      1,
      "export answer = 1",
    );
    await expect(
      workspace.references(
        uri("value.kalandra"),
        { line: 0, character: 9 },
        true,
      ),
    ).rejects.toBeInstanceOf(SourceDiscoveryError);
    await expect(
      workspace.rename(
        uri("value.kalandra"),
        { line: 0, character: 9 },
        "result",
      ),
    ).rejects.toBeInstanceOf(SourceDiscoveryError);
    await expect(
      fileWorkspaceHost([uri("missing")]).listSources!(join(root, "missing")),
    ).rejects.toBeInstanceOf(SourceDiscoveryError);
    await mkdir(join(root, "deep"));
    await expect(
      fileWorkspaceHost([uri("")], { maxDepth: 0 }).listSources!(root),
    ).rejects.toBeInstanceOf(SourceDiscoveryError);
  });
});

test("edits overtaking discovery discard its result", async () => {
  let release!: (paths: string[]) => void;
  const workspace = new WorkspaceDocuments(
    {
      locate: () => ({ root: "project", path: "main.kalandra" }),
      uri: () => "file:///project/main.kalandra",
      read: async () => null,
      listSources: () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    },
    () => {},
  );
  const uri = "file:///project/main.kalandra";
  await workspace.open(uri, "kalandra", 1, "answer = 1\nanswer");
  const rename = workspace.rename(uri, { line: 0, character: 1 }, "result");
  while (!release) await Promise.resolve();
  await workspace.change(uri, 2, [{ text: "different = 1" }]);
  release(["main.kalandra"]);
  expect(await rename).toBeNull();
});

test("configured globs prune directories and match root-relative paths", async () => {
  await fixture(async (root, uri) => {
    await mkdir(join(root, "archive"));
    await mkdir(join(root, "src"));
    for (const path of [
      "main.kalandra",
      "main.test.kalandra",
      "src/a.test.kalandra",
      "src/keep.kalandra",
      "archive/old.kalandra",
    ])
      await writeFile(join(root, path), "value = 1");
    const host = fileWorkspaceHost([uri("")], {
      sourceExcludes: ["archive/**", "**/*.test.kalandra"],
    });
    expect(await host.listSources!(root)).toEqual([
      "main.kalandra",
      "src/keep.kalandra",
    ]);
    expect(
      await fileWorkspaceHost([uri("")], { sourceExcludes: ["src/?.kalandra"] })
        .listSources!(root),
    ).toContain("src/keep.kalandra");
    for (const sourceExcludes of [
      null,
      "src",
      ["../src"],
      ["/src"],
      ["!src"],
      ["src/**x"],
      ["[abc]"],
      ["src//x"],
    ])
      expect(() => fileWorkspaceHost([uri("")], { sourceExcludes })).toThrow(
        SourceDiscoveryError,
      );
  });
});

test("excluded sources still participate when opened or imported; index checks disk edits without notifications", async () => {
  await fixture(async (root, uri) => {
    await mkdir(join(root, "archive"));
    await writeFile(join(root, "value.kalandra"), "export answer = 1");
    await writeFile(
      join(root, "archive/main.kalandra"),
      'from "../value" import answer\nanswer',
    );
    const workspace = new WorkspaceDocuments(
      fileWorkspaceHost([uri("")], { sourceExcludes: ["archive"] }),
      () => {},
    );
    await workspace.open(
      uri("value.kalandra"),
      "kalandra",
      1,
      "export answer = 1",
    );
    const position = { line: 0, character: 9 };
    expect(
      await workspace.references(uri("value.kalandra"), position, true),
    ).toHaveLength(1);
    await workspace.open(
      uri("archive/main.kalandra"),
      "kalandra",
      1,
      'from "../value" import answer\nanswer',
    );
    expect(
      await workspace.references(uri("value.kalandra"), position, true),
    ).toHaveLength(3);
    await workspace.close(uri("archive/main.kalandra"));
    await writeFile(
      join(root, "main.kalandra"),
      'from "./archive/bridge" import answer\nanswer',
    );
    await writeFile(
      join(root, "archive/bridge.kalandra"),
      'from "../value" import answer\nexport answer',
    );
    expect(
      await workspace.references(uri("value.kalandra"), position, true),
    ).toHaveLength(5);
    expect(
      await workspace.references(uri("value.kalandra"), position, true),
    ).toHaveLength(5);
    await writeFile(
      join(root, "main.kalandra"),
      'from "./archive/bridge" import answer\nresult = 1\nanswer',
    );
    await expect(
      workspace.rename(uri("value.kalandra"), position, "result"),
    ).rejects.toThrow();
  });
});
