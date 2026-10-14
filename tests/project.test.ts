import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  compileProject,
  type ProjectResult,
} from "../packages/compiler/src/index.js";

const project = (sources: Record<string, string>, entry = "main.kalandra") =>
  compileProject(
    entry,
    {
      async readSource(path) {
        return sources[path] ?? null;
      },
    },
    { strictNames: true },
  );
async function execute(result: ProjectResult) {
  expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  expect(result.output).toBeDefined();
  const dir = await mkdtemp(join(tmpdir(), "kalandra-project-"));
  try {
    for (const [path, file] of result.output!.files) {
      const target = join(dir, path);
      await mkdir(dirname(target), { recursive: true });
      await Bun.write(target, file.code);
    }
    return await import(pathToFileURL(join(dir, result.output!.entry)).href);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe("local module graph", () => {
  test("named imports, aliases, re-exports, nested paths and folder entrypoints", async () => {
    const result = await project({
      "main.kalandra":
        'from "./math" import twice as double\nimport "./nested" as nested\nexport result = double nested.number\nexport double',
      "math.kalandra":
        "@params Number\n@returns Number\nexport fn twice x: x * 2",
      "nested/main.kalandra":
        'from "../value.kalandra" import number\nexport number',
      "value.kalandra": "export number = 21",
    });
    const mod = await execute(result);
    expect(mod.result).toBe(42);
    expect(mod.double(5)).toBe(10);
    expect(result.sources.size).toBe(4);
    const map = JSON.parse(
      result.output!.files.get("main.kalandra.mjs")!.sourceMap!,
    );
    expect(map.sourcesContent[0]).toContain('from "./math"');
  });
  test("namespace imports and rest imports exclude explicitly selected exports", async () => {
    const mod = await execute(
      await project({
        "main.kalandra":
          'import "./some-module"\nfrom "./some-module" import a as first * as rest\nexport all = someModule\nexport rest\nexport first',
        "some-module.kalandra": "export a = 1\nexport b = 2",
      }),
    );
    expect({ ...mod.all }).toEqual({ a: 1, b: 2 });
    expect(mod.rest).toEqual({ b: 2 });
    expect(mod.first).toBe(1);
    const bad = await project({
      "main.kalandra": 'from "./dep" import a * as rest\nrest.a',
      "dep.kalandra": "export a = 1",
    });
    expect(bad.output).toBeUndefined();
    expect(bad.diagnostics.some((d) => d.code === "KAL3108")).toBe(true);
  });
  test("range helpers, Any, and record descriptors share identity across modules", async () => {
    const mod = await execute(
      await project({
        "main.kalandra":
          'from "./values" import values Point marker\nexport selected = slice values [0 1]\nexport same = marker == Any\n@check\n@params Point\nexport fn accept point: point\nexport point = Point 3',
        "values.kalandra":
          "export values = 0..10 by 2\nexport type Point: x\nexport marker = Any",
      }),
    );
    expect(mod.selected).toEqual([0, 2]);
    expect(mod.same).toBe(true);
    expect(mod.accept(mod.point)).toBe(mod.point);
  });
  test("exports provide types to callers before emission", async () => {
    const result = await project({
      "main.kalandra": 'from "./math" import double\ndouble "wrong"',
      "math.kalandra":
        "@params Number\n@returns Number\nexport fn double x: x * 2",
    });
    expect(result.output).toBeUndefined();
    expect(
      result.diagnostics.some(
        (d) => d.code === "KAL3106" && d.span?.file === "main.kalandra",
      ),
    ).toBe(true);
  });
  test("missing exports and modules report errors with no partial output", async () => {
    for (const sources of [
      {
        "main.kalandra": 'from "./dep" import missing',
        "dep.kalandra": "export value = 1",
      },
      { "main.kalandra": 'import "./missing"' },
      { "main.kalandra": 'import "../outside"' },
      { "main.kalandra": 'import "ws:pkg"' },
      { "main.kalandra": 'import "./broken"', "broken.kalandra": "fn :" },
    ]) {
      const result = await project(sources as Record<string, string>);
      expect(result.output).toBeUndefined();
      expect(result.diagnostics.some((d) => d.severity === "error")).toBe(true);
    }
  });
  test("cycles are rejected with the dependency chain", async () => {
    const result = await project({
      "main.kalandra": 'import "./other"',
      "other.kalandra": 'import "./main"',
    });
    expect(result.output).toBeUndefined();
    expect(
      result.diagnostics.find((d) => d.code === "KAL4102")?.message,
    ).toContain("main.kalandra → other.kalandra → main.kalandra");
  });
  test("duplicate dependency reads and initialization occur once", async () => {
    const reads = new Map<string, number>();
    const sources: Record<string, string> = {
      "main.kalandra":
        'import "./left"\nimport "./right"\nexport same = left.value == right.value',
      "left.kalandra": 'from "./shared" import value\nexport value',
      "right.kalandra": 'from "./shared" import value\nexport value',
      "shared.kalandra": "export value = # x: 1",
    };
    const result = await compileProject(
      "main.kalandra",
      {
        async readSource(path) {
          reads.set(path, (reads.get(path) ?? 0) + 1);
          return sources[path] ?? null;
        },
      },
      { strictNames: true },
    );
    expect((await execute(result)).same).toBe(true);
    expect(reads.get("shared.kalandra")).toBe(1);
  });
  test("top-level await dependencies complete before their importers", async () => {
    const mod = await execute(
      await project({
        "main.kalandra": 'from "./dep" import value\nexport result = value + 1',
        "dep.kalandra": "export value = await 41",
      }),
    );
    expect(mod.result).toBe(42);
  });
  test("escaped filenames are valid native module specifiers", async () => {
    const mod = await execute(
      await project({
        "main.kalandra": 'import "./a # b" as data\nexport result = data.value',
        "a # b.kalandra": "export value = 7",
      }),
    );
    expect(mod.result).toBe(7);
  });
  test("host failures and nested imports remain explicit diagnostics", async () => {
    const failure = await compileProject("main.kalandra", {
      async readSource() {
        throw new Error("denied");
      },
    });
    expect(failure.output).toBeUndefined();
    expect(failure.diagnostics[0]!.message).toContain("denied");
    const nested = await project({
      "main.kalandra": 'export fn load:\n  import "./dep"',
    });
    expect(nested.output).toBeUndefined();
    expect(nested.diagnostics.some((d) => d.code === "KAL4001")).toBe(true);
  });
});

test("CLI builds executable projects and protects source files before writing", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kalandra-build-cli-"));
  const source = join(dir, "main.kalandra"),
    dep = join(dir, "dep.kalandra"),
    output = join(dir, "out");
  const run = () =>
    Bun.spawnSync([
      process.execPath,
      "packages/cli/src/index.ts",
      "build",
      source,
      "-o",
      output,
      "--strict",
    ]);
  try {
    await Bun.write(
      source,
      'from "./dep" import value\nexport result = value + 1',
    );
    await Bun.write(dep, "export value = 41");
    const good = run();
    expect(good.exitCode).toBe(0);
    expect(
      (await import(pathToFileURL(join(output, "main.kalandra.mjs")).href))
        .result,
    ).toBe(42);
    expect(await Bun.file(join(output, "main.kalandra.mjs.map")).exists()).toBe(
      true,
    );
    const before = await Bun.file(join(output, "main.kalandra.mjs")).text();
    await Bun.write(dep, 'Number value = "bad"');
    expect(run().exitCode).toBe(1);
    expect(await Bun.file(join(output, "main.kalandra.mjs")).text()).toBe(
      before,
    );
    await Bun.write(dep, "export value = 41");
    await rm(join(output, "dep.kalandra.mjs"));
    await symlink(dep, join(output, "dep.kalandra.mjs"));
    const blocked = run();
    expect(blocked.exitCode).toBe(1);
    expect(blocked.stderr.toString()).toContain("must not overwrite");
    expect(await Bun.file(dep).text()).toBe("export value = 41");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("multiple wildcard bindings are rejected before JavaScript emission", async () => {
  const result = await project({
    "main.kalandra": 'from "./dep" import * as a * as b',
    "dep.kalandra": "export value = 1",
  });
  expect(result.output).toBeUndefined();
  expect(
    result.diagnostics.some((d) => d.message.includes("only one wildcard")),
  ).toBe(true);
});
