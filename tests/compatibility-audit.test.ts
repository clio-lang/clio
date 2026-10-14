import { test, expect, spyOn } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { compile, compileProject } from "../packages/compiler/src/index.js";
import { runBunProgram } from "../packages/runtime/hosts/bun/index.js";
import corpus from "./fixtures/clio/corpus.json";
import audit from "./fixtures/clio/compatibility-audit.json";
import { compatibilityContext } from "./helpers/compatibility-context.js";

test("audit accounts for every single-file non-emitting fixture by stable corpus index", async () => {
  expect(audit.commit).toBe(corpus.commit);
  const blocked = corpus.accepted.flatMap((fixture, index) =>
    compile({ path: fixture.file, text: fixture.source }).output ? [] : [index],
  );
  expect(audit.cases.map((item) => item.index)).toEqual(blocked);
  expect(blocked).toHaveLength(31);
  for (const item of audit.cases) {
    const fixture = corpus.accepted[item.index]!;
    expect(item.name).toBe(fixture.name);
    const raw = await compileProject("main.kalandra", {
      readSource: async (path) =>
        path === "main.kalandra" ? fixture.source : null,
    });
    expect(raw.output).toBeUndefined();
    expect(
      raw.diagnostics.filter((d) => d.severity === "error").map((d) => d.code),
    ).toContain(item.rawProjectCode);
  }
});

for (const item of audit.cases)
  test(`compatibility #${item.index}: ${item.name} — ${item.category}`, async () => {
    const context = compatibilityContext(item.index);
    const result = await compileProject("main.kalandra", {
      parseKalandraManifest: (text) => Bun.TOML.parse(text),
      readSource: async (path) => context.sources[path] ?? null,
    });
    if (context.compileError) {
      expect(result.output).toBeUndefined();
      expect(
        result.diagnostics
          .filter((d) => d.severity === "error")
          .map((d) => d.code),
      ).toContain(context.compileError);
      return;
    }
    expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual(
      [],
    );
    expect(result.output).toBeDefined();
    const directory = await mkdtemp(join(tmpdir(), "kalandra-audit-"));
    const logs: unknown[][] = [];
    const logger = context.logs
      ? spyOn(console, "log").mockImplementation((...args: unknown[]) => {
          logs.push(args);
        })
      : null;
    try {
      for (const [path, file] of result.output!.files) {
        const target = join(directory, path);
        await mkdir(dirname(target), { recursive: true });
        await Bun.write(target, file.code);
      }
      const execute = () =>
        runBunProgram(
          pathToFileURL(join(directory, result.output!.runner)).href,
          {
            maxWorkers: 2,
            maxQueuedTasks: 16,
            taskTimeoutMs: 5000,
            args: [[]],
          },
        );
      if (context.runtimeError)
        await expect(execute()).rejects.toBeInstanceOf(TypeError);
      else expect(await execute()).toEqual(context.expected);
      if (context.logs)
        expect(logs).toEqual(context.logs.map((value) => [value]));
    } finally {
      logger?.mockRestore();
      await rm(directory, { recursive: true, force: true });
    }
  }, 15000);

test("direct await-all runtime failures are present in the saved Clio output too", async () => {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  for (const index of [108, 113]) {
    const fixture = corpus.accepted[index]!;
    const reference = new AsyncFunction(
      "a",
      "double",
      "print",
      `return ${fixture.expectedJavaScript};`,
    );
    const double = { parallel: async (value: number) => value * 2 };
    const print = { parallel: async (value: unknown) => value };
    await expect(
      reference(index === 108 ? 3 : [1, 2, 3], double, print),
    ).rejects.toBeInstanceOf(TypeError);
  }
});
