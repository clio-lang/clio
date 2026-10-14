import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  parseExternalTypes,
  resolveExternalTypes,
} from "../packages/shared/src/external-types.js";
import { compileProject } from "../packages/compiler/src/index.js";
import { fileWorkspaceHost } from "../packages/language-server/src/file-host.js";
import { WorkspaceDocuments } from "../packages/language-server/src/workspace.js";
import {
  externalPackage,
  numberFunction,
  verifyExternalTypesCli,
} from "./helpers/external-types-cli.js";

async function fixture(action: (root: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "kalandra-external-types-"));
  try {
    await action(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
const declaration = (exports: unknown) =>
  JSON.stringify({ version: 1, modules: { "esm:.": { exports } } });
const cli = resolve("packages/cli/src/index.ts");

test("package declarations check calls and permit concrete results at parallel boundaries", () =>
  fixture((root) => verifyExternalTypesCli(cli, root)));

test("declaration parsing is bounded and rejects unknown or malformed type shapes", () => {
  const parsed = parseExternalTypes(
    declaration({
      values: {
        kind: "Array",
        element: { kind: "Union", members: ["Number", "String"] },
      },
      pending: { kind: "Promise", element: "Number" },
    }),
  );
  expect(parsed.get("esm:.")?.exports?.values?.kind).toBe("Array");
  for (const text of [
    "{",
    '{"version":2,"modules":{}}',
    declaration({ a: "int128" }),
    declaration({ a: { ...numberFunction, async: "yes" } }),
    declaration({ a: { kind: "Named", taskRecord: true } }),
    JSON.stringify({ version: 1, modules: { "esm:../bad": { exports: {} } } }),
  ])
    expect(() => parseExternalTypes(text)).toThrow();
});

test("build reads declarations without evaluating JavaScript and rejects malformed metadata", () =>
  fixture(async (root) => {
    const pkg = await externalPackage(root);
    await Bun.write(
      join(pkg, "index.js"),
      'throw new Error("MUST NOT EXECUTE"); export const make = n => n;',
    );
    const main = join(root, "main.kalandra");
    await Bun.write(main, 'from "esm:typed-lib" import make\nmake 1');
    const build = () =>
      Bun.spawnSync([
        process.execPath,
        cli,
        "build",
        main,
        "-o",
        join(root, "out"),
      ]);
    expect(build().exitCode).toBe(0);
    await Bun.write(
      join(pkg, "kalandra.types.json"),
      declaration({ make: "Bogus" }),
    );
    const bad = build();
    expect(bad.exitCode).toBe(1);
    expect(bad.stderr.toString()).toContain("KAL4104");
    expect(bad.stderr.toString()).not.toContain("MUST NOT EXECUTE");
  }));

test("ESM subpaths and whole callable CommonJS declarations retain distinct signatures", () =>
  fixture(async (root) => {
    await externalPackage(root);
    const pkg = join(root, "node_modules/callable");
    await Bun.write(
      join(pkg, "package.json"),
      JSON.stringify({
        name: "callable",
        main: "index.cjs",
        kalandra: { types: "types.json" },
      }),
    );
    await Bun.write(join(pkg, "index.cjs"), "module.exports = n => n * 2");
    await Bun.write(
      join(pkg, "types.json"),
      JSON.stringify({
        version: 1,
        modules: { "cjs:.": { exports: {}, value: numberFunction } },
      }),
    );
    await Bun.write(
      join(root, "main.kalandra"),
      'import "cjs:callable" as double\nfrom "esm:typed-lib/sub" import label\nString message = label\nexport fn main: double 21',
    );
    const result = Bun.spawnSync([
      process.execPath,
      cli,
      "run",
      join(root, "main.kalandra"),
      "--strict",
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString().trim()).toBe("42");
  }));

test("editor declarations refresh through disk and unsaved overlays and survive rename replay", () =>
  fixture(async (root) => {
    const pkg = await externalPackage(root);
    const uri = (path: string) => pathToFileURL(path).href;
    const main = uri(join(root, "main.kalandra")),
      types = join(pkg, "kalandra.types.json");
    const reports = new Map<string, readonly { code?: string | number }[]>();
    const workspace = new WorkspaceDocuments(
      fileWorkspaceHost([uri(root)]),
      (report) => reports.set(report.uri, report.diagnostics),
    );
    const text = 'from "esm:typed-lib" import make as local\nlocal 1';
    await workspace.open(main, "kalandra", 1, text);
    expect(reports.get(main)).toEqual([]);
    expect(
      (await workspace.hover(main, { line: 1, character: 1 }))?.contents,
    ).toMatchObject({ value: expect.stringContaining("Number") });
    expect(
      (await workspace.rename(main, { line: 1, character: 1 }, "renamed"))
        ?.documentChanges,
    ).toHaveLength(1);
    const changed = declaration({
      make: { ...numberFunction, parameters: ["String"] },
    });
    await Bun.write(types, changed);
    await workspace.refresh();
    expect(reports.get(main)?.some((d) => d.code === "KAL3106")).toBe(true);
    await expect(
      workspace.rename(main, { line: 1, character: 1 }, "renamed"),
    ).rejects.toThrow();
    await workspace.open(
      uri(types),
      "json",
      1,
      declaration({ make: numberFunction }),
    );
    expect(reports.get(main)).toEqual([]);
    expect(
      (await workspace.rename(main, { line: 1, character: 1 }, "renamed"))
        ?.documentChanges,
    ).toHaveLength(1);
    await workspace.close(uri(types));
    expect(reports.get(main)?.some((d) => d.code === "KAL3106")).toBe(true);
  }));

test("Any and Promise results remain rejected at Sia boundaries", () =>
  fixture(async (root) => {
    const pkg = await externalPackage(root);
    const source =
      'from "esm:typed-lib" import make\n@params Number\n@returns Number\nexport fn twice n: n * 2\nexport fn main: |twice| (make 21)';
    for (const returns of ["Any", { kind: "Promise", element: "Number" }]) {
      await Bun.write(
        join(pkg, "kalandra.types.json"),
        declaration({ make: { ...numberFunction, returns } }),
      );
      const result = await compileProject("main.kalandra", {
        readSource: async () => source,
        resolveExternal: (dep, importer) =>
          resolveExternalTypes(dep, join(root, importer), async (path) => {
            const file = Bun.file(path);
            return (await file.exists()) ? file.text() : null;
          }),
      });
      expect(result.output).toBeUndefined();
      expect(result.diagnostics.some((d) => d.severity === "error")).toBe(true);
    }
  }));
