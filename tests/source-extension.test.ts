import { test, expect } from "bun:test";
import { compileProject } from "../packages/compiler/src/index.js";
import { fileWorkspaceHost } from "../packages/language-server/src/file-host.js";
import { findProjectManifest } from "../packages/shared/src/project-root.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

test("Kalandra source imports use only .kalandra files and directory entries", async () => {
  const files: Record<string, string> = {
    "main.kalandra":
      'from "./value" import answer\nfrom "./folder" import more\nexport result = answer + more',
    "value.kalandra": "export answer = 40",
    "value.clio": "invalid legacy source",
    "folder/main.kalandra": "export more = 2",
    "folder/main.clio": "invalid legacy source",
  };
  const result = await compileProject("main.kalandra", {
    readSource: async (path) => files[path] ?? null,
  });
  expect(result.diagnostics).toEqual([]);
  expect([...result.sources.keys()].sort()).toEqual([
    "folder/main.kalandra",
    "main.kalandra",
    "value.kalandra",
  ]);
  expect(result.output?.files.has("main.kalandra.mjs")).toBe(true);
  expect(
    JSON.parse(result.output!.files.get("main.kalandra.mjs")!.sourceMap!)
      .sources,
  ).toEqual(["main.kalandra"]);
});

test("Clio entrypoints and imports are not a fallback", async () => {
  const files: Record<string, string> = {
    "main.clio": "export fn main: 42",
    "value.clio": "export answer = 42",
    "folder/main.clio": "export answer = 42",
  };
  const entry = await compileProject("main.clio", {
    readSource: async (path) => files[path] ?? null,
  });
  expect(entry.output).toBeUndefined();
  expect(entry.diagnostics[0]?.code).toBe("KAL4101");
  for (const specifier of ["./value", "./value.clio", "./folder"]) {
    const result = await compileProject("main.kalandra", {
      readSource: async (path) =>
        path === "main.kalandra"
          ? `from "${specifier}" import answer\nexport answer`
          : (files[path] ?? null),
    });
    expect(result.output).toBeUndefined();
    expect(result.diagnostics.some((d) => d.code === "KAL4101")).toBe(true);
  }
});

test("editor discovers only Kalandra sources and manifests have no Clio fallback", async () => {
  const root = await mkdtemp(join(tmpdir(), "kalandra-extensions-"));
  const uri = (name: string) => pathToFileURL(join(root, name)).href;
  try {
    for (const name of ["main.kalandra", "legacy.clio", "unrelated.txt"])
      await Bun.write(join(root, name), "export value = 42");
    const host = fileWorkspaceHost([uri("")]);
    expect(await host.listSources!(root)).toEqual(["main.kalandra"]);
    expect((await host.locate(uri("main.kalandra")))?.path).toBe(
      "main.kalandra",
    );
    expect(await host.locate(uri("legacy.clio"))).toBeUndefined();
    expect(await host.locate(uri("unrelated.txt"))).toBeUndefined();
    const manifests: Record<string, string> = {
      [join(root, "clio.toml")]: '[build]\nsource="old"',
    };
    const read = async (path: string) => manifests[path] ?? null;
    expect(await findProjectManifest(root, read)).toBeUndefined();
    manifests[join(root, "kalandra.toml")] = '[build]\nsource="src"';
    expect((await findProjectManifest(root, read))?.path).toBe(
      join(root, "kalandra.toml"),
    );
    for (const command of [
      "parse",
      "check",
      "compile",
      "build",
      "run",
      "fmt",
    ]) {
      const result = Bun.spawnSync([
        process.execPath,
        resolve("packages/cli/src/index.ts"),
        command,
        join(root, "legacy.clio"),
      ]);
      expect(result.exitCode).toBe(1);
      expect(result.stderr.toString()).toContain(".kalandra extension");
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("installed packages require the Kalandra manifest and storage layout", async () => {
  for (const files of [
    {
      ".clio/modules/math/clio.toml": '[build]\nsource="src"',
      ".clio/modules/math/src/main.clio": "export answer = 42",
    },
    {
      ".kalandra/modules/math/clio.toml": '[build]\nsource="src"',
      ".kalandra/modules/math/src/main.kalandra": "export answer = 42",
    },
  ]) {
    const result = await compileProject("main.kalandra", {
      readSource: async (path) =>
        path === "main.kalandra"
          ? 'from "math" import answer\nexport answer'
          : ((files as Record<string, string>)[path] ?? null),
      parseKalandraManifest: (text) => Bun.TOML.parse(text),
    });
    expect(result.output).toBeUndefined();
    expect(
      result.diagnostics.some((d) => d.message.includes("kalandra.toml")),
    ).toBe(true);
  }
});
