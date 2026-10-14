import {
  WorkerPool,
  type RuntimeOptions,
  type CancellationSignal,
  type ModuleTask,
} from "../../src/index.js";
import { createWorkerEndpoint } from "../../src/worker-endpoint.js";

export interface BrowserRuntimeOptions extends RuntimeOptions {
  /** Bundled module worker entry. Defaults to worker.js beside this built module. */
  readonly workerUrl?: string | URL;
  /** Classic requires a self-contained worker bundle (for opaque-origin frames). */
  readonly workerType?: "module" | "classic";
  /** Resolve virtual task URLs to host-created module URLs; copied at pool creation. */
  readonly moduleUrls?: ReadonlyMap<string, string>;
}

export function browserModuleUrl(value: string | URL): string {
  const url = new URL(value);
  if (!["http:", "https:", "blob:"].includes(url.protocol))
    throw new TypeError(
      "Browser modules require an absolute HTTP(S) or blob URL",
    );
  return url.href;
}

/** Dedicated module workers; compiled tasks always use Sia, never structured data. */
export function createBrowserWorkerPool(
  options: BrowserRuntimeOptions,
): WorkerPool {
  const workerUrl = browserModuleUrl(
    options.workerUrl ?? new URL("./worker.js", import.meta.url),
  );
  const workerType = options.workerType ?? "module";
  const maxChildren = options.maxNestedTasks ?? 256;
  const moduleUrls = new Map(options.moduleUrls);
  return new WorkerPool(
    {
      schedule(callback, milliseconds) {
        const timer = setTimeout(callback, milliseconds);
        return () => clearTimeout(timer);
      },
      createWorker() {
        const worker = new Worker(workerUrl, {
          type: workerType,
          name: `kalandra:${maxChildren}`,
        });
        const bridge = createWorkerEndpoint({
          send: (message) => worker.postMessage(message),
          async terminate() {
            worker.removeEventListener("message", message);
            worker.removeEventListener("error", failure);
            worker.removeEventListener("messageerror", messageFailure);
            worker.terminate();
          },
        });
        const message = (event: MessageEvent) => bridge.receive(event.data);
        const failure = (event: ErrorEvent) => {
          event.preventDefault();
          bridge.fail(
            new Error(
              event.message || "Browser worker failed to load or execute",
            ),
          );
        };
        const messageFailure = () =>
          bridge.fail(new Error("Browser worker message could not be decoded"));
        worker.addEventListener("message", message);
        worker.addEventListener("error", failure);
        worker.addEventListener("messageerror", messageFailure);
        return {
          ...bridge.endpoint,
          send(request) {
            bridge.endpoint.send({
              ...request,
              task: {
                ...request.task,
                module:
                  moduleUrls.get(request.task.module) ?? request.task.module,
              },
            });
          },
        };
      },
    },
    options,
  );
}

export interface BrowserProgramOptions extends BrowserRuntimeOptions {
  readonly exportName?: string;
  readonly args?: readonly unknown[];
  /** Per-root deadline including queue time and descendants; defaults to 30 seconds. */
  readonly taskTimeoutMs?: number;
  readonly signal?: CancellationSignal;
}

/** Invoke a generated program over HTTP(S), and always terminate its worker pool. */
export async function runBrowserProgram(
  runner: string,
  options: BrowserProgramOptions,
): Promise<unknown> {
  const url = browserModuleUrl(runner);
  const timeoutMs = options.taskTimeoutMs ?? 30_000;
  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 2_147_483_647
  )
    throw new TypeError("taskTimeoutMs must be a positive 32-bit integer");
  const pool = createBrowserWorkerPool(options);
  try {
    const program = await import(/* @vite-ignore */ url);
    return await program.run(
      (task: ModuleTask) => {
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
