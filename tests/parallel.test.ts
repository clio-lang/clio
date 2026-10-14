import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { compile, compileProject } from "../packages/compiler/src/index.js";
import {
  runBunProgram,
  createBunWorkerPool,
} from "../packages/runtime/hosts/bun/index.js";

const compileSources = (sources: Record<string, string>) =>
  compileProject("main.kalandra", {
    async readSource(path) {
      return sources[path] ?? null;
    },
  });
async function built<T>(
  source: string | Record<string, string>,
  use: (runner: string, directory: string) => Promise<T>,
): Promise<T> {
  const result = await compileSources(
    typeof source === "string" ? { "main.kalandra": source } : source,
  );
  expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  expect(result.output).toBeDefined();
  const directory = await mkdtemp(join(tmpdir(), "kalandra-parallel-"));
  try {
    for (const [path, file] of result.output!.files) {
      await mkdir(dirname(join(directory, path)), { recursive: true });
      await Bun.write(join(directory, path), file.code);
    }
    return await use(
      pathToFileURL(join(directory, result.output!.runner)).href,
      directory,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
const options = { maxWorkers: 2, maxQueuedTasks: 8, taskTimeoutMs: 5_000 };
const fib = `@params Number
@returns Number
fn fib n:
  if n < 2: n
  else: (fib n - 1) + (fib n - 2)`;

describe("compiled parallel programs", () => {
  test("private decorated recursive targets execute with array maps and awaits", async () => {
    await built(
      `${fib}\nexport fn main argv: [10 11 12] -> * [await] |fib|`,
      async (runner) => {
        expect(await runBunProgram(runner, { ...options, args: [[]] })).toEqual(
          [55, 89, 144],
        );
      },
    );
  });
  test("both spellings, direct calls, dependencies and top-level await", async () => {
    await built(
      `@params Number
fn twice n: n * 2
@params Number
fn work n: (twice n) + 1
export result = await |work| 20
export fn main: (await work.parallel 21) + result`,
      async (runner) => {
        expect(await runBunProgram(runner, options)).toBe(84);
      },
    );
  });
  test("map forwards explicit args, index and original collection", async () => {
    await built(
      `list Numbers: Number
@params Number Number Number Numbers
fn work n extra index collection: n + extra + index + collection[0]
export fn main: [10 20] -> * [await] |work| 5`,
      async (runner) => {
        expect(await runBunProgram(runner, options)).toEqual([25, 36]);
      },
    );
  });
  test("tasks do not rerun application initialization or leak exports", async () => {
    await built(
      `from "esm:node:fs" import appendFileSync
appendFileSync "unused" "initialization"
@params Number
fn work n: n * 2
export fn main: await |work| 21`,
      async (runner, directory) => {
        // Replace the host-only side effect with a counter local to this test module.
        const entry = join(directory, "main.kalandra.mjs");
        const code = await Bun.file(entry).text();
        await Bun.write(
          entry,
          code.replace('"unused"', JSON.stringify(join(directory, "count"))),
        );
        expect(await runBunProgram(runner, options)).toBe(42);
        expect(await Bun.file(join(directory, "count")).text()).toBe(
          "initialization",
        );
        const module = await import(pathToFileURL(entry).href);
        expect(Object.keys(module)).toEqual(["main"]);
      },
    );
  });
  test("parallel calls in dependencies share the same managed dispatcher", async () => {
    await built(
      {
        "main.kalandra":
          'from "./nested/math" import calculate\nexport fn main: calculate 21',
        "nested/math.kalandra":
          "@params Number\nfn twice n: n * 2\n@params Number\nexport fn calculate n: await |twice| n",
      },
      async (runner) => expect(await runBunProgram(runner, options)).toBe(42),
    );
  });
  test("unawaited work is drained and rejected work fails the invocation", async () => {
    await built(
      "@params Number\nfn twice n: n * 2\nexport fn main:\n  |twice| 21\n  7",
      async (runner) => {
        expect(await runBunProgram(runner, options)).toBe(7);
      },
    );
    await built(
      "@params Number\nfn bad n:\n  n.missing ()\n  n\nexport fn main:\n  |bad| 21\n  7",
      async (runner) => {
        await expect(runBunProgram(runner, options)).rejects.toMatchObject({
          code: "TASK_FAILED",
        });
      },
    );
  });
  test("task-data validation and bounded queue failures reach the caller", async () => {
    await built(
      "@params Number\nfn work n: n\nexport fn main: [1 2 3] -> * [await] |work|",
      async (runner) => {
        await expect(
          runBunProgram(runner, {
            ...options,
            maxWorkers: 1,
            maxQueuedTasks: 0,
          }),
        ).rejects.toMatchObject({ code: "QUEUE_FULL" });
      },
    );
    const invalid = await compileSources({
      "main.kalandra":
        "@params Number\nfn work n: n\nexport fn main: await |work| {1 2}",
    });
    expect(invalid.output).toBeUndefined();
    expect(invalid.diagnostics.some((d) => d.code === "KAL3106")).toBe(true);
  });
  test("ordinary ESM use reports missing managed execution, and sessions cannot overlap", async () => {
    await built(
      "@params Number\nfn work n: n * 2\nexport fn main: await |work| 21",
      async (runner, directory) => {
        const module = await import(
          pathToFileURL(join(directory, "main.kalandra.mjs")).href
        );
        await expect(module.main()).rejects.toThrow("managed Kalandra");
        const program = await import(runner);
        let complete!: (value: number) => void;
        const first = program.run(
          () =>
            new Promise<number>((resolve) => {
              complete = resolve;
            }),
        );
        while (!complete) await Promise.resolve();
        await expect(program.run(() => 0)).rejects.toThrow("active invocation");
        complete(42);
        expect(await first).toBe(42);
        expect(await runBunProgram(runner, options)).toBe(42);
      },
    );
  });
  test("generated task maps retain the original source", async () => {
    const text =
      "@params Number\nfn work n: n * 2\nexport fn main: await |work| 21";
    const result = await compileSources({ "main.kalandra": text });
    const task = result.output!.files.get("main.kalandra.mjs.tasks.mjs")!;
    expect(JSON.parse(task.sourceMap!).sourcesContent).toEqual([text]);
    expect(compile({ path: "main.kalandra", text }).output).toBeUndefined();
  });
});

test("unsafe parallel targets fail compilation before any output is returned", async () => {
  const cases = [
    "@params Number\nfn work n: n\nexport fn main: 0..3 -> * [await] |work|",
    "offset = 2\nfn work n: n + offset\nexport fn main: |work| 1",
    "@params Number\nfn work n: unknown n\nexport fn main: |work| 1",
    'from "esm:node:os" import hostname\nfn work: hostname ()\nexport fn main: |work| ()',
    "fn main:\n  fn work n: n\n  |work| 1",
    "@params Number\nfn work n: n\nalias = work\nexport fn main: |alias| 1",
    "offset = 2\nfn dependency n: n + offset\nfn work n: dependency n\nexport fn main: |work| 1",
    "offset = 2\n@describe offset\nfn work n: n\nexport fn main: |work| 1",
  ];
  for (const text of cases) {
    const result = await compileSources({ "main.kalandra": text });
    expect(result.output).toBeUndefined();
    expect(result.diagnostics.some((d) => d.code === "KAL4201")).toBe(true);
  }
});

test("managed tasks snapshot arguments at the call and recover after timeouts and aborts", async () => {
  await built(
    `list Numbers: Number
@params Numbers
fn read value: value[0]
export fn main:
  value = [1]
  pending = |read| value
  value.length = 0
  await pending`,
    async (runner) => {
      expect(await runBunProgram(runner, options)).toBe(1);
      await expect(
        runBunProgram(runner, { ...options, signal: AbortSignal.abort() }),
      ).rejects.toMatchObject({ code: "TASK_CANCELLED" });
      expect(await runBunProgram(runner, options)).toBe(1);
    },
  );
  await built(
    `${fib}\n@params Number\nexport fn main n: await |fib| n`,
    async (runner) => {
      await expect(
        runBunProgram(runner, { ...options, args: [40], taskTimeoutMs: 5 }),
      ).rejects.toMatchObject({ code: "TASK_TIMEOUT" });
      expect(await runBunProgram(runner, { ...options, args: [10] })).toBe(55);
    },
  );
});

test("CLI run compiles, invokes main with arguments, and cleans up after failure", async () => {
  const directory = await mkdtemp(join(tmpdir(), "kalandra-run-test-"));
  const source = join(directory, "main.kalandra");
  const run = (...args: string[]) =>
    Bun.spawnSync([
      process.execPath,
      "packages/cli/src/index.ts",
      "run",
      source,
      ...args,
    ]);
  try {
    await Bun.write(
      source,
      "list Strings: String\n@params String\nfn echo n: n\n@params Strings\nexport fn main argv: argv -> * [await] |echo|",
    );
    const success = run("--strict", "--", "hello", "--world");
    expect(success.exitCode).toBe(0);
    expect(success.stdout.toString()).toContain('"hello", "--world"');
    await Bun.write(
      source,
      "@params Number\nfn bad n:\n  n.missing ()\n  n\nexport fn main: await |bad| 1",
    );
    expect(run().exitCode).toBe(1);
    expect(run().stderr.toString()).toContain("Cannot run program");
    await Bun.write(source, "export value = 1");
    expect(run().stderr.toString()).toContain("callable main");
    await Bun.write(source, "fn :");
    expect(run().exitCode).toBe(1);
    expect(run("--unsupported").exitCode).toBe(1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

describe("parallel targets across local modules", () => {
  test("named aliases retain signatures and support both call spellings and maps", async () => {
    await built(
      {
        "main.kalandra":
          'from "./math" import fib as calculate\nexport fn main:\n  values = [10 11] -> * [await] |calculate|\n  (await calculate.parallel 10) + values[1]',
        "math.kalandra": fib.replace("fn fib", "export fn fib"),
      },
      async (runner) => expect(await runBunProgram(runner, options)).toBe(144),
    );
    const invalid = await compileSources({
      "main.kalandra":
        'from "./math" import fib as calculate\nexport fn main: calculate.parallel "wrong"',
      "math.kalandra": fib.replace("fn fib", "export fn fib"),
    });
    expect(invalid.output).toBeUndefined();
    expect(invalid.diagnostics.some((d) => d.code === "KAL3106")).toBe(true);
  });

  test("re-export chains resolve to one original task module and include private dependencies", async () => {
    const sources = {
      "main.kalandra":
        'from "./barrel" import calculate\nfrom "./math" import work as direct\nexport fn main: (await |calculate| 10) + (await |direct| 20)',
      "barrel.kalandra":
        'from "./nested/relay" import renamed as calculate\nexport calculate',
      "nested/relay.kalandra":
        'from "../math" import work as renamed\nexport renamed',
      "math.kalandra":
        "@params Number\nfn double n: n * 2\n@params Number\nexport fn work n: (double n) + 1",
    };
    await built(sources, async (runner) =>
      expect(await runBunProgram(runner, options)).toBe(62),
    );
    const result = await compileSources(sources);
    expect(
      [...result.output!.files.keys()].filter((path) =>
        path.endsWith(".tasks.mjs"),
      ),
    ).toEqual(["math.kalandra.mjs.tasks.mjs"]);
    expect(
      JSON.parse(
        result.output!.files.get("math.kalandra.mjs.tasks.mjs")!.sourceMap!,
      ).sourcesContent,
    ).toEqual([sources["math.kalandra"]]);
  });

  test("namespace, wildcard namespace, and re-exported namespace members resolve statically", async () => {
    await built(
      {
        "main.kalandra":
          'import "./math" as math\nfrom "./math" import * as rest\nimport "./barrel" as barrel\nexport fn main: (await math.double.parallel 1) + (await rest.double.parallel 2) + (await barrel.math.double.parallel 3)',
        "barrel.kalandra": 'import "./math" as math\nexport math',
        "math.kalandra":
          "export unused = 0\n@params Number\nexport fn double n: n * 2",
      },
      async (runner) => expect(await runBunProgram(runner, options)).toBe(12),
    );
  });

  test("function IDs remain module-local across sibling and escaped paths", async () => {
    await built(
      {
        "main.kalandra":
          'from "./one" import work as a\nfrom "./a # b/nested/two" import work as b\nexport fn main: (await |a| 1) + (await |b| 1)',
        "one.kalandra": "@params Number\nexport fn work n: n + 10",
        "a # b/nested/two.kalandra": "@params Number\nexport fn work n: n + 20",
      },
      async (runner) => expect(await runBunProgram(runner, options)).toBe(32),
    );
  });

  test("only selected exports are validated for transferability", async () => {
    await built(
      {
        "main.kalandra":
          'from "./math" import safe\nexport fn main: await |safe| 21',
        "math.kalandra":
          "state = 1\nexport fn unsafe n: n + state\n@params Number\nexport fn safe n: n * 2",
      },
      async (runner) => expect(await runBunProgram(runner, options)).toBe(42),
    );
  });

  test("invalid imported targets report the defining source and return no output", async () => {
    for (const dependency of [
      "state = 1\n@params Number\nexport fn work n: n + state",
    ]) {
      const result = await compileSources({
        "main.kalandra":
          'from "./barrel" import work\nexport fn main: await |work| 1',
        "barrel.kalandra": 'from "./math" import work\nexport work',
        "math.kalandra": dependency,
        "helper.kalandra": "@params Number\nexport fn double n: n * 2",
      });
      expect(result.output).toBeUndefined();
      expect(
        result.diagnostics.some(
          (d) => d.code === "KAL4201" && d.span?.file === "math.kalandra",
        ),
      ).toBe(true);
    }
  });

  test("external imports, value aliases and shadowed bindings cannot masquerade as task definitions", async () => {
    for (const main of [
      'from "esm:node:os" import hostname\nexport fn main: |hostname| ()',
      'from "./math" import alias\nexport fn main: |alias| 1',
      'from "./math" import work\nexport fn main work: |work| 1',
      'import "./math" as math\nexport fn main: math.alias.parallel 1',
      'from "./math" import alias * as rest\nexport fn main: rest.work.parallel 1',
    ]) {
      const result = await compileSources({
        "main.kalandra": main,
        "math.kalandra":
          "@params Number\nexport fn work n: n\nexport alias = work",
      });
      expect(result.output).toBeUndefined();
      expect(result.diagnostics.some((d) => d.code === "KAL4201")).toBe(true);
    }
  });

  test("workers never replay initializer effects in target modules or re-export modules", async () => {
    const directory = await mkdtemp(join(tmpdir(), "kalandra-import-effects-"));
    const counter = join(directory, "counter");
    const effect = (text: string) =>
      `from "esm:node:fs" import appendFileSync\nappendFileSync ${JSON.stringify(counter)} ${JSON.stringify(text)}\n`;
    try {
      await built(
        {
          "main.kalandra":
            'from "./barrel" import work\nexport fn main: [1 2 3] -> * [await] |work|',
          "barrel.kalandra":
            effect("barrel\n") + 'from "./math" import work\nexport work',
          "math.kalandra":
            effect("math\n") + "@params Number\nexport fn work n: n * 2",
        },
        async (runner) =>
          expect(await runBunProgram(runner, options)).toEqual([2, 4, 6]),
      );
      expect(await Bun.file(counter).text()).toBe("math\nbarrel\n");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe("imported function dependencies inside workers", () => {
  test("transitive aliases and re-exports execute in task companions", async () => {
    const sources = {
      "main.kalandra":
        'from "./work" import work\nexport fn main: [1 2 3] -> * [await] |work|',
      "work.kalandra":
        'from "./barrel" import increment as inc\n@params Number\nexport fn work n: inc n',
      "barrel.kalandra":
        'from "./nested/helper" import increment\nexport increment',
      "nested/helper.kalandra":
        'from "../math" import double\n@params Number\nexport fn increment n: (double n) + 1',
      "math.kalandra": "@params Number\nexport fn double n: n * 2",
    };
    await built(sources, async (runner) =>
      expect(await runBunProgram(runner, options)).toEqual([3, 5, 7]),
    );
    const result = await compileSources(sources);
    const tasks = [...result.output!.files].filter(([path]) =>
      path.endsWith(".tasks.mjs"),
    );
    expect(tasks.map(([path]) => path).sort()).toEqual([
      "math.kalandra.mjs.tasks.mjs",
      "nested/helper.kalandra.mjs.tasks.mjs",
      "work.kalandra.mjs.tasks.mjs",
    ]);
    expect(
      result.output!.files.get("work.kalandra.mjs.tasks.mjs")!.code,
    ).toContain("./nested/helper.kalandra.mjs.tasks.mjs");
  });

  test("namespace functions, duplicate aliases, local closures and async helpers retain behavior", async () => {
    await built(
      {
        "main.kalandra":
          'from "./work" import work\nexport fn main: await |work| 20',
        "work.kalandra":
          'import "./helpers" as helpers\nfrom "./helpers" import double as twice\n@params Number\nexport fn work n:\n  values = [n] -> * (helpers.double @item)\n  (await helpers.asyncDouble n) + values[0] + (twice n)',
        "helpers.kalandra":
          "@params Number\nexport fn double n: n * 2\n@params Number\nexport fn asyncDouble n: await (double n)",
      },
      async (runner) => expect(await runBunProgram(runner, options)).toBe(120),
    );
  });

  test("arbitrary imported decorators cannot establish a serialized signature", async () => {
    const result = await compileSources({
      "main.kalandra":
        'from "./work" import work\nexport fn main: await |work| 20',
      "work.kalandra":
        'import "./decorators" as decorators\n@decorators.wrap\n@params Number\nexport fn work n: n * 2',
      "decorators.kalandra": "export fn wrap callable: callable",
    });
    expect(result.output).toBeUndefined();
    expect(result.diagnostics.some((d) => d.code === "KAL4202")).toBe(true);
  });

  test("escaped paths and module-local binding IDs do not collide", async () => {
    await built(
      {
        "main.kalandra":
          'from "./a # b/work" import work\nexport fn main: await |work| 1',
        "a # b/work.kalandra":
          'from "../left" import work as left\nfrom "../right" import work as right\n@params Number\nexport fn work n: (left n) + (right n)',
        "left.kalandra": "@params Number\nexport fn work n: n + 10",
        "right.kalandra": "@params Number\nexport fn work n: n + 20",
      },
      async (runner) => expect(await runBunProgram(runner, options)).toBe(32),
    );
  });

  test("unsafe transitive helper captures fail at their source", async () => {
    for (const helper of [
      "state = 1\nexport fn helper n: n + state",
      'from "esm:node:os" import hostname\nexport fn helper n: hostname ()',
      "export fn helper n: missing n",
    ]) {
      const result = await compileSources({
        "main.kalandra":
          'from "./work" import work\nexport fn main: await |work| 1',
        "work.kalandra":
          'from "./helper" import helper\n@params Number\nexport fn work n: helper n',
        "helper.kalandra": helper,
      });
      expect(result.output).toBeUndefined();
      expect(
        result.diagnostics.some(
          (d) => d.code === "KAL4201" && d.span?.file === "helper.kalandra",
        ),
      ).toBe(true);
    }
  });

  test("namespace objects, data, mutable rest copies and replacement remain rejected", async () => {
    for (const work of [
      'from "./helper" import value\n@params Number\nexport fn work n: n + value',
      'import "./helper" as helper\n@params Number\nexport fn work n: helper',
      'from "./helper" import value * as rest\n@params Number\nexport fn work n: rest.double n',
      'import "./helper" as helper\n@params Number\nexport fn work n:\n  helper.double = n\n  n',
    ]) {
      const result = await compileSources({
        "main.kalandra":
          'from "./work" import work\nexport fn main: await |work| 1',
        "work.kalandra": work,
        "helper.kalandra":
          "export value = 2\n@params Number\nexport fn double n: n * 2",
      });
      expect(result.output).toBeUndefined();
      expect(
        result.diagnostics.some((d) => ["KAL4201", "KAL3111"].includes(d.code)),
      ).toBe(true);
    }
  });

  test("helper initialization runs only in the application, not per worker", async () => {
    const directory = await mkdtemp(join(tmpdir(), "kalandra-helper-effects-"));
    const counter = join(directory, "counter");
    try {
      await built(
        {
          "main.kalandra":
            'from "./work" import work\nexport fn main: [1 2 3] -> * [await] |work|',
          "work.kalandra":
            'from "./helper" import double\n@params Number\nexport fn work n: double n',
          "helper.kalandra": `from "esm:node:fs" import appendFileSync\nappendFileSync ${JSON.stringify(counter)} "initialized"\nstate = 1\nexport fn unused n: n + state\n@params Number\nexport fn double n: n * 2`,
        },
        async (runner) =>
          expect(await runBunProgram(runner, options)).toEqual([2, 4, 6]),
      );
      expect(await Bun.file(counter).text()).toBe("initialized");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe("compiler-generated Sia boundaries", () => {
  test("worker requests and results preserve the full Number range and UTF-16 strings", async () => {
    await built(
      "@params Number\nfn echo value: value\n@params Number\nexport fn main value: await |echo| value",
      async (runner) => {
        for (const value of [
          -0,
          1.5,
          -1.5,
          Number.MIN_VALUE,
          Number.MAX_VALUE,
          NaN,
          Infinity,
          -Infinity,
        ])
          expect(
            Object.is(
              await runBunProgram(runner, { ...options, args: [value] }),
              value,
            ),
          ).toBe(true);
        await expect(
          runBunProgram(runner, { ...options, args: ["dynamic host value"] }),
        ).rejects.toMatchObject({ code: "INVALID_TASK" });
      },
    );
    await built(
      "@params String\nfn echo value: value\n@params String\nexport fn main value: await |echo| value",
      async (runner) => {
        const value = "hello 🐱\u0000\ud800\udfff";
        expect(await runBunProgram(runner, { ...options, args: [value] })).toBe(
          value,
        );
      },
    );
  });

  test("nested arrays and finite union results execute with concrete schemas", async () => {
    await built(
      "list Numbers: Number\nlist Matrix: Numbers\n@params Matrix\nfn echo values: values\nexport fn main: await |echo| [[1.5 2.5] [3.5]]",
      async (runner) =>
        expect(await runBunProgram(runner, options)).toEqual([
          [1.5, 2.5],
          [3.5],
        ]),
    );
    await built(
      '@params Number\nfn classify n:\n  if n > 0: n / 2\n  else: "negative"\nexport fn main: [3 -1] -> * [await] |classify|',
      async (runner) =>
        expect(await runBunProgram(runner, options)).toEqual([1.5, "negative"]),
    );
  });

  test("stale task schemas and runtime result mismatches fail rather than falling back", async () => {
    await built(
      "@params Number\nfn work n: n * 2\nexport fn main: await |work| 21",
      async (runner, directory) => {
        const path = join(directory, "main.kalandra.mjs.tasks.mjs");
        const original = await Bun.file(path).text();
        const module = await import(pathToFileURL(path).href);
        const name = Object.keys(module).find((key) => key.startsWith("task"))!;
        await Bun.write(
          path,
          `export function ${name}() { return 42; }\nexport const __kalandraSchemas = {};`,
        );
        await expect(runBunProgram(runner, options)).rejects.toThrow(
          "schema does not match",
        );
        await Bun.write(
          path,
          `export function ${name}() { return "unexpected dynamic result"; }\nexport const __kalandraSchemas = ${JSON.stringify(module.__kalandraSchemas)};`,
        );
        await expect(runBunProgram(runner, options)).rejects.toThrow(
          "number schema",
        );
        await Bun.write(path, original);
        expect(await runBunProgram(runner, options)).toBe(42);
      },
    );
  });

  test("schema metadata has independent limits from task values", async () => {
    await built(
      "@params Number\nfn work n: n * 2\nexport fn main: await |work| 21",
      async (runner) => {
        expect(
          await runBunProgram(runner, {
            ...options,
            valueLimits: { maxDataBytes: 16, maxDepth: 1, maxNodes: 2 },
          }),
        ).toBe(42);
      },
    );
  });

  test("compiled dispatch always includes schemas for actual map metadata", async () => {
    await built(
      "@params Number\nfn work n: n * 2\nexport fn main: [1 2] -> * [await] |work|",
      async (runner) => {
        const program = await import(runner);
        const seen: unknown[] = [];
        const result = await program.run(
          (task: { schema: unknown; args: number[] }) => {
            seen.push(task.schema);
            return task.args[0]! * 2;
          },
        );
        expect(result).toEqual([2, 4]);
        expect(seen).toEqual([
          { args: ["number", "number", { array: "number" }], result: "number" },
          { args: ["number", "number", { array: "number" }], result: "number" },
        ]);
      },
    );
  });
});

describe("typed records across worker boundaries", () => {
  test("local records preserve their prototype and pass checked calls after a round trip", async () => {
    await built(
      `export type Point:
  Number x
  Number y
@params Point
@returns Point
@check
fn echo point: point
export fn main:
  point = await |echo| (Point 1.5 2.5)
  echo point`,
      async (runner, directory) => {
        const module = await import(
          pathToFileURL(join(directory, "main.kalandra.mjs")).href
        );
        const result = await runBunProgram(runner, options);
        expect(result).toBeInstanceOf(module.Point);
        expect(result).toMatchObject({ x: 1.5, y: 2.5 });
      },
    );
  });
  test("nested records, lists, inheritance and imported aliases retain their defining type", async () => {
    await built(
      {
        "main.kalandra":
          'from "./barrel" import Box Point NamedPoint\nfrom "./worker" import echo\nexport fn main: await |echo| (Box [(NamedPoint "home" 1.5 2.5)])',
        "barrel.kalandra":
          'from "./records" import Box Point NamedPoint\nexport Box\nexport Point\nexport NamedPoint',
        "records.kalandra":
          "export type Point:\n  Number x\n  Number y\nexport type NamedPoint is Point:\n  String name\nlist Points: NamedPoint\nexport type Box:\n  Points points",
        "worker.kalandra":
          'from "./barrel" import Box as Package\n@params Package\n@returns Package\n@check\nexport fn echo box: box',
      },
      async (runner, directory) => {
        const types = await import(
          pathToFileURL(join(directory, "records.kalandra.mjs")).href
        );
        const result = (await runBunProgram(runner, options)) as any;
        expect(result).toBeInstanceOf(types.Box);
        expect(result.points[0]).toBeInstanceOf(types.NamedPoint);
        expect(result.points[0]).toBeInstanceOf(types.Point);
        expect(result.points[0]).toMatchObject({
          name: "home",
          x: 1.5,
          y: 2.5,
        });
      },
    );
  });
});

test("nominal record unions distinguish identical field shapes and preserve map metadata", async () => {
  await built(
    `export type Left:
  Number value
export type Right:
  Number value
@params Number
fn classify n:
  if n > 0: Left n
  else: Right n
export fn main: [1 -1] -> * [await] |classify|`,
    async (runner, directory) => {
      const types = await import(
        pathToFileURL(join(directory, "main.kalandra.mjs")).href
      );
      const result = (await runBunProgram(runner, options)) as any[];
      expect(result[0]).toBeInstanceOf(types.Left);
      expect(result[1]).toBeInstanceOf(types.Right);
      expect(result[1]).not.toBeInstanceOf(types.Left);
    },
  );
  await built(
    `export type Point:
  Number value
list Points: Point
@params Point Number Points
fn mapped point index collection: collection[index]
export fn main: [(Point 1) (Point 2)] -> * [await] |mapped|`,
    async (runner, directory) => {
      const { Point } = await import(
        pathToFileURL(join(directory, "main.kalandra.mjs")).href
      );
      const result = (await runBunProgram(runner, options)) as any[];
      expect(result.map((point) => point.value)).toEqual([1, 2]);
      for (const point of result) expect(point).toBeInstanceOf(Point);
    },
  );
});

test("record inputs reject plain objects, wrong nominal types, extra fields and accessors", async () => {
  await built(
    `export type Point:
  Number x
export type Other:
  Number x
@params Point
fn echo point: point
@params Point
export fn main point: await |echo| point`,
    async (runner, directory) => {
      const { Point, Other } = await import(
        pathToFileURL(join(directory, "main.kalandra.mjs")).href
      );
      const extra = new Point(1);
      extra.extra = 2;
      const missing = new Point(1);
      delete missing.x;
      const symbol = new Point(1);
      symbol[Symbol("metadata")] = 2;
      let accessed = false;
      const getter = new Point(1);
      Object.defineProperty(getter, "x", {
        enumerable: true,
        get() {
          accessed = true;
          return 1;
        },
      });
      for (const point of [
        { x: 1 },
        new Other(1),
        extra,
        missing,
        symbol,
        getter,
        new Point("bad"),
      ])
        await expect(
          runBunProgram(runner, { ...options, args: [point] }),
        ).rejects.toThrow();
      expect(accessed).toBe(false);
      const valid = await runBunProgram(runner, {
        ...options,
        args: [new Point(1.5)],
      });
      expect(valid).toBeInstanceOf(Point);
    },
  );
});

test("records with special field names are reconstructed as own data properties", async () => {
  await built(
    `export type Special:
  Number __proto__
  String constructor
@params Special
fn echo value: value
export fn main: await |echo| (Special 1.5 "name")`,
    async (runner, directory) => {
      const { Special } = await import(
        pathToFileURL(join(directory, "main.kalandra.mjs")).href
      );
      const value = (await runBunProgram(runner, options)) as any;
      expect(value).toBeInstanceOf(Special);
      expect(Object.hasOwn(value, "__proto__")).toBe(true);
      expect(value.__proto__).toBe(1.5);
      expect(value.constructor).toBe("name");
    },
  );
});

test("record snapshots are taken at dispatch and type-only imports do not replay initialization", async () => {
  const directory = await mkdtemp(join(tmpdir(), "kalandra-record-effects-"));
  try {
    const counter = join(directory, "count");
    await built(
      {
        "main.kalandra":
          'from "./types" import Point\nfrom "./worker" import echo\nexport fn main:\n  p = Point 1\n  pending = |echo| p\n  p.x = 2\n  await pending',
        "types.kalandra": `from "esm:node:fs" import appendFileSync\nappendFileSync ${JSON.stringify(counter)} "once"\nexport type Point:\n  Number x`,
        "worker.kalandra":
          'import "./types" as types\n@params types.Point\n@check\nexport fn echo p: p',
      },
      async (runner) =>
        expect(await runBunProgram(runner, options)).toMatchObject({ x: 1 }),
    );
    expect(await Bun.file(counter).text()).toBe("once");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("record constructors cannot shadow the JavaScript helpers used to initialize fields", async () => {
  for (const name of ["Object", "__kalandra1"]) {
    await built(
      `export type ${name}:\n  Number value\n@params ${name}\nfn echo p: p\nexport fn main: await |echo| (${name} 1.5)`,
      async (runner, directory) => {
        const types = await import(
          pathToFileURL(join(directory, "main.kalandra.mjs")).href
        );
        const value = await runBunProgram(runner, options);
        expect(value).toBeInstanceOf(types[name]);
        expect(value).toMatchObject({ value: 1.5 });
      },
    );
  }
});

describe("explicitly typed parallel captures", () => {
  test("scalars and transitive recursive helpers share one fresh capture scope", async () => {
    await built(
      `Number offset = 2
@params Number
@returns Number
fn recursive n:
  if n < 1: offset
  else: recursive (n - 1)
@params Number
@returns Number
@check
fn work n: (recursive n) + n
export fn main: await |work| 40`,
      async (runner) => {
        expect(await runBunProgram(runner, options)).toBe(42);
      },
    );
  });
  test("records are snapshotted at dispatch and isolated across queued calls and worker reuse", async () => {
    await built(
      `type State:
  Number count
State state = State 1
@params Number
@returns Number
fn work increment:
  state.count = state.count + increment
  state.count
export fn main:
  first = |work| 10
  state.count = 2
  second = |work| 20
  a = await first
  b = await second
  third = await |work| 30
  [a b third state.count]`,
      async (runner) => {
        expect(
          await runBunProgram(runner, { ...options, maxWorkers: 1 }),
        ).toEqual([11, 22, 32, 2]);
      },
    );
  });
  test("private captures in imported helpers cross aliases and reexports without running module effects in workers", async () => {
    const directory = await mkdtemp(join(tmpdir(), "kalandra-capture-effect-"));
    const counter = join(directory, "counter");
    try {
      await built(
        {
          "main.kalandra": `from "./facade" import work as task\nexport fn main: await |task| 40`,
          "facade.kalandra": `from "./work" import work\nexport work`,
          "work.kalandra": `from "./helper" import helper\nNumber offset = 1\n@params Number\n@returns Number\nexport fn work n: (helper n) + offset`,
          "helper.kalandra": `from "esm:node:fs" import appendFileSync\nappendFileSync ${JSON.stringify(counter)} "once"\nNumber offset = 1\n@params Number\n@returns Number\nexport fn helper n: n + offset`,
        },
        async (runner) => {
          expect(await runBunProgram(runner, options)).toBe(42);
          expect(await Bun.file(counter).text()).toBe("once");
        },
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  test("capture schemas are specific to each target and map metadata remains unchanged", async () => {
    await built(
      `list Numbers: Number
Number offset = 2
String label = "hello"
@params Number Number Numbers
@returns Number
@check
fn work n index collection: n + index + collection[0] + offset
@returns String
fn greeting: label
export fn main:
  values = [10 20] -> * [await] |work|
  text = await |greeting| ()
  [values[0] values[1] text.length]`,
      async (runner) => {
        expect(await runBunProgram(runner, options)).toEqual([22, 33, 5]);
      },
    );
  });
  test("captured arrays preserve float64 and async imported helpers keep nominal types", async () => {
    await built(
      {
        "main.kalandra": `from "./helper" import read as first read as second
list Numbers: Number
Numbers values = [1.5 -0 (1 / 0)]
@returns Number
fn work: (await first values[0]) + (await second values[0])
export fn main: await |work| ()`,
        "helper.kalandra": `export type State:
  Number value
State state = State 2
@params Number
@returns Number
export fn read value:
  @params Number
  @returns Number
  @check
  fn local n: n + state.value
  await local value`,
      },
      async (runner) => {
        expect(await runBunProgram(runner, options)).toBe(7);
      },
    );
  });
  test("runtime checks reject invalid captured records without evaluating accessors", async () => {
    await built(
      `type State:
  Number count
export State state = State 1
@returns Number
fn read: state.count
export fn main: await |read| ()`,
      async (runner, directory) => {
        const parent = await import(
          pathToFileURL(join(directory, "main.kalandra.mjs")).href
        );
        let reads = 0;
        Object.defineProperty(parent.state, "count", {
          get() {
            reads++;
            return 1;
          },
        });
        await expect(runBunProgram(runner, options)).rejects.toThrow();
        expect(reads).toBe(0);
      },
    );
  });
  test("unsupported types, dynamic initialization and dynamic alias writes fail at the parallel call", async () => {
    for (const source of [
      `Any offset = 2\n@returns Number\nfn work: offset\nexport fn main: |work| ()`,
      `Number offset = unknown ()\n@returns Number\nfn work: offset\nexport fn main: |work| ()`,
      `type State:\n  Number count\nState state = State 1\nalias = state\nalias.count = unknown ()\n@returns Number\nfn work: state.count\nexport fn main: |work| ()`,
    ]) {
      const result = await compileSources({ "main.kalandra": source });
      expect(result.output).toBeUndefined();
      expect(
        result.diagnostics.some(
          (d) => d.code === "KAL4202" && d.message.includes("capture"),
        ),
      ).toBe(true);
    }
  });
});

describe("nested parallel scheduling", () => {
  test("recursive child calls complete with one worker and no root queue capacity", async () => {
    await built(
      `@params Number
@returns Number
fn fib n:
  if n < 2: n
  else: (await |fib| (n - 1)) + (await |fib| (n - 2))
export fn main: await |fib| 7`,
      async (runner) => {
        expect(
          await runBunProgram(runner, {
            ...options,
            maxWorkers: 1,
            maxQueuedTasks: 0,
          }),
        ).toBe(13);
      },
    );
  });
  test("nested maps finish when every worker has an awaiting parent", async () => {
    await built(
      `list Numbers: Number
@params Number
fn double n: n * 2
@params Numbers
@returns Numbers
fn batch values: values -> * [await] |double|
export fn main: [[1 2] [3 4]] -> * [await] |batch|`,
      async (runner) => {
        for (const maxWorkers of [1, 2])
          expect(
            await runBunProgram(runner, { ...options, maxWorkers }),
          ).toEqual([
            [2, 4],
            [6, 8],
          ]);
      },
    );
  });
  test("children snapshot the invoking task's captures, not the parent application's values", async () => {
    await built(
      `type State:
  Number value
State state = State 1
@returns Number
fn child: state.value
@params Number
@returns Number
fn parent n:
  state.value = n
  first = |child| ()
  state.value = n + 10
  a = await first
  b = await |child| ()
  a + b
export fn main:
  values = [2 3] -> * [await] |parent|
  [values[0] values[1] state.value]`,
      async (runner) => {
        expect(
          await runBunProgram(runner, { ...options, maxWorkers: 1 }),
        ).toEqual([14, 16, 1]);
      },
    );
  });
  test("imported child targets and async helpers resolve from nested directories", async () => {
    await built(
      {
        "main.kalandra": `from "./nested/parent" import parent
export fn main: await |parent| 20`,
        "nested/parent.kalandra": `from "../child" import child as leaf
@params Number
@returns Number
export fn parent n: await |leaf| n`,
        "child.kalandra": `Number offset = 2
@params Number
@returns Number
export fn child n: n * 2 + offset`,
      },
      async (runner) => {
        expect(await runBunProgram(runner, { ...options, maxWorkers: 1 })).toBe(
          42,
        );
      },
    );
  });
  test("unawaited descendants drain before a parent result is delivered", async () => {
    await built(
      `@params Number
fn child n: n + 1
@returns Number
fn parent:
  |child| 1
  42
export fn main: await |parent| ()`,
      async (runner) => {
        expect(await runBunProgram(runner, { ...options, maxWorkers: 1 })).toBe(
          42,
        );
      },
    );
  });
  test("unknown child arguments and results still fail at compile time", async () => {
    const result = await compileSources({
      "main.kalandra": `@params Any
@returns Any
fn child n: n
@returns Number
fn parent:
  await |child| 1
  42
export fn main: await |parent| ()`,
    });
    expect(result.output).toBeUndefined();
    expect(result.diagnostics.some((d) => d.code === "KAL4202")).toBe(true);
  });
});

test("nested task limits fail promptly instead of deadlocking", async () => {
  await built(
    `@params Number
@returns Number
fn recurse n:
  if n < 1: n
  else: await |recurse| (n - 1)
export fn main: await |recurse| 8`,
    async (runner) => {
      await expect(
        runBunProgram(runner, { ...options, maxWorkers: 1, maxTaskDepth: 3 }),
      ).rejects.toMatchObject({ code: "NESTING_LIMIT" });
      await expect(
        runBunProgram(runner, { ...options, maxWorkers: 1, maxNestedTasks: 2 }),
      ).rejects.toThrow(/limit/);
    },
  );
});

test("cancellation and deadlines terminate descendants on the same or another worker", async () => {
  await built(
    `${fib}
@returns Number
fn parent: await |fib| 45
export fn main: await |parent| ()`,
    async (runner) => {
      const program = await import(runner);
      for (const maxWorkers of [1, 2]) {
        for (const abort of [false, true]) {
          const pool = createBunWorkerPool({ ...options, maxWorkers });
          const controller = new AbortController();
          const timer = abort
            ? setTimeout(() => controller.abort(), 150)
            : undefined;
          try {
            await expect(
              program.run(
                (task: import("../packages/runtime/src/index.js").ModuleTask) =>
                  pool.run(task, {
                    timeoutMs: abort ? 5000 : 150,
                    signal: controller.signal,
                  }),
              ),
            ).rejects.toMatchObject({
              code: abort ? "TASK_CANCELLED" : "TASK_TIMEOUT",
            });
          } finally {
            if (timer) clearTimeout(timer);
            await pool.close();
          }
          expect(pool.stats.workers).toBe(0);
          expect(pool.stats.running).toBe(0);
          expect(pool.stats.queued).toBe(0);
        }
      }
    },
  );
});

test("a failed child cancels the root tree and unawaited child failures reach the caller", async () => {
  await built(
    `@params Number
@returns Number
fn child n:
  n.missing ()
  n
@returns Number
fn parent:
  |child| 1
  42
export fn main: await |parent| ()`,
    async (runner) => {
      for (const maxWorkers of [1, 2])
        await expect(
          runBunProgram(runner, { ...options, maxWorkers }),
        ).rejects.toMatchObject({ code: "TASK_FAILED" });
    },
  );
});

test("indexed writes stay isolated in nested task snapshots", async () => {
  await built(
    `list Numbers: Number
Numbers values = [1 2]
@params Numbers
@returns Numbers
fn child items:
  items[0] = 42
  items
@returns Numbers
fn parent:
  values[1] = 10
  result = await |child| values
  [result[0] result[1] values[0]]
export fn main:
  result = await |parent| ()
  [result[0] result[1] result[2] values[0] values[1]]`,
    async (runner) => {
      expect(
        await runBunProgram(runner, { ...options, maxWorkers: 1 }),
      ).toEqual([42, 10, 1, 1, 2]);
    },
  );
});

test("dynamic indexed writes through aliases cannot cross a Sia boundary", async () => {
  for (const value of [
    "values[0] = unknown ()",
    "alias = values\nalias[0] = unknown ()",
  ]) {
    const result = await compileSources({
      "main.kalandra": `list Numbers: Number\nNumbers values = [1]\n${value}\n@returns Numbers\nfn read: values\nexport fn main: await |read| ()`,
    });
    expect(result.output).toBeUndefined();
    expect(
      result.diagnostics.some(
        (d) => d.code === "KAL4202" && d.message.includes("capture"),
      ),
    ).toBe(true);
  }
});
