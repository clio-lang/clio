import { fileURLToPath } from "node:url";
import { WorkerPool, type RuntimeOptions } from "../../src/index.js";
import { createWorkerEndpoint } from "../../src/worker-endpoint.js";

/** Bun process workers: hard cancellation waits for confirmed OS process exit. */
export function createBunWorkerPool(
  options: RuntimeOptions & {
    readonly workerEnv?: Record<string, string | undefined>;
  },
): WorkerPool {
  const maxChildren = options.maxNestedTasks ?? 256;
  return new WorkerPool(
    {
      schedule(callback, milliseconds) {
        const timer = setTimeout(callback, milliseconds);
        return () => clearTimeout(timer);
      },
      createWorker() {
        const entry = fileURLToPath(
          new URL(
            import.meta.url.endsWith(".ts") ? "./worker.ts" : "./worker.js",
            import.meta.url,
          ),
        );
        const worker = Bun.spawn(
          [process.execPath, entry, String(maxChildren)],
          {
            ...(options.workerEnv ? { env: options.workerEnv } : {}),
            stdin: "ignore",
            stdout: "inherit",
            stderr: "inherit",
            serialization: "advanced",
            ipc: (message) => bridge.receive(message),
          },
        );
        const bridge = createWorkerEndpoint(
          {
            send: (message) => worker.send(message),
            async terminate() {
              if (worker.exitCode === null) worker.kill("SIGKILL");
              await worker.exited;
            },
          },
          true,
        );
        void worker.exited.then(
          (code) =>
            bridge.fail(new Error(`Worker exited unexpectedly (${code})`)),
          (error) => bridge.fail(error),
        );
        return bridge.endpoint;
      },
    },
    options,
  );
}

export interface BunProgramOptions extends RuntimeOptions {
  readonly exportName?: string;
  readonly args?: readonly unknown[];
  /** Per-root deadline, including queue time and all descendants. Defaults to 30 seconds. */
  readonly taskTimeoutMs?: number;
  readonly signal?: import("../../src/index.js").CancellationSignal;
}

/** Invoke a generated .kalandra/program.mjs and always reap its worker processes. */
export async function runBunProgram(
  runner: string,
  options: BunProgramOptions,
): Promise<unknown> {
  if (new URL(runner).protocol !== "file:")
    throw new TypeError("Program runner must be a file URL");
  const timeoutMs = options.taskTimeoutMs ?? 30_000;
  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 2_147_483_647
  )
    throw new TypeError("taskTimeoutMs must be a positive 32-bit integer");
  const pool = createBunWorkerPool(options);
  try {
    const program = await import(runner);
    return await program.run(
      (task: import("../../src/index.js").ModuleTask) => {
        if (!task.schema)
          throw new TypeError(
            "Compiled parallel tasks require a Sia schema; rebuild the program",
          );
        return pool.run(task, {
          timeoutMs,
          ...(options.signal ? { signal: options.signal } : {}),
        });
      },
      options.exportName ?? "main",
      options.args ?? [],
    );
  } finally {
    await pool.close();
  }
}
