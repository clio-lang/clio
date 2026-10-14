import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";
import { browserDefines } from "./browser-build-options.js";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outdir = resolve(root, "apps/website/static/playground");
await mkdir(outdir, { recursive: true });
for (const [name, entry, format] of [
  ["sandbox", "apps/website/src/lib/playground/sandbox.ts", "iife"],
  ["compiler", "apps/website/src/lib/playground/compiler.worker.ts", "iife"],
  ["worker", "packages/runtime/hosts/browser/worker.ts", "iife"],
] as const) {
  const result = await Bun.build({
    entrypoints: [resolve(root, entry)],
    target: "browser",
    format,
    define: browserDefines,
    minify: true,
  });
  if (!result.success) throw new Error(result.logs.join("\n"));
  await Bun.write(resolve(outdir, name + ".js"), result.outputs[0]!);
}
console.log("Built isolated playground assets.");
