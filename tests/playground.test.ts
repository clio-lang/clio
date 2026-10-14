import { expect, test } from "bun:test";
import { compileProject } from "../packages/compiler/src/index.js";
import {
  linkModules,
  virtualBase,
} from "../apps/website/src/lib/playground/link.js";
import { display } from "../apps/website/src/lib/playground/display.js";
import { examples } from "../apps/website/src/lib/playground/examples.js";

test("playground examples compile and generated graphs link without rewriting literal text", async () => {
  for (const example of examples) {
    const result = await compileProject("main.kalandra", {
      async readSource(path) {
        return path === "main.kalandra" ? example.source : null;
      },
    });
    expect(
      result.diagnostics.filter((item) => item.severity === "error"),
    ).toEqual([]);
    expect(result.output).toBeDefined();
    const created: string[] = [];
    const linked = linkModules(
      result.output!.files,
      result.output!.runner,
      (code) => {
        created.push(code);
        return "blob:test/" + created.length;
      },
    );
    expect(Object.keys(linked.modules)).toHaveLength(result.output!.files.size);
    expect(linked.runner).toStartWith("blob:test/");
  }
  const created: string[] = [];
  linkModules(
    new Map([
      [
        "main.mjs",
        { code: 'import "./helper.mjs"; export const text = "./helper.mjs";' },
      ],
      ["helper.mjs", { code: "export const x = 1;" }],
    ]),
    "main.mjs",
    (code) => {
      created.push(code);
      return "blob:test/" + created.length;
    },
  );
  expect(created[1]).toBe(
    'import "blob:test/1"; export const text = "./helper.mjs";',
  );
});

test("playground linker handles recursive task URL edges but rejects external and cyclic imports", () => {
  const created: string[] = [];
  const result = linkModules(
    new Map([
      [
        "task.mjs",
        {
          code: 'export const target = new URL("./task.mjs", import.meta.url).href;',
        },
      ],
    ]),
    "task.mjs",
    (code) => {
      created.push(code);
      return "blob:test/task";
    },
  );
  expect(result.modules[virtualBase + "task.mjs"]).toBe("blob:test/task");
  expect(created[0]).toContain(virtualBase + "task.mjs");
  for (const code of [
    'import "https://example.com/code.js";',
    'import "./main.mjs";',
    'import("./missing.mjs")',
  ]) {
    expect(() =>
      linkModules(new Map([["main.mjs", { code }]]), "main.mjs", () => ""),
    ).toThrow();
  }
});

test("playground output formatting bounds text, handles cycles and avoids getters", () => {
  const value = {
    n: -0,
    self: undefined as unknown,
    get danger() {
      throw new Error("getter called");
    },
  };
  value.self = value;
  expect(display(value)).toContain("[Circular]");
  expect(display(value)).toContain("[Getter]");
  expect(display(value)).toContain("-0");
  expect(display("a".repeat(10000), 100).length).toBeLessThanOrEqual(101);
  expect(display(NaN)).toBe("NaN");
});
