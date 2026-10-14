import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { fileWorkspaceHost } from "../packages/language-server/src/file-host.js";
import { WorkspaceDocuments } from "../packages/language-server/src/workspace.js";

async function fixture(
  action: (root: string, uri: (path: string) => string) => Promise<void>,
) {
  const root = await mkdtemp(join(tmpdir(), "kalandra-manifest-workspace-"));
  try {
    await action(root, (path) => pathToFileURL(join(root, path)).href);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("manifest workspace resolves root and package imports, discovers importers, and renames package exports", () =>
  fixture(async (root, uri) => {
    await Bun.write(join(root, "kalandra.toml"), '[build]\nsource = "src"');
    await Bun.write(join(root, "src/value.kalandra"), "export local = 1");
    await Bun.write(
      join(root, "src/.kalandra/modules/math/kalandra.toml"),
      '[build]\nsource = "lib"',
    );
    const target = "src/.kalandra/modules/math/lib/main.kalandra";
    await Bun.write(join(root, target), "export answer = 42");
    const text =
      'from "math" import answer\nfrom "/value" import local\nanswer';
    await Bun.write(join(root, "src/nested/main.kalandra"), text);
    await Bun.write(
      join(root, "src/second.kalandra"),
      'from "math" import answer\nanswer',
    );
    await Bun.write(join(root, "outside.kalandra"), "fn broken:");
    const reports: { uri: string; diagnostics: readonly unknown[] }[] = [];
    const host = fileWorkspaceHost([uri("")]);
    const workspace = new WorkspaceDocuments(host, (report) =>
      reports.push(report),
    );
    const main = uri("src/nested/main.kalandra"),
      position = { line: 2, character: 2 };
    await workspace.open(main, "kalandra", 1, text);
    expect(reports.every((report) => report.diagnostics.length === 0)).toBe(
      true,
    );
    expect((await workspace.definition(main, position))?.uri).toBe(uri(target));
    expect(await workspace.hover(main, position)).not.toBeNull();
    expect((await workspace.references(main, position, true)).length).toBe(5);
    const edits = (await workspace.rename(main, position, "total"))!
      .documentChanges!;
    expect(edits).toHaveLength(3);
    expect(JSON.stringify(edits)).not.toContain("kalandra.toml");
    expect(await host.listSources!(join(root, "src"))).toEqual([
      "nested/main.kalandra",
      "second.kalandra",
      "value.kalandra",
    ]);
  }));

test("manifest edits, deletion, and invalid configuration refresh roots without stale navigation", () =>
  fixture(async (root, uri) => {
    const manifest = join(root, "kalandra.toml");
    await Bun.write(manifest, '[build]\nsource = "src"');
    await Bun.write(join(root, "src/value.kalandra"), "export answer = 1");
    await Bun.write(
      join(root, "src/nested/value.kalandra"),
      "export answer = 2",
    );
    const main = uri("src/nested/main.kalandra"),
      text = 'from "/value" import answer\nanswer';
    await Bun.write(join(root, "src/nested/main.kalandra"), text);
    const reports = new Map<string, readonly { code?: string | number }[]>();
    const workspace = new WorkspaceDocuments(
      fileWorkspaceHost([uri("")]),
      (report) => reports.set(report.uri, report.diagnostics),
    );
    const position = { line: 1, character: 1 };
    await workspace.open(main, "kalandra", 1, text);
    await workspace.references(main, position, true); // prime the project index
    expect((await workspace.definition(main, position))?.uri).toBe(
      uri("src/value.kalandra"),
    );
    await workspace.open(
      uri("kalandra.toml"),
      "toml",
      1,
      '[build]\nsource = "src/nested"',
    );
    expect(reports.get(uri("kalandra.toml"))).toEqual([]);
    expect((await workspace.definition(main, position))?.uri).toBe(
      uri("src/nested/value.kalandra"),
    );
    expect(
      (await workspace.references(main, position, true)).map(
        (item) => item.uri,
      ),
    ).not.toContain(uri("src/value.kalandra"));
    await workspace.change(uri("kalandra.toml"), 2, [{ text: "[" }]);
    expect(reports.get(main)?.[0]?.code).toBe("KAL4301");
    expect(await workspace.definition(main, position)).toBeNull();
    await expect(workspace.rename(main, position, "total")).rejects.toThrow();
    await workspace.close(uri("kalandra.toml"));
    expect(reports.get(main)).toEqual([]);
    expect((await workspace.definition(main, position))?.uri).toBe(
      uri("src/value.kalandra"),
    );
    await Bun.write(manifest, '[build]\nsource = "src/nested"');
    await workspace.refresh();
    expect((await workspace.definition(main, position))?.uri).toBe(
      uri("src/nested/value.kalandra"),
    );
    await rm(manifest);
    await workspace.refresh();
    expect(reports.get(main)?.some((item) => item.code === "KAL4101")).toBe(
      true,
    );
    expect(await workspace.definition(main, position)).toBeNull();
  }));

test("nested manifests isolate discovery, including unsaved boundaries and invalid nearest manifests", () =>
  fixture(async (root, uri) => {
    await Bun.write(join(root, "kalandra.toml"), '[build]\nsource = "src"');
    await Bun.write(join(root, "src/value.kalandra"), "export answer = 1");
    await Bun.write(
      join(root, "src/nested/kalandra.toml"),
      '[build]\nsource = "lib"',
    );
    await Bun.write(
      join(root, "src/nested/lib/value.kalandra"),
      "export answer = 2",
    );
    const host = fileWorkspaceHost([uri("")]);
    expect(await host.listSources!(join(root, "src"))).toEqual([
      "value.kalandra",
    ]);
    expect(await host.locate(uri("src/nested/lib/value.kalandra"))).toEqual({
      root: join(root, "src/nested/lib"),
      path: "value.kalandra",
    });
    expect(
      (await host.locate(uri("src/nested/outside.kalandra")))?.error,
    ).toContain("outside build.source");
    await Bun.write(join(root, "src/nested/kalandra.toml"), "[");
    expect(
      (await host.locate(uri("src/nested/lib/value.kalandra")))?.error,
    ).toContain("Invalid project manifest");
    expect(await host.listSources!(join(root, "src"))).toEqual([
      "value.kalandra",
    ]);
    await rm(join(root, "src/nested/kalandra.toml"));
    expect(
      await host.listSources!(
        join(root, "src"),
        new Map([[uri("src/nested/kalandra.toml"), '[build]\nsource = "lib"']]),
      ),
    ).toEqual(["value.kalandra"]);
    expect(await host.listSources!(join(root, "src"))).toEqual([
      "nested/lib/value.kalandra",
      "value.kalandra",
    ]);
  }));

test("buffer changes overtaking asynchronous root discovery discard navigation", async () => {
  let release!: () => void;
  let pending = false;
  const uri = "file:///project/main.kalandra";
  const workspace = new WorkspaceDocuments(
    {
      async locate() {
        if (pending)
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        return { root: "project", path: "main.kalandra" };
      },
      uri: () => uri,
      read: async () => null,
    },
    () => {},
  );
  await workspace.open(uri, "kalandra", 1, "answer = 1\nanswer");
  pending = true;
  const definition = workspace.definition(uri, { line: 1, character: 1 });
  while (!release) await Promise.resolve();
  pending = false;
  await workspace.change(uri, 2, [{ text: "different = 2" }]);
  release();
  expect(await definition).toBeNull();
});
