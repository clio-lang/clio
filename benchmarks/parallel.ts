import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runBunProgram } from "../packages/runtime/hosts/bun/index.js";

const root = resolve(import.meta.dir, "..");
const build = Bun.spawnSync(
  [
    process.execPath,
    "run",
    "cli",
    "build",
    "benchmarks/languages/parallel.kalandra",
    "-o",
    "benchmarks/.build/parallel",
  ],
  { cwd: root, stdout: "pipe", stderr: "pipe" },
);
if (build.exitCode) throw new Error(new TextDecoder().decode(build.stderr));
const runner = pathToFileURL(
  resolve(root, "benchmarks/.build/parallel/.kalandra/program.mjs"),
).href;
const results: { workers: number; milliseconds: number; result: unknown }[] =
  [];
// Alternate order. Every observation creates and closes a fresh pool.
for (let trial = 0; trial < 5; trial++) {
  for (const workers of trial % 2 ? [4, 1] : [1, 4]) {
    const start = performance.now();
    const result = await runBunProgram(runner, {
      maxWorkers: workers,
      maxQueuedTasks: 16,
      taskTimeoutMs: 30000,
    });
    const milliseconds = performance.now() - start;
    if (
      JSON.stringify(result) !==
      JSON.stringify([5702887, 5702887, 5702887, 5702887])
    )
      throw new Error(`Unexpected result: ${JSON.stringify(result)}`);
    results.push({ workers, milliseconds, result });
    console.log(JSON.stringify({ trial, workers, milliseconds }));
  }
}
await Bun.write(
  resolve(root, "benchmarks/results/2026-10-13-parallel.json"),
  JSON.stringify(
    {
      runtime: Bun.version,
      workload: "Four independent fib(34) tasks",
      scope:
        "Kalandra pool lifecycle wall time, including fresh worker startup, compilation excluded. Separate from warmed serial kernels.",
      results,
    },
    null,
    2,
  ) + "\n",
);
