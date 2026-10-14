import { expect, test } from "bun:test";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  compileProject,
  analyzeProject,
} from "../packages/compiler/src/index.js";
import { runBunProgram } from "../packages/runtime/hosts/bun/index.js";
const factory = `@params Number
fn make offset:
  @params Number
  fn inner value: value + offset
  inner
`;
async function execute(sources: Record<string, string>) {
  const host = { readSource: async (path: string) => sources[path] ?? null };
  const result = await compileProject("main.kalandra", host, {
    strictNames: true,
  });
  expect(result.diagnostics).toEqual([]);
  for (const module of result.modules.values())
    expect(
      module.model.scopes
        .flatMap((scope) => [...scope.symbols.keys()])
        .filter(
          (name) =>
            name.startsWith("__startup") &&
            !Object.values(sources).some((source) => source.includes(name)),
        ),
    ).toEqual([]);
  expect(
    (await analyzeProject("main.kalandra", host, { strictNames: true }))
      .diagnostics,
  ).toEqual([]);
  const dir = await mkdtemp(join(tmpdir(), "kalandra-startup-"));
  try {
    for (const [path, file] of result.output!.files) {
      await mkdir(dirname(join(dir, path)), { recursive: true });
      await Bun.write(join(dir, path), file.code);
    }
    return await runBunProgram(
      pathToFileURL(join(dir, result.output!.runner)).href,
      { maxWorkers: 1, maxQueuedTasks: 8 },
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
test("startup-created target preserves ordinary, parallel and nested calls", async () => {
  expect(
    await execute({
      "main.kalandra": await Bun.file(
        "examples/startup-closure.kalandra",
      ).text(),
    }),
  ).toEqual([6, 6, 7]);
});
test("startup targets cross local imports and retain recursive declaration identity", async () => {
  expect(
    await execute({
      "task.kalandra": `@params Number
fn make offset:
  @params Number
  @returns Number
  fn inner n:
    if n == 0:
      offset
    else:
      inner (n - 1)
  inner
export chosen = make 7
`,
      "main.kalandra":
        'from "./task" import chosen\nexport fn main: await |chosen| 10000',
    }),
  ).toBe(7);
});
test("factory arguments execute once and synthetic captures avoid parameter shadowing", async () => {
  expect(
    await execute({
      "main.kalandra": `type Counter:
  Number value
Counter counter = Counter 0
@params Number
fn next n:
  counter.value = counter.value + 1
  n
@params Number
fn make offset:
  @params Number
  fn inner __startup0: __startup0 + offset
  inner
chosen = make (next 1)
export fn main: [(await |chosen| 5) (chosen 5) counter.value]
`,
    }),
  ).toEqual([6, 6, 1]);
});
test("startup-created record captures use fresh worker snapshots", async () => {
  expect(
    await execute({
      "main.kalandra": `type Counter:
  Number value
@params Counter
fn make state:
  @params Number
  fn inner n:
    state.value = state.value + 1
    n + state.value
  inner
chosen = make (Counter 1)
export fn main: [(await |chosen| 5) (await |chosen| 5) (chosen 5)]
`,
    }),
  ).toEqual([7, 7, 7]);
});
test("ambiguous instances, dynamic factories and unknown captures remain diagnostic", async () => {
  for (const source of [
    factory +
      "first = make 1\nsecond = make 3\nexport fn main: await |first| 5",
    factory + "export fn main:\n  chosen = make 1\n  await |chosen| 5",
    factory.replace("@params Number\nfn make", "fn make") +
      "chosen = make 1\nexport fn main: await |chosen| 5",
    factory.replace("  inner\n", "  1.missing ()\n  inner\n") +
      "chosen = make 1\nexport fn main: await |chosen| 5",
    factory + "alias = make\nchosen = make 1\nexport fn main: await |chosen| 5",
    factory + "chosen = make 1 2\nexport fn main: await |chosen| 5",
  ]) {
    const result = await compileProject(
      "main.kalandra",
      { readSource: async () => source },
      { strictNames: true },
    );
    expect(result.output, source).toBeUndefined();
    expect(result.diagnostics.some((d) => d.severity === "error")).toBe(true);
  }
});

test("hosted startup captures reject effectful argument initialization", async () => {
  const result = await compileProject(
    "main.kalandra",
    {
      readSource: async () =>
        factory +
        `@params Number
fn setup n: n
chosen = make (setup 1)
@params Number
export fn run n: await |chosen| n
`,
    },
    { strictNames: true, remoteServices: { run: "run" } },
  );
  expect(result.output).toBeUndefined();
  expect(result.diagnostics.some((d) => d.code === "KAL4301")).toBe(true);
});
