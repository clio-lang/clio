import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { locateProject } from "../packages/cli/src/project-root.js";
import { verifyProjectRootCli } from "./helpers/project-root-cli.js";

async function fixture(action: (directory: string) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "kalandra-project-root-"));
  try {
    await action(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("CLI uses the manifest source root from nested and unrelated working directories", () =>
  fixture(async (directory) => {
    await verifyProjectRootCli(resolve("packages/cli/src/index.ts"), directory);
  }));

test("project discovery preserves standalone files and selects the nearest manifest", () =>
  fixture(async (directory) => {
    const entry = join(directory, "src/nested/main.kalandra");
    await Bun.write(entry, "export fn main: 42");
    expect(await locateProject(entry)).toEqual({
      root: join(directory, "src/nested"),
      entry: "main.kalandra",
    });
    await Bun.write(
      join(directory, "kalandra.toml"),
      '[build]\nsource = "src"',
    );
    expect((await locateProject(entry)).entry).toBe("nested/main.kalandra");
    await Bun.write(
      join(directory, "src/nested/kalandra.toml"),
      '[build]\nsource = "."',
    );
    expect((await locateProject(entry)).entry).toBe("main.kalandra");
  }));

test("invalid nearest manifests fail before output and never fall back to a parent", () =>
  fixture(async (directory) => {
    const entry = join(directory, "src/main.kalandra");
    await Bun.write(entry, "export fn main: 42");
    await Bun.write(
      join(directory, "kalandra.toml"),
      '[build]\nsource = "src"',
    );
    const manifest = join(directory, "src/kalandra.toml");
    for (const text of [
      "[",
      "",
      "[build]\nsource = 1",
      '[build]\nsource = ""',
      '[build]\nsource = "/tmp"',
      '[build]\nsource = "../escape"',
      '[build]\nsource = "other"',
    ]) {
      await Bun.write(manifest, text);
      const output = join(directory, "out");
      const result = Bun.spawnSync([
        process.execPath,
        resolve("packages/cli/src/index.ts"),
        "build",
        entry,
        "-o",
        output,
      ]);
      expect(result.exitCode).toBe(1);
      expect(result.stderr.toString()).toContain(
        `Invalid project manifest ${manifest}`,
      );
      expect(await Bun.file(join(output, "main.kalandra.mjs")).exists()).toBe(
        false,
      );
    }
  }));
