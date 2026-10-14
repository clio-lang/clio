import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const files = {
  invoices: [
    "types.kalandra",
    "pricing.kalandra",
    "main.kalandra",
    "package.json",
    "vendor/invoice-math/index.js",
    "vendor/invoice-math/package.json",
    "vendor/invoice-math/kalandra.types.json",
  ],
  "local-batch": ["types.kalandra", "tasks.kalandra", "main.kalandra"],
  "remote-batch": [
    "service/main.kalandra",
    "client/main.kalandra",
    "client/failure.kalandra",
    "client/cancel.kalandra",
    "client/endpoints.json",
  ],
} as const;

/** Render the actual CLI-tested files rather than maintaining copied snippets. */
export async function renderWorkflowSources(
  template: string,
  root: string,
): Promise<string> {
  let result = template;
  for (const [name, paths] of Object.entries(files)) {
    const marker = `{{workflow:${name}}}`;
    if (!result.includes(marker)) continue;
    const blocks = await Promise.all(
      paths.map(async (path) => {
        const source = await readFile(
          resolve(root, "examples/workflows", name, path),
          "utf8",
        );
        if (source.includes('"""'))
          throw new Error("Workflow contains documentation quote delimiter");
        const language = path.endsWith(".kalandra")
          ? "kalandra"
          : path.endsWith(".js")
            ? "javascript"
            : "json";
        return `h3 { ${path} }\n\ncodeblock { language = ${language}, """${source}""" }`;
      }),
    );
    result = result.replaceAll(marker, blocks.join("\n\n"));
  }
  if (result.includes("{{workflow:"))
    throw new Error("Unknown workflow documentation source");
  return result;
}
