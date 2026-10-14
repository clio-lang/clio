import { test, expect } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { compileProject } from "../packages/compiler/src/index.js";
import { WorkspaceDocuments } from "../packages/language-server/src/workspace.js";
const manifest = '[build]\nsource = "src"';
const build = (files: Record<string, string>) =>
  compileProject(
    "main.kalandra",
    {
      readSource: async (path) => files[path] ?? null,
      parseKalandraManifest: (text) => Bun.TOML.parse(text),
    },
    { strictNames: true },
  );
async function execute(files: Record<string, string>) {
  const result = await build(files);
  expect(
    result.diagnostics.filter((item) => item.severity === "error"),
  ).toEqual([]);
  expect(result.output).toBeDefined();
  const dir = await mkdtemp(join(tmpdir(), "kalandra-clio-packages-"));
  try {
    for (const [path, file] of result.output!.files) {
      await mkdir(dirname(join(dir, path)), { recursive: true });
      await writeFile(join(dir, path), file.code);
    }
    return await import(pathToFileURL(join(dir, result.output!.entry)).href);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
test("bare packages, subpaths, aliases and rest imports execute without changing legacy specifiers", async () => {
  const module = await execute({
    "main.kalandra":
      'import "tools"\nfrom "tools" import answer as value * as rest\nfrom "tools/nested" import item\nfrom "tools/nested.kalandra" import item as same\nexport result = [tools.answer value rest.other item same]',
    ".kalandra/modules/tools/kalandra.toml": manifest,
    ".kalandra/modules/tools/src/main.kalandra":
      "export answer = 42\nexport other = 7",
    ".kalandra/modules/tools/src/nested.kalandra": "export item = 3",
    ".kalandra/modules/tools/src/nested/main.kalandra": "export item = 99",
  });
  expect(module.result).toEqual([42, 42, 7, 3, 3]);
});
test("package manifest source roots, root imports, relative imports and transitive bare packages", async () => {
  const module = await execute({
    "main.kalandra":
      'from "first/nested/main" import result\nfrom "/root" import value\nexport output = [result value]',
    "root.kalandra": "export value = 8",
    ".kalandra/modules/first/kalandra.toml": '[build]\nsource = "lib"',
    ".kalandra/modules/first/lib/nested/main.kalandra":
      'from "/helper" import answer\nfrom "../relative" import more\nfrom "second" import value\nexport result = answer + more + value',
    ".kalandra/modules/first/lib/helper.kalandra": "export answer = 1",
    ".kalandra/modules/first/lib/relative.kalandra": "export more = 2",
    ".kalandra/modules/second/kalandra.toml": manifest,
    ".kalandra/modules/second/src/main.kalandra": "export value = 3",
  });
  expect(module.output).toEqual([6, 8]);
});
test("file-before-folder precedence and explicit .kalandra folder fallback match the pinned resolver", async () => {
  const module = await execute({
    "main.kalandra":
      'from "./value" import a\nfrom "./folder.kalandra" import b\nexport result = [a b]',
    "value.kalandra": "export a = 1",
    "value/main.kalandra": "export a = 99",
    "folder.kalandra/main.kalandra": "export b = 2",
  });
  expect(module.result).toEqual([1, 2]);
});
test("missing packages never fall back to nearby local files and invalid manifests fail without output", async () => {
  for (const config of [
    undefined,
    "[build",
    "[build]\nsource=42",
    '[build]\nsource="../../outside"',
    '[build]\nsource="/outside"',
  ]) {
    const result = await build({
      "main.kalandra": 'import "tools"',
      "tools.kalandra": "export value = 42",
      ...(config === undefined
        ? {}
        : { ".kalandra/modules/tools/kalandra.toml": config }),
    });
    expect(result.output).toBeUndefined();
    expect(result.diagnostics.some((item) => item.code === "KAL4101")).toBe(
      true,
    );
  }
  const missingParser = await compileProject("main.kalandra", {
    readSource: async (path) =>
      path === "main.kalandra"
        ? 'import "tools"'
        : path.endsWith("kalandra.toml")
          ? manifest
          : null,
  });
  expect(missingParser.output).toBeUndefined();
  expect(
    missingParser.diagnostics.some((item) =>
      item.message.includes("parseKalandraManifest"),
    ),
  ).toBe(true);
});
test("package path escapes and cycles are rejected", async () => {
  const common = {
    ".kalandra/modules/tools/kalandra.toml": manifest,
    ".kalandra/modules/tools/src/main.kalandra": 'import "other"',
    ".kalandra/modules/other/kalandra.toml": manifest,
    ".kalandra/modules/other/src/main.kalandra": 'import "tools"',
  };
  for (const source of [
    'import "tools/../../outside"',
    'import "/../outside"',
  ]) {
    const result = await build({ ...common, "main.kalandra": source });
    expect(result.output).toBeUndefined();
    expect(result.diagnostics.some((item) => item.code === "KAL4101")).toBe(
      true,
    );
  }
  expect(
    (
      await build({ ...common, "main.kalandra": 'import "tools"' })
    ).diagnostics.some((item) => item.code === "KAL4102"),
  ).toBe(true);
});
test("manifest changes invalidate cached editor graphs and package rename uses captured manifests", async () => {
  const files: Record<string, string> = {
    "main.kalandra": 'from "tools" import answer\nanswer',
    ".kalandra/modules/tools/kalandra.toml": manifest,
    ".kalandra/modules/tools/src/main.kalandra": "export answer = 1",
    ".kalandra/modules/tools/lib/main.kalandra": 'export answer = "new"',
  };
  const workspace = new WorkspaceDocuments(
    {
      locate: (uri) => ({ root: "project", path: uri.slice(16) }),
      uri: (_root, path) => "file:///project/" + path,
      read: async (_root, path) => files[path] ?? null,
      parseKalandraManifest: (text) => Bun.TOML.parse(text),
    },
    () => {},
  );
  const uri = "file:///project/main.kalandra";
  await workspace.open(uri, "kalandra", 1, files["main.kalandra"]!);
  expect(
    (await workspace.references(uri, { line: 1, character: 1 }, true)).at(-1)!
      .uri,
  ).toBe(uri);
  expect(
    (await workspace.definition(uri, { line: 1, character: 1 }))!.uri,
  ).toContain("/src/main.kalandra");
  files[".kalandra/modules/tools/kalandra.toml"] = '[build]\nsource = "lib"';
  const references = await workspace.references(
    uri,
    { line: 1, character: 1 },
    true,
  );
  expect(
    references.some((item) => item.uri.includes("/lib/main.kalandra")),
  ).toBe(true);
  expect(
    references.some((item) => item.uri.includes("/src/main.kalandra")),
  ).toBe(false);
  const rename = await workspace.rename(
    uri,
    { line: 1, character: 1 },
    "value",
  );
  expect(rename!.documentChanges).toHaveLength(2);
  expect(JSON.stringify(rename)).toContain("/lib/main.kalandra");
  expect(JSON.stringify(rename)).not.toContain("kalandra.toml");
});
