import { test, expect } from "bun:test";
import { ProjectIndex } from "../packages/language-server/src/project-index.js";

test("index reuses unchanged graphs and refreshes transitive dependencies", async () => {
  const files: Record<string, string> = {
    "main.kalandra": 'from "./bridge" import answer\nanswer',
    "bridge.kalandra": 'from "./value" import answer\nexport answer',
    "value.kalandra": "export answer = 1",
  };
  const index = new ProjectIndex();
  const read = async (path: string) => files[path] ?? null;
  const first = await index.analyze("root", "main.kalandra", read);
  expect(await index.analyze("root", "main.kalandra", read)).toBe(first);
  files["value.kalandra"] = 'export answer = "changed"';
  const changed = await index.analyze("root", "main.kalandra", read);
  expect(changed).not.toBe(first);
  expect(
    changed.modules
      .get("main.kalandra")!
      .model.scopes[0]!.symbols.get("answer")!.type.kind,
  ).toBe("String");
  delete files["value.kalandra"];
  const removed = await index.analyze("root", "main.kalandra", read);
  expect(removed.diagnostics.some((item) => item.severity === "error")).toBe(
    true,
  );
  files["value.kalandra"] = "export answer = 2";
  const restored = await index.analyze("root", "main.kalandra", read);
  expect(restored.diagnostics).toEqual([]);
  expect(await index.analyze("root", "main.kalandra", read)).toBe(restored);
});

test("index isolates roots, evicts old graphs, and clears session state", async () => {
  const index = new ProjectIndex({}, 2);
  const read = async () => "value = 1";
  const a = await index.analyze("a", "main.kalandra", read);
  const b = await index.analyze("b", "main.kalandra", read);
  expect(b).not.toBe(a);
  expect(await index.analyze("a", "main.kalandra", read)).toBe(a);
  await index.analyze("c", "main.kalandra", read);
  expect(await index.analyze("b", "main.kalandra", read)).not.toBe(b);
  index.clear();
  expect(await index.analyze("a", "main.kalandra", read)).not.toBe(a);
});

test("clear prevents an in-flight graph from repopulating the cache", async () => {
  const index = new ProjectIndex();
  let release!: (text: string) => void;
  const pending = index.analyze(
    "root",
    "main.kalandra",
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  while (!release) await Promise.resolve();
  index.clear();
  release("value = 1");
  const old = await pending;
  expect(
    await index.analyze("root", "main.kalandra", async () => "value = 1"),
  ).not.toBe(old);
});
