import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import {
  WorkerPool,
  RuntimeError,
  snapshotValue,
  type WorkerEndpoint,
  type WorkerRequest,
  type TaskValue,
} from "../packages/runtime/src/index.js";
import { createBunWorkerPool } from "../packages/runtime/hosts/bun/index.js";
import { compileProject } from "../packages/compiler/src/index.js";

async function fixture(run: (module: string, dir: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), "kalandra-workers-"));
  try {
    const path = join(dir, "tasks.mjs");
    await Bun.write(
      path,
      `
export function identify(){return process.pid;}
export async function delayed(value,ms){await new Promise(resolve=>setTimeout(resolve,ms));return value;}
export function spin(){while(true){}}
export function crash(){process.exit(0);}
export function fail(){throw new TypeError("task broke");}
export async function reject(){throw new Error("async broke");}
export function unprintable(){throw {toString(){throw new Error("no");}};}
export function invalid(){return ()=>1;}
export function echo(value){return value;}
let counter=0;export function count(){return ++counter;}
`,
    );
    await run(pathToFileURL(path).href, dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
const code = (value: unknown, expected: RuntimeError["code"]) => {
  expect(value).toBeInstanceOf(RuntimeError);
  expect((value as RuntimeError).code).toBe(expected);
};

describe("Bun local workers", () => {
  test("executes compiled Clio functions in distinct processes", () =>
    fixture(async (_, dir) => {
      const result = await compileProject("tasks.kalandra", {
        async readSource() {
          return 'from "esm:node:process" import pid\nexport fn worker: pid\nexport fn fib n:\n  if n < 2: n\n  else: (fib n - 1) + (fib n - 2)';
        },
      });
      expect(result.output).toBeDefined();
      for (const [path, file] of result.output!.files) {
        await mkdir(dirname(join(dir, path)), { recursive: true });
        await Bun.write(join(dir, path), file.code);
      }
      const module = pathToFileURL(join(dir, result.output!.entry)).href;
      const pool = createBunWorkerPool({ maxWorkers: 2, maxQueuedTasks: 8 });
      try {
        const ids = await Promise.all([
          pool.run({ module, exportName: "worker", args: [] }),
          pool.run({ module, exportName: "worker", args: [] }),
        ]);
        expect(new Set(ids).size).toBe(2);
        expect(ids.every((id) => typeof id === "number" && id > 0)).toBe(true);
        expect(
          await Promise.all(
            [20, 21, 22].map((n) =>
              pool.run({ module, exportName: "fib", args: [n] }),
            ),
          ),
        ).toEqual([6765, 10946, 17711]);
        expect(pool.stats.workers).toBe(2);
        expect(pool.stats.running).toBe(0);
      } finally {
        await pool.close();
      }
      expect(pool.stats.workers).toBe(0);
    }));
  test("queue limits and snapshotting are enforced before dispatch", () =>
    fixture(async (module) => {
      const pool = createBunWorkerPool({ maxWorkers: 1, maxQueuedTasks: 1 });
      try {
        const first = pool.run({
          module,
          exportName: "delayed",
          args: [1, 40],
        });
        const args: TaskValue[] = [{ x: 2 }];
        const next = pool.run({ module, exportName: "echo", args });
        (args[0] as { x: number }).x = 99;
        code(
          await pool
            .run({ module, exportName: "identify", args: [] })
            .catch((e) => e),
          "QUEUE_FULL",
        );
        expect(await first).toBe(1);
        expect(await next).toEqual({ x: 2 });
      } finally {
        await pool.close();
      }
    }));
  test("queued aborts do not execute, and running cancellation kills the worker", () =>
    fixture(async (module) => {
      const pool = createBunWorkerPool({ maxWorkers: 1, maxQueuedTasks: 3 });
      try {
        const runningController = new AbortController(),
          queuedController = new AbortController();
        const running = pool
          .run(
            { module, exportName: "spin", args: [] },
            { signal: runningController.signal },
          )
          .catch((e) => e);
        const queued = pool
          .run(
            { module, exportName: "count", args: [] },
            { signal: queuedController.signal },
          )
          .catch((e) => e);
        queuedController.abort();
        code(await queued, "TASK_CANCELLED");
        runningController.abort();
        code(await running, "TASK_CANCELLED");
        expect(
          await pool.run(
            { module, exportName: "count", args: [] },
            { timeoutMs: 5000 },
          ),
        ).toBe(1);
        expect(pool.stats.workers).toBe(1);
      } finally {
        await pool.close();
      }
    }));
  test("deadlines cover queue wait and noncooperative execution", () =>
    fixture(async (module) => {
      const pool = createBunWorkerPool({ maxWorkers: 1, maxQueuedTasks: 2 });
      try {
        const running = pool
          .run({ module, exportName: "spin", args: [] }, { timeoutMs: 100 })
          .catch((e) => e);
        const queued = pool
          .run({ module, exportName: "count", args: [] }, { timeoutMs: 10 })
          .catch((e) => e);
        code(await queued, "TASK_TIMEOUT");
        code(await running, "TASK_TIMEOUT");
        expect(
          await pool.run(
            { module, exportName: "count", args: [] },
            { timeoutMs: 5000 },
          ),
        ).toBe(1);
      } finally {
        await pool.close();
      }
    }));
  test("throws, rejected promises, bad exports and invalid results settle callers", () =>
    fixture(async (module) => {
      const pool = createBunWorkerPool({ maxWorkers: 1, maxQueuedTasks: 1 });
      try {
        for (const exportName of [
          "fail",
          "reject",
          "unprintable",
          "invalid",
          "missing",
        ]) {
          const error = await pool
            .run({ module, exportName, args: [] }, { timeoutMs: 5000 })
            .catch((e) => e);
          code(error, "TASK_FAILED");
        }
        const error = await pool
          .run({ module, exportName: "fail", args: [] })
          .catch((e) => e);
        expect(error.remoteName).toBe("TypeError");
        expect(error.remoteStack).toContain("task broke");
        expect(await pool.run({ module, exportName: "echo", args: [42] })).toBe(
          42,
        );
      } finally {
        await pool.close();
      }
    }));
  test("unexpected exits reject the task, replace capacity, and never retry", () =>
    fixture(async (module) => {
      const pool = createBunWorkerPool({ maxWorkers: 1, maxQueuedTasks: 1 });
      try {
        const crash = pool
          .run({ module, exportName: "crash", args: [] }, { timeoutMs: 5000 })
          .catch((e) => e);
        const next = pool.run(
          { module, exportName: "count", args: [] },
          { timeoutMs: 5000 },
        );
        code(await crash, "WORKER_FAILED");
        expect(await next).toBe(1);
      } finally {
        await pool.close();
      }
    }));
  test("close rejects active and queued calls and waits for worker cleanup", () =>
    fixture(async (module) => {
      const pool = createBunWorkerPool({ maxWorkers: 1, maxQueuedTasks: 1 });
      const first = pool
        .run({ module, exportName: "spin", args: [] })
        .catch((e) => e);
      const second = pool
        .run({ module, exportName: "count", args: [] })
        .catch((e) => e);
      const closing = pool.close();
      expect(pool.close()).toBe(closing);
      code(await first, "POOL_CLOSED");
      code(await second, "POOL_CLOSED");
      await closing;
      expect(pool.stats).toEqual({
        workers: 0,
        running: 0,
        queued: 0,
        stopping: 0,
        closed: true,
      });
      code(
        await pool
          .run({ module, exportName: "count", args: [] })
          .catch((e) => e),
        "POOL_CLOSED",
      );
    }));
  test("plain data round trips without losing floating point or byte ownership", () =>
    fixture(async (module) => {
      const pool = createBunWorkerPool({ maxWorkers: 1, maxQueuedTasks: 0 });
      try {
        const input = {
          values: [
            undefined,
            null,
            true,
            1.25,
            NaN,
            Infinity,
            -0,
            2n,
            "سلام 🌍",
          ],
          bytes: new Uint8Array([0, 128, 255]),
        };
        const output = await pool.run({
          module,
          exportName: "echo",
          args: [input],
        });
        expect(output).toEqual(input);
        expect((output as typeof input).bytes).not.toBe(input.bytes);
      } finally {
        await pool.close();
      }
    }));
});

describe("task data and host contracts", () => {
  test("invalid data is rejected without evaluating getters", () => {
    let called = false;
    const getter = {
      get x() {
        called = true;
        return 1;
      },
    };
    for (const value of [
      () => 1,
      Symbol("x"),
      new Date(),
      new Map(),
      new Set(),
      getter,
      [, 1],
      new Uint8Array(new SharedArrayBuffer(4)),
    ])
      expect(() => snapshotValue(value)).toThrow();
    expect(called).toBe(false);
    const cycle: any = {};
    cycle.x = cycle;
    expect(() => snapshotValue(cycle)).toThrow("cycles");
    const value = JSON.parse('{"__proto__":{"x":1}}');
    expect(Object.hasOwn(snapshotValue(value) as object, "__proto__")).toBe(
      true,
    );
    expect(() =>
      snapshotValue("long", { maxDataBytes: 8, maxDepth: 2, maxNodes: 4 }),
    ).toThrow();
  });
  test("terminating workers retain capacity; failed termination closes the pool", async () => {
    let failStop: (error: unknown) => void = () => {};
    let created = 0;
    const endpoint: WorkerEndpoint = {
      subscribe() {
        return () => {};
      },
      send() {},
      terminate() {
        return new Promise((_, reject) => {
          failStop = reject;
        });
      },
    };
    const pool = new WorkerPool(
      {
        createWorker() {
          created++;
          return endpoint;
        },
        schedule() {
          return () => {};
        },
      },
      { maxWorkers: 1, maxQueuedTasks: 1 },
    );
    const controller = new AbortController();
    const first = pool
      .run(
        { module: "test", exportName: "f", args: [] },
        { signal: controller.signal },
      )
      .catch((e) => e);
    controller.abort();
    code(await first, "TASK_CANCELLED");
    const queued = pool
      .run({ module: "test", exportName: "f", args: [] })
      .catch((e) => e);
    expect(created).toBe(1);
    expect(pool.stats.stopping).toBe(1);
    failStop(new Error("cannot stop"));
    code(await queued, "WORKER_FAILED");
    await expect(pool.close()).rejects.toThrow("could not be terminated");
    expect(created).toBe(1);
  });
  test("malformed replies fail their task and retire the worker", async () => {
    let reply: (message: unknown) => void = () => {};
    let stopped = 0;
    const pool = new WorkerPool(
      {
        createWorker() {
          return {
            subscribe(onMessage) {
              reply = onMessage;
              return () => {};
            },
            send(request: WorkerRequest) {
              reply({ kind: "result", id: request.id + 1, value: 1 });
            },
            async terminate() {
              stopped++;
            },
          };
        },
        schedule() {
          return () => {};
        },
      },
      { maxWorkers: 1, maxQueuedTasks: 0 },
    );
    code(
      await pool
        .run({ module: "test", exportName: "f", args: [] })
        .catch((e) => e),
      "WORKER_FAILED",
    );
    await pool.close();
    expect(stopped).toBe(1);
  });
});

test("pre-aborted tasks and invalid configuration never start workers", async () => {
  let created = 0;
  const host = {
    createWorker(): WorkerEndpoint {
      created++;
      throw new Error("not expected");
    },
    schedule() {
      return () => {};
    },
  };
  expect(
    () => new WorkerPool(host, { maxWorkers: 0, maxQueuedTasks: 1 }),
  ).toThrow();
  const options = { maxWorkers: 1, maxQueuedTasks: 0 };
  const pool = new WorkerPool(host, options);
  options.maxWorkers = 99;
  expect(pool.options.maxWorkers).toBe(1);
  const signal = AbortSignal.abort();
  code(
    await pool
      .run({ module: "x", exportName: "f", args: [] }, { signal })
      .catch((e) => e),
    "TASK_CANCELLED",
  );
  code(
    await pool
      .run({ module: "x", exportName: "f", args: [] }, { timeoutMs: 0 })
      .catch((e) => e),
    "INVALID_TASK",
  );
  code(
    await pool
      .run({
        module: "x",
        exportName: "f",
        args: [(() => 1) as unknown as TaskValue],
      })
      .catch((e) => e),
    "INVALID_TASK",
  );
  expect(created).toBe(0);
  await pool.close();
});

test("host startup and timer failures leave no pending tasks", async () => {
  const pool = new WorkerPool(
    {
      createWorker() {
        throw new Error("startup");
      },
      schedule() {
        throw new Error("timer");
      },
    },
    { maxWorkers: 1, maxQueuedTasks: 1 },
  );
  code(
    await pool.run({ module: "x", exportName: "f", args: [] }).catch((e) => e),
    "WORKER_FAILED",
  );
  code(
    await pool
      .run({ module: "x", exportName: "f", args: [] }, { timeoutMs: 1 })
      .catch((e) => e),
    "WORKER_FAILED",
  );
  expect(pool.stats.queued).toBe(0);
  await pool.close();
});

test("central child admission bypasses blocked roots without adding workers", async () => {
  const requests: WorkerRequest[] = [];
  const replies: unknown[] = [];
  let message!: (value: unknown) => void;
  let workers = 0;
  const pool = new WorkerPool(
    {
      schedule() {
        return () => {};
      },
      createWorker() {
        workers++;
        return {
          subscribe(receive) {
            message = receive;
            return () => {};
          },
          send(request) {
            requests.push(request);
          },
          reply(response) {
            replies.push(response);
          },
          async terminate() {},
        };
      },
    },
    { maxWorkers: 1, maxQueuedTasks: 1 },
  );
  const task = {
    module: "file:///test.mjs",
    exportName: "test",
    args: [],
    schema: { args: [], result: "number" as const },
  };
  try {
    const first = pool.run(task);
    const queued = pool.run(task);
    const parent = requests[0]!;
    message({ kind: "spawn", id: parent.id, requestId: 1, task });
    expect(workers).toBe(1);
    expect(requests.length).toBe(2);
    expect(pool.stats.queued).toBe(1);
    const child = requests[1]!;
    message({ kind: "result", id: child.id, value: 3 });
    await Promise.resolve();
    expect(replies).toEqual([{ kind: "result", id: 1, value: 3 }]);
    message({ kind: "result", id: parent.id, value: 4 });
    expect(await first).toBe(4);
    expect(requests.length).toBe(3);
    message({ kind: "result", id: requests[2]!.id, value: 5 });
    expect(await queued).toBe(5);
  } finally {
    await pool.close();
  }
});

test("a descendant worker crash rejects its root and restores bounded capacity", async () => {
  await fixture(async (module, directory) => {
    const { schemaKey } = await import("../packages/protocol/src/index.js");
    const schema = { args: [], result: "number" as const };
    const key = schemaKey(schema);
    await Bun.write(
      join(directory, "nested.mjs"),
      `
export const __kalandraSchemas = {parent: [${JSON.stringify(key)}], crash: [${JSON.stringify(key)}], ok: [${JSON.stringify(key)}]};
export const __kalandraContextTasks = ["parent"];
export function parent(dispatch) { return dispatch({module: import.meta.url, exportName: "crash", args: [], schema: ${JSON.stringify(schema)}}); }
export function crash() { process.exit(2); }
export function ok() { return 42; }
`,
    );
    const nested = pathToFileURL(join(directory, "nested.mjs")).href;
    for (const maxWorkers of [1, 2]) {
      const pool = createBunWorkerPool({ maxWorkers, maxQueuedTasks: 1 });
      try {
        await expect(
          pool.run(
            { module: nested, exportName: "parent", args: [], schema },
            { timeoutMs: 3000 },
          ),
        ).rejects.toMatchObject({ code: "WORKER_FAILED" });
        expect(
          await pool.run(
            { module: nested, exportName: "ok", args: [], schema },
            { timeoutMs: 3000 },
          ),
        ).toBe(42);
        expect(pool.stats.workers).toBeLessThanOrEqual(maxWorkers);
      } finally {
        await pool.close();
      }
      expect(pool.stats.workers).toBe(0);
    }
  });
});

test("remote descendants inherit root cancellation and settle only after host cleanup", async () => {
  let receive!: (message: unknown) => void;
  let parent!: WorkerRequest;
  let acknowledge!: (error: Error) => void;
  let aborted = false;
  let submitted = 0;
  const pool = new WorkerPool(
    {
      schedule: () => () => {},
      createWorker: () => ({
        subscribe: (listener) => {
          receive = listener;
          return () => {};
        },
        send: (request) => {
          parent = request;
        },
        reply: () => {},
        terminate: async () => {},
      }),
    },
    {
      maxWorkers: 1,
      maxQueuedTasks: 0,
      dispatchRemote: async (_task, signal) => {
        submitted++;
        return new Promise((_resolve, reject) => {
          acknowledge = reject;
          signal.addEventListener("abort", () => {
            aborted = true;
          });
        });
      },
    },
  );
  const controller = new AbortController();
  let settled = false;
  const result = pool
    .run(
      {
        module: "file:///worker.mjs",
        exportName: "work",
        args: [],
        schema: { args: [], result: "number" },
      },
      { signal: controller.signal },
    )
    .catch((error) => {
      settled = true;
      return error;
    });
  receive({
    kind: "spawn",
    id: parent.id,
    requestId: 1,
    task: {
      module: "kalandra-remote:contract/calculate",
      exportName: "calculate",
      args: [2],
      schema: { args: ["number"], result: "number" },
    },
  });
  await Promise.resolve();
  expect(submitted).toBe(1);
  controller.abort();
  await Promise.resolve();
  expect(aborted).toBe(true);
  expect(settled).toBe(false);
  let closed = false;
  const closing = pool.close().then(() => {
    closed = true;
  });
  await Promise.resolve();
  expect(closed).toBe(false);
  acknowledge(new Error("Remote call cancelled"));
  code(await result, "TASK_CANCELLED");
  await closing;
  expect(pool.stats.workers).toBe(0);
});

test("remote descendants obey nesting limits and report unconfirmed cleanup", async () => {
  for (const limit of [0, 1]) {
    let receive!: (message: unknown) => void;
    let deadline!: () => void;
    let parent!: WorkerRequest;
    let calls = 0;
    const pool = new WorkerPool(
      {
        schedule: (callback) => {
          deadline = callback;
          return () => {};
        },
        createWorker: () => ({
          subscribe: (listener) => {
            receive = listener;
            return () => {};
          },
          send: (request) => {
            parent = request;
          },
          reply: () => {},
          terminate: async () => {},
        }),
      },
      {
        maxWorkers: 1,
        maxQueuedTasks: 0,
        maxNestedTasks: limit,
        dispatchRemote: async (_task, signal) => {
          calls++;
          return new Promise((_resolve, reject) =>
            signal.addEventListener("abort", () =>
              reject(
                Object.assign(
                  new Error(
                    "Remote cancellation unconfirmed; execution outcome is unknown",
                  ),
                  { code: "REMOTE_CLEANUP_FAILED" },
                ),
              ),
            ),
          );
        },
      },
    );
    const result = pool
      .run(
        {
          module: "file:///worker.mjs",
          exportName: "work",
          args: [],
          schema: { args: [], result: "number" },
        },
        { timeoutMs: 100 },
      )
      .catch((error) => error);
    receive({
      kind: "spawn",
      id: parent.id,
      requestId: 1,
      task: {
        module: "kalandra-remote:contract/calculate",
        exportName: "calculate",
        args: [],
        schema: { args: [], result: "number" },
      },
    });
    await Promise.resolve();
    if (limit) {
      deadline();
      code(await result, "REMOTE_CLEANUP_FAILED");
      await expect(pool.close()).rejects.toThrow();
      expect(calls).toBe(1);
    } else {
      code(await result, "NESTING_LIMIT");
      await pool.close();
      expect(calls).toBe(0);
    }
  }
});
