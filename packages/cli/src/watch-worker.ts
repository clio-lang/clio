import { assetState } from "./assets.js";
import { resolve } from "node:path";
import { buildProject } from "./build.js";
import { readInput, treeState, type WatchInput } from "./watch-inputs.js";

// Let the parent finish the active build when the terminal signals the whole process group.
process.on("SIGINT", () => {});
process.on("SIGTERM", () => {});

const [entry, output, strict, report] = Bun.argv.slice(2);
if (!entry || !output || !report)
  throw new Error("Missing watch worker arguments");
const inputs = new Map<string, WatchInput>();
let success = false;
try {
  success = !!(await buildProject(entry, output, strict === "true", false, {
    async read(path) {
      path = resolve(path);
      const result = await readInput(path);
      if (!inputs.has(`file:${path}`))
        inputs.set(`file:${path}`, { path, kind: "file", state: result.state });
      if (result.error) throw result.error;
      return result.text;
    },
    async assets(path) {
      inputs.set(`assets:${path}`, {
        path,
        kind: "assets",
        state: await assetState(path, resolve(output)),
      });
    },
    async directory(path) {
      if (!inputs.has(`tree:${path}`))
        inputs.set(`tree:${path}`, {
          path,
          kind: "tree",
          state: await treeState(path, resolve(output)),
        });
    },
  }));
} catch (error) {
  console.error(
    `Build failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
} finally {
  await Bun.write(
    report,
    JSON.stringify({ success, inputs: [...inputs.values()] }),
  );
}
