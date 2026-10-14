import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { sourceDocumentation } from "../packages/compiler/src/index.js";
import { verifyDocsCli } from "./helpers/docs-cli.js";
const docs = (text: string) =>
  sourceDocumentation({ path: "library.kalandra", text });

test("source docs retain declarations, private functions, separate exports and outer description precedence", () => {
  const result = docs(
    '@describe "outer"\n@describe "inner"\n@params Number\n@returns Number\nfn twice value: value * 2\nexport twice\nfn private: 1\n',
  );
  expect(result.diagnostics).toEqual([]);
  expect(
    result.functions?.map((fn) => [fn.name, fn.exported, fn.description]),
  ).toEqual([
    ["twice", true, "outer"],
    ["private", false, null],
  ]);
  expect(result.functions?.[0]?.decorators.join("\n")).toContain(
    "@returns Number",
  );
});

test("source docs never mistake shadowed describe for builtin metadata", () => {
  const result = docs(
    'fn describe text targetFn: targetFn\n@describe "not builtin"\nfn target: 1\n',
  );
  expect(
    result.functions?.find((fn) => fn.name === "target")?.descriptionStatus,
  ).toBe("none");
});

test("source docs distinguish computed outer descriptions and ignore type-check failures", () => {
  const result = docs(
    '@describe (lookup ())\n@describe "inner"\nfn target: 1 + "bad"\n',
  );
  expect(result.diagnostics).toEqual([]);
  expect(result.functions?.[0]).toMatchObject({
    description: null,
    descriptionStatus: "dynamic",
  });
  expect(docs("value = 1").functions).toEqual([]);
  expect(docs("fn :").functions).toBeUndefined();
});

test("source and JSON docs inspect without imports, execution or output artifacts", async () => {
  const directory = await mkdtemp(join(tmpdir(), "kalandra-docs-"));
  try {
    await verifyDocsCli(resolve("packages/cli/src/index.ts"), directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
