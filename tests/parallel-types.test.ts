import { expect, test } from "bun:test";
import { compileProject } from "../packages/compiler/src/index.js";
const build = (text: string, extra: Record<string, string> = {}) =>
  compileProject("main.kalandra", {
    async readSource(path) {
      return { "main.kalandra": text, ...extra }[path] ?? null;
    },
  });
const identity = "@params Number\nfn identity n: n\n";

test("parallel boundaries reject unknown parameters, results and actual values", async () => {
  for (const source of [
    "fn identity n: n\nexport fn main: |identity| 1",
    "@params Number\nfn identity n: n.value\nexport fn main: |identity| 1",
    "@params Number\n@returns Number\nfn identity n: n.value\nexport fn main: |identity| 1",
    identity + "export fn main value: |identity| value",
    identity + "export fn main value: value -> |identity|",
    identity + "export fn main value: [value] -> * |identity|",
    identity + "export fn main: |identity| 1 unknown",
    identity + "export fn main: |identity| ()",
    identity + "export fn main: |identity|",
    identity +
      "export fn main value:\n  Number annotated = value\n  |identity| annotated",
    identity +
      "@params Number\n@returns Number\nfn helper n: n.value\nexport fn main: |identity| (helper 1)",
    identity +
      "@params Number\n@returns Number\nfn helper n: n.value\nexport fn main: |identity| (1 -> helper)",
    identity +
      'from "esm:node:os" import hostname\nexport fn main: |identity| (hostname ())',
  ]) {
    const result = await build(source);
    expect(
      result.diagnostics.some((d) => d.code === "KAL4202"),
      source,
    ).toBe(true);
    expect(result.output).toBeUndefined();
  }
});

test("strict boundary errors point to imported parallel calls", async () => {
  const result = await build(
    'from "./work" import identity\nexport fn main: |identity| 1',
    {
      "work.kalandra": "export fn identity n: n",
    },
  );
  expect(result.output).toBeUndefined();
  expect(
    result.diagnostics.some(
      (d) => d.code === "KAL4202" && d.span?.file === "main.kalandra",
    ),
  ).toBe(true);
});

test("mapped callback metadata is checked against parameter types", async () => {
  const result = await build(
    "@params Number String\nfn work n index: n\nexport fn main: [1 2] -> * |work|",
  );
  expect(result.output).toBeUndefined();
  expect(
    result.diagnostics.some(
      (d) => d.code === "KAL4202" && d.message.includes("expected String"),
    ),
  ).toBe(true);
});

test("ordinary dynamic calls and unused dynamic functions remain valid", async () => {
  const result = await build(
    "fn dynamic value: value\n" +
      identity +
      "export fn main: (dynamic 1) + (await |identity| 2)",
  );
  expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  expect(result.output).toBeDefined();
});

test("concrete inferred results and nested list boundaries are accepted", async () => {
  for (const source of [
    "fn work: 1.5\nexport fn main: |work| ()",
    '@params Number\nfn work flag:\n  if flag > 0: 1\n  else: "none"\nexport fn main: |work| 1',
    "list Numbers: Number\nlist Matrix: Numbers\n@params Matrix\nfn work values: values\nexport fn main: |work| [[1.5]]",
  ]) {
    const result = await build(source);
    expect(
      result.diagnostics.filter((d) => d.severity === "error"),
      source,
    ).toEqual([]);
    expect(result.output).toBeDefined();
  }
});

test("record fields must all be statically supported at the parallel call", async () => {
  for (const text of [
    "type Point: x\n@params Point\nfn echo p: p\nexport fn main: |echo| (Point 1)",
    "type Inner: value\ntype Outer:\n  Inner inner\n@params Outer\nfn echo p: p\nexport fn main: |echo| (Outer (Inner 1))",
    "type Point:\n  Number x\n@params Point\nfn echo p: p\nexport fn main value: |echo| (Point value)",
    "type Point:\n  Number x\n@params Point\nfn echo p: p\nexport fn main value:\n  Point p = value\n  |echo| p",
    "type Point:\n  Number x\n@params Point\nfn echo p: p\nexport fn main value:\n  p = Point 1\n  p.x = value\n  |echo| p",
    "type Point:\n  Number x\n@params Point\nfn echo p: p\nexport fn main value:\n  p = Point 1\n  q = p\n  q.x = value\n  |echo| p",
    "list Unknowns: Any\ntype Box:\n  Unknowns values\n@params Box\nfn echo box: box\nexport fn main: |echo| (Box [1])",
  ]) {
    const result = await build(text);
    expect(result.output).toBeUndefined();
    expect(
      result.diagnostics.some((d) => d.code === "KAL4202"),
      text,
    ).toBe(true);
  }
});
