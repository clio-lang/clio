import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createBunWorkerPool } from "../packages/runtime/hosts/bun/index.js";

const file = process.argv[2];
if (!file)
  throw new Error(
    "Pass the path to the built worker-tasks.kalandra.mjs module",
  );
const module = pathToFileURL(resolve(file)).href;
const pool = createBunWorkerPool({ maxWorkers: 2, maxQueuedTasks: 4 });
try {
  const results = await Promise.all(
    [20, 21, 22, 23].map((n) =>
      pool.run({ module, exportName: "fib", args: [n] }, { timeoutMs: 10_000 }),
    ),
  );
  console.log(results);
} finally {
  await pool.close();
}
