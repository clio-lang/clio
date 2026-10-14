import { renderWorkflowSources } from "../scripts/workflow-guide.js";
import { expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { compileProject } from "../packages/compiler/src/index.js";
import { runBunProgram } from "../packages/runtime/hosts/bun/index.js";
import { guideExamples } from "../apps/website/src/lib/guide/examples.js";
import { renderGuide } from "../apps/website/src/lib/guide/render.js";
import {
  examples,
  playgroundExampleIndex,
} from "../apps/website/src/lib/playground/examples.js";

for (const example of guideExamples) {
  test(`language guide executes: ${example.name}`, async () => {
    const compiled = await compileProject(
      "main.kalandra",
      {
        async readSource(path) {
          return example.files[path] ?? null;
        },
      },
      { strictNames: true },
    );
    expect(compiled.diagnostics).toEqual([]);
    expect(compiled.output).toBeDefined();
    const root = await mkdtemp(join(tmpdir(), "kalandra-guide-"));
    try {
      for (const [path, file] of compiled.output!.files) {
        await mkdir(dirname(join(root, path)), { recursive: true });
        await Bun.write(join(root, path), file.code);
      }
      const result = await runBunProgram(
        pathToFileURL(join(root, compiled.output!.runner)).href,
        {
          maxWorkers: 1,
          maxQueuedTasks: 16,
          taskTimeoutMs: 5000,
        },
      );
      expect(result).toEqual(example.expected);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}
test("guide templates render canonical sources and only link compatible playground examples", async () => {
  const ids = new Set<string>();
  for (const file of await readdir("apps/website/guide")) {
    const template = await readFile(join("apps/website/guide", file), "utf8");
    const rendered = renderGuide(
      await renderWorkflowSources(template, process.cwd()),
    );
    expect(rendered).not.toContain("{{workflow:");
    expect(rendered).not.toContain("{{example:");
    for (const match of template.matchAll(/\{\{example:([a-z-]+)\}\}/g)) {
      const id = match[1]!;
      ids.add(id);
      const example = guideExamples.find((example) => example.id === id)!;
      for (const source of Object.values(example.files))
        expect(rendered).toContain(source);
      if (example.browser) {
        const query = "?example=guide-" + id;
        expect(rendered).toContain("/docs/playground" + query);
        const target = examples[playgroundExampleIndex(query)]!;
        expect(target.id).toBe("guide-" + id);
        expect(target.source).toBe(example.files["main.kalandra"]!);
      } else expect(rendered).not.toContain("Try in playground");
    }
  }
  expect([...ids].sort()).toEqual(
    guideExamples.map((example) => example.id).sort(),
  );
  expect(new Set(examples.map((example) => example.id)).size).toBe(
    examples.length,
  );
  expect(playgroundExampleIndex("?example=unknown")).toBe(0);
  expect(playgroundExampleIndex("?source=untrusted")).toBe(0);
  expect(() => renderGuide("{{example:unknown}}")).toThrow(
    "Unknown guide example",
  );
});
test("documented type and parallel-boundary failures remain compiler errors", async () => {
  for (const [source, code] of [
    ['export fn main:\n  Number n = "wrong"\n  n', "KAL3111"],
    [
      guideExamples
        .find((example) => example.id === "parallel")!
        .files["main.kalandra"]!.replace("@params Number\n", ""),
      "KAL4202",
    ],
  ]) {
    const result = await compileProject("main.kalandra", {
      async readSource() {
        return source!;
      },
    });
    expect(result.output).toBeUndefined();
    expect(
      result.diagnostics.some((d) => d.code === code && d.severity === "error"),
    ).toBe(true);
  }
});
