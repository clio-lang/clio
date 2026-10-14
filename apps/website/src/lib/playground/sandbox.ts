import { createBrowserWorkerPool } from "../../../../../packages/runtime/hosts/browser/index.js";
import type {
  WorkerPool,
  ModuleTask,
} from "../../../../../packages/runtime/src/index.js";

let port: MessagePort;
let worker: Worker | undefined;
let pool: WorkerPool | undefined;
let stopped = false;
let initialized = false;
let messages = 0;
let outputSize = 0;
let taskCount = 0;
const ids = new Set<number>();
const urls = new Set<string>();
const blob = (code: string) => {
  const url = URL.createObjectURL(
    new Blob([code], { type: "text/javascript" }),
  );
  urls.add(url);
  return url;
};
const emit = (message: unknown) => {
  if (!stopped) port.postMessage(message);
};
async function finish(kind: string, text?: string) {
  if (stopped) return;
  stopped = true;
  worker?.terminate();
  try {
    await pool?.close();
  } finally {
    for (const url of urls) URL.revokeObjectURL(url);
    port.postMessage({ kind, text });
    port.close();
  }
}
window.addEventListener("message", function connect(event) {
  if (event.source !== parent || !event.ports[0] || initialized) return;
  initialized = true;
  window.removeEventListener("message", connect);
  port = event.ports[0];
  port.onmessage = ({ data }) => {
    if (data?.kind === "stop") {
      void finish("stopped");
      return;
    }
    if (stopped || worker || data?.kind !== "start") return;
    const workerUrl = blob(data.taskWorker);
    worker = new Worker(blob(data.compilerWorker));
    worker.onerror = (event) => {
      event.preventDefault();
      void finish("error", event.message || "Execution worker failed.");
    };
    worker.onmessageerror = () => {
      void finish("error", "Unreadable worker response.");
    };
    worker.onmessage = ({ data: message }) => {
      if (stopped) return;
      if (++messages > 5000) {
        void finish("error", "Run exceeded its message limit.");
        return;
      }
      try {
        switch (message?.kind) {
          case "graph": {
            if (pool) throw new Error("Duplicate module graph");
            const entries = Object.entries(message.modules);
            if (
              entries.length > 256 ||
              entries.some(
                ([key, value]) =>
                  !key.startsWith("https://kalandra-playground.invalid/") ||
                  typeof value !== "string" ||
                  !value.startsWith("blob:"),
              )
            )
              throw new Error("Invalid generated module graph");
            const modules = new Map(entries as [string, string][]);
            for (const url of modules.values()) urls.add(url);
            pool = createBrowserWorkerPool({
              workerUrl,
              workerType: "classic",
              moduleUrls: modules,
              maxWorkers: 2,
              maxQueuedTasks: 32,
              maxNestedTasks: 64,
              maxTaskDepth: 16,
              valueLimits: {
                maxDataBytes: 1024 * 1024,
                maxNodes: 10000,
                maxDepth: 32,
              },
            });
            break;
          }
          case "task": {
            if (
              !pool ||
              !Number.isSafeInteger(message.id) ||
              ids.has(message.id) ||
              ++taskCount > 1000
            )
              throw new Error("Invalid or excessive task submission");
            ids.add(message.id);
            if (!message.task?.schema)
              throw new Error("Parallel tasks require a Sia schema");
            void pool.run(message.task as ModuleTask, { timeoutMs: 5000 }).then(
              (value) => {
                if (!stopped)
                  worker?.postMessage({ kind: "reply", id: message.id, value });
              },
              (error) => {
                if (!stopped)
                  worker?.postMessage({
                    kind: "reply",
                    id: message.id,
                    error: String(error),
                  });
              },
            );
            break;
          }
          case "output":
          case "result":
          case "error": {
            const text =
              typeof message.text === "string"
                ? message.text.slice(0, 4000)
                : "Invalid output";
            outputSize += text.length;
            if (outputSize > 65536) {
              void finish("error", "Run exceeded its output limit.");
              return;
            }
            if (message.kind === "output") emit({ kind: "output", text });
            else void finish(message.kind, text);
            break;
          }
          case "diagnostics":
            emit({
              kind: "diagnostics",
              diagnostics: Array.isArray(message.diagnostics)
                ? message.diagnostics.slice(0, 100)
                : [],
            });
            break;
          case "running":
            emit({ kind: "running" });
            break;
          case "invalid":
            void finish("invalid");
            break;
          default:
            throw new Error("Unexpected worker message");
        }
      } catch (error) {
        void finish("error", String(error));
      }
    };
    worker.postMessage({ kind: "run", source: data.source });
  };
});
parent.postMessage({ kalandraReady: (globalThis as any).__kalandraToken }, "*");
