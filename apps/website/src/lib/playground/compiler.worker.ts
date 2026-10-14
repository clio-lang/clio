import { compileProject } from "../../../../../packages/compiler/src/index.js";
import { linkModules } from "./link.js";
import { display } from "./display.js";

const scope = globalThis as unknown as {
  postMessage(value: unknown): void;
  onmessage: ((event: MessageEvent) => void) | null;
};
const send = scope.postMessage.bind(scope);
let started = false;
let nextId = 1;
const pending = new Map<
  number,
  { resolve(value: unknown): void; reject(error: Error): void }
>();
let lines = 0;
for (const level of ["log", "info", "warn", "error"] as const) {
  console[level] = (...values: unknown[]) => {
    if (++lines <= 100)
      send({
        kind: "output",
        text: values
          .map((value) => display(value, 1000))
          .join(" ")
          .slice(0, 4000),
      });
    else if (lines === 101)
      send({ kind: "output", text: "Further console output omitted." });
  };
}
scope.onmessage = ({ data }) => {
  if (data?.kind === "reply") {
    const task = pending.get(data.id);
    if (!task) return;
    pending.delete(data.id);
    if (data.error) task.reject(new Error(String(data.error)));
    else task.resolve(data.value);
    return;
  }
  if (started || data?.kind !== "run") return;
  started = true;
  void run(data.source).catch((error) =>
    send({
      kind: "error",
      text: error instanceof Error ? error.message : display(error),
    }),
  );
};
async function run(source: unknown) {
  if (typeof source !== "string" || source.length > 65536)
    throw new Error("Source must be at most 64 KiB of text.");
  const result = await compileProject("main.kalandra", {
    async resolveExternal() {
      return null;
    },
    async readSource(path) {
      return path === "main.kalandra" ? source : null;
    },
  });
  send({ kind: "diagnostics", diagnostics: result.diagnostics.slice(0, 100) });
  if (!result.output) {
    send({ kind: "invalid" });
    return;
  }
  const graph = linkModules(result.output.files, result.output.runner, (code) =>
    URL.createObjectURL(new Blob([code], { type: "text/javascript" })),
  );
  send({ kind: "graph", modules: graph.modules });
  send({ kind: "running" });
  const program = await import(/* @vite-ignore */ graph.runner);
  const value = await program.run(
    (task: unknown) => {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        send({ kind: "task", id, task });
      });
    },
    "main",
    [],
  );
  send({ kind: "result", text: display(value) });
}
