import { compileProject } from "../../packages/compiler/src/index.js";
import type { TaskSchema } from "../../packages/protocol/src/index.js";
import type { WorkerPool } from "../../packages/runtime/src/index.js";

export async function verifyBrowserParallel(
  test: (name: string, run: () => unknown | Promise<unknown>) => Promise<void>,
  check: (actual: unknown, expected: unknown) => void,
) {
  const { createBrowserWorkerPool, runBrowserProgram } = (await import(
    /* @vite-ignore */ new URL("./runtime/index.js", location.href).href
  )) as typeof import("../../packages/runtime/hosts/browser/index.js");
  const workerUrl = new URL("./runtime/worker.js", location.href);
  const module = new URL("./tasks.js", location.href).href;
  const number: TaskSchema = { args: ["number"], result: "number" };
  const noArgs: TaskSchema = { args: [], result: "number" };
  const run = (
    pool: WorkerPool,
    exportName: string,
    args: number[] = [],
    schema = noArgs,
    timeoutMs = 5000,
  ) => pool.run({ module, exportName, args, schema }, { timeoutMs });
  const failure = async (promise: Promise<unknown>, expected: string) => {
    try {
      await promise;
    } catch (error) {
      check((error as { code: string }).code, expected);
      return;
    }
    throw new Error(`Expected ${expected}`);
  };
  const withPool = async (
    body: (pool: WorkerPool) => Promise<void>,
    maxWorkers = 1,
    maxQueuedTasks = 8,
  ) => {
    const pool = createBrowserWorkerPool({
      workerUrl,
      maxWorkers,
      maxQueuedTasks,
    });
    try {
      await body(pool);
    } finally {
      await pool.close();
      check(pool.stats, {
        workers: 0,
        running: 0,
        queued: 0,
        stopping: 0,
        closed: true,
      });
    }
  };
  await test("browser pool uses two workers and preserves float64 and UTF-16 through Sia", () =>
    withPool(async (pool) => {
      const ids = await Promise.all(
        [1, 2].map(() =>
          run(pool, "identify", [50], { args: ["number"], result: "string" }),
        ),
      );
      check(new Set(ids).size, 2);
      for (const value of [1.5, -0, NaN, Infinity, -Infinity]) {
        const result = await run(pool, "echo", [value], number);
        check(Object.is(result, value), true);
      }
      const value = "🌍\ud800";
      check(
        await pool.run({
          module,
          exportName: "text",
          args: [value],
          schema: { args: ["string"], result: "string" },
        }),
        value,
      );
    }, 2));
  for (const [name, expected] of [
    ["records", 8],
    ["captures", [4, 6, 8]],
    [
      "nested",
      [
        [2, 4],
        [6, 8],
      ],
    ],
  ] as const) {
    await test(`compiled browser program: ${name} over HTTP module graph`, async () => {
      const runner = new URL(
        `./programs/${name}/.kalandra/program.mjs`,
        location.href,
      ).href;
      const options = { workerUrl, maxWorkers: 1, maxQueuedTasks: 8 };
      check(await runBrowserProgram(runner, options), expected);
      check(await runBrowserProgram(runner, options), expected);
    });
  }
  await test("nested browser work makes progress with one worker and no waiting queue", async () => {
    // Call batch directly through the generated runner so only one root is admitted.
    const runner = new URL(
      "./programs/nested/.kalandra/program.mjs",
      location.href,
    ).href;
    check(
      await runBrowserProgram(runner, {
        workerUrl,
        maxWorkers: 1,
        maxQueuedTasks: 0,
        exportName: "single",
        args: [],
      }),
      [2, 4],
    );
  });
  await test("browser compiler rejects dynamic data at a parallel boundary", async () => {
    const result = await compileProject("main.kalandra", {
      async readSource() {
        return "fn echo value: value\nexport fn main: await |echo| 1";
      },
    });
    check(result.output, undefined);
    check(
      result.diagnostics.some((item) => item.code === "KAL4202"),
      true,
    );
  });
  await test("browser schema mismatches and task failures settle without dynamic fallback", () =>
    withPool(async (pool) => {
      await failure(
        run(pool, "echo", [1], { args: ["number"], result: "string" }),
        "TASK_FAILED",
      );
      await failure(run(pool, "invalid"), "TASK_FAILED");
      await failure(run(pool, "fail"), "TASK_FAILED");
      await failure(run(pool, "missing"), "TASK_FAILED");
      check(await run(pool, "echo", [42], number), 42);
      await failure(
        pool.run({ module, exportName: "echo", args: [1] }),
        "WORKER_FAILED",
      );
      check(await run(pool, "echo", [43], number), 43);
    }));
  await test("browser running cancellation kills CPU-bound work and permits replacement", () =>
    withPool(async (pool) => {
      const started = await (await fetch("./started-count")).json();
      const controller = new AbortController();
      const pending = failure(
        pool.run(
          { module, exportName: "spin", args: [], schema: noArgs },
          { signal: controller.signal, timeoutMs: 10_000 },
        ),
        "TASK_CANCELLED",
      );
      const deadline = Date.now() + 5000;
      while ((await (await fetch("./started-count")).json()) === started) {
        if (Date.now() > deadline) throw new Error("CPU task did not start");
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      controller.abort();
      await pending;
      check(await run(pool, "echo", [42], number), 42);
    }));
  await test("browser queue bounds, queued cancellation, deadline and close settle all work", () =>
    withPool(
      async (pool) => {
        const active = run(pool, "delay", [1, 100], {
          args: ["number", "number"],
          result: "number",
        });
        const controller = new AbortController();
        const queued = failure(
          pool.run(
            { module, exportName: "echo", args: [2], schema: number },
            { signal: controller.signal },
          ),
          "TASK_CANCELLED",
        );
        await failure(run(pool, "echo", [3], number), "QUEUE_FULL");
        controller.abort();
        await queued;
        check(await active, 1);
        await failure(run(pool, "spin", [], noArgs, 100), "TASK_TIMEOUT");
        check(await run(pool, "echo", [4], number), 4);
        const unfinished = failure(run(pool, "spin"), "POOL_CLOSED");
        await pool.close();
        await unfinished;
        await failure(run(pool, "echo", [5], number), "POOL_CLOSED");
      },
      1,
      1,
    ));
  await test("browser worker crashes fail work and recover on a replacement", () =>
    withPool(async (pool) => {
      await failure(run(pool, "crash"), "WORKER_FAILED");
      check(await run(pool, "echo", [42], number), 42);
    }));
  await test("browser malformed messages and startup failures reject and clean up", async () => {
    for (const filename of [
      "malformed-worker.js",
      "broken-worker.js",
      "missing-worker.js",
    ]) {
      const pool = createBrowserWorkerPool({
        workerUrl: new URL(filename, location.href),
        maxWorkers: 1,
        maxQueuedTasks: 0,
      });
      try {
        await failure(run(pool, "echo", [1], number), "WORKER_FAILED");
      } finally {
        await pool.close();
        check(pool.stats.workers, 0);
      }
    }
  });
  await test("managed browser runner terminates workers on success and main failure", async () => {
    const original = globalThis.Worker;
    const live = new Set<Worker>();
    let created = 0;
    globalThis.Worker = new Proxy(original, {
      construct(Target, args) {
        const worker = Reflect.construct(Target, args) as Worker;
        created++;
        live.add(worker);
        const terminate = worker.terminate.bind(worker);
        worker.terminate = () => {
          try {
            return terminate();
          } finally {
            live.delete(worker);
          }
        };
        return worker;
      },
    });
    try {
      const options = { maxWorkers: 1, maxQueuedTasks: 8 };
      check(
        await runBrowserProgram(
          new URL("./programs/records/.kalandra/program.mjs", location.href)
            .href,
          options,
        ),
        8,
      );
      check(live.size, 0);
      let failed = false;
      try {
        await runBrowserProgram(
          new URL("./failure-runner.js", location.href).href,
          options,
        );
      } catch (error) {
        check((error as Error).message, "main failed");
        failed = true;
      }
      check(failed, true);
      check(live.size, 0);
      check(created, 2);
    } finally {
      globalThis.Worker = original;
      for (const worker of live) worker.terminate();
    }
  });
}
