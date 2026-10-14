import { renderWorkflowSources } from "./workflow-guide.js";
import { readdir, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderGuide } from "../apps/website/src/lib/guide/render.js";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const templates = resolve(root, "apps/website/guide");
const destination = resolve(root, "apps/website/src/docs/guide");
await mkdir(destination, { recursive: true });
for (const name of await readdir(templates)) {
  if (!name.endsWith(".tiramisu")) continue;
  const source = await Bun.file(resolve(templates, name)).text();
  await writeFile(
    resolve(destination, name),
    renderGuide(await renderWorkflowSources(source, root)),
  );
}
console.log("Built Tiramisu guide pages from tested examples.");
