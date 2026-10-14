import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import {
  parse,
  tokenize,
  type Program,
  type Statement,
} from "../packages/compiler/src/index.js";
import corpus from "./fixtures/clio/corpus.json";

function program(text: string): Program {
  const result = parse({ path: "test.kalandra", text });
  expect(result.diagnostics).toEqual([]);
  expect(result.program).toBeDefined();
  return result.program!;
}
function first(text: string): Statement {
  return program(text).body[0]!;
}
const id = (name: string) => ({ kind: "Identifier", name });
const literal = (value: number | string | boolean | null) => ({
  kind: "Literal",
  value,
});

function checkSpans(value: unknown, text: string): void {
  if (!value || typeof value !== "object") return;
  if ("span" in value) {
    const span = value.span as { start: number; end: number };
    expect(Number.isInteger(span.start)).toBe(true);
    expect(span.start).toBeGreaterThanOrEqual(0);
    expect(span.end).toBeGreaterThanOrEqual(span.start);
    expect(span.end).toBeLessThanOrEqual(text.length);
  }
  for (const child of Object.values(value)) checkSpans(child, text);
}

describe("committed Clio syntax corpus", () => {
  for (const [index, fixture] of corpus.accepted.entries()) {
    test(`${index + 1}: ${fixture.name}`, () => {
      const ast = program(fixture.source);
      checkSpans(ast, fixture.source);
    });
  }
  for (const fixture of corpus.rejected.slice(0, 6)) {
    test(`rejects ${fixture.name}`, () => {
      const result = parse({ path: fixture.file, text: fixture.source });
      expect(result.program).toBeUndefined();
      expect(result.diagnostics.length).toBeGreaterThan(0);
      checkSpans(result.diagnostics, fixture.source);
    });
  }
  test("type-error fixtures remain syntactically valid pending semantic analysis", () => {
    for (const fixture of corpus.rejected.slice(6)) program(fixture.source);
  });
});

describe("AST interpretation", () => {
  test("arithmetic arguments, precedence, and right-associative powers", () => {
    expect(first("fib n - 1")).toMatchObject({
      kind: "Call",
      callee: id("fib"),
      arguments: [
        { kind: "Binary", operator: "-", left: id("n"), right: literal(1) },
      ],
    });
    expect(first("a + b * c ** d ** e")).toMatchObject({
      kind: "Binary",
      operator: "+",
      left: id("a"),
      right: {
        kind: "Binary",
        operator: "*",
        right: {
          kind: "Binary",
          operator: "**",
          right: { kind: "Binary", operator: "**" },
        },
      },
    });
    expect(first("a or b and c")).toMatchObject({
      kind: "Binary",
      operator: "or",
      right: { kind: "Binary", operator: "and" },
    });
    expect(first("a + b % c")).toMatchObject({
      kind: "Binary",
      operator: "+",
      right: { kind: "Binary", operator: "%" },
    });
  });
  test("comparison chains and negation keep their boundaries", () => {
    expect(first("not a < b <= c")).toMatchObject({
      kind: "Unary",
      operator: "not",
      argument: {
        kind: "Comparison",
        operands: [id("a"), id("b"), id("c")],
        operators: ["<", "<="],
      },
    });
  });
  test("adjacency distinguishes slices from array arguments", () => {
    expect(first("arr[0..100 by 2]")).toMatchObject({
      kind: "Slice",
      object: id("arr"),
      indices: [
        {
          kind: "Range",
          start: literal(0),
          end: literal(100),
          step: literal(2),
        },
      ],
    });
    expect(first("arr [0]")).toMatchObject({
      kind: "Call",
      callee: id("arr"),
      arguments: [{ kind: "Array", elements: [literal(0)] }],
    });
    expect(first("die ()")).toMatchObject({
      kind: "Call",
      arguments: [{ kind: "Group", expression: null }],
    });
  });
  test("mapped parallel awaiting, flow assignment, and method calls", () => {
    expect(
      first("items -> * [await] |add| 2 => result -> .join separator"),
    ).toMatchObject({
      kind: "Pipeline",
      map: false,
      input: {
        kind: "Assignment",
        direction: "flow",
        target: id("result"),
        value: {
          kind: "Pipeline",
          input: id("items"),
          map: true,
          target: {
            kind: "Await",
            all: true,
            argument: {
              kind: "Call",
              callee: { kind: "ParallelReference", name: "add" },
              arguments: [literal(2)],
            },
          },
        },
      },
      target: {
        kind: "Call",
        callee: { kind: "MethodReference", property: id("join") },
        arguments: [id("separator")],
      },
    });
  });
  test("typed assignments and nested map shorthand", () => {
    expect(first("Number pi = 3.14")).toMatchObject({
      kind: "Assignment",
      annotation: id("Number"),
      target: id("pi"),
      value: literal(3.14),
      direction: "equals",
    });
    expect(
      first('# app:\n    version: "1.0"\n  window:\n    width: 300'),
    ).toMatchObject({
      kind: "Hashmap",
      entries: [
        {
          key: "app",
          value: {
            kind: "Hashmap",
            entries: [{ key: "version", value: literal("1.0") }],
          },
        },
        {
          key: "window",
          value: {
            kind: "Hashmap",
            entries: [{ key: "width", value: literal(300) }],
          },
        },
      ],
    });
  });
  test("nested block boundaries and conditional branches", () => {
    const ast = program(
      "fn choose a:\n  if a:\n    yes\n  else:\n    no\nafter",
    );
    expect(ast.body).toHaveLength(2);
    expect(ast.body[0]).toMatchObject({
      kind: "FunctionDeclaration",
      name: "choose",
      parameters: ["a"],
      body: {
        body: [
          {
            kind: "Conditional",
            branches: [
              { condition: id("a"), body: { body: [id("yes")] } },
              { condition: null, body: { body: [id("no")] } },
            ],
          },
        ],
      },
    });
    expect(ast.body[1]).toMatchObject(id("after"));
  });
  test("decorators and exports retain order", () => {
    expect(first('@foo.bar\n@route "/"\nexport fn main x: x')).toMatchObject({
      kind: "ExportDeclaration",
      declaration: {
        kind: "DecoratedFunction",
        decorators: [
          { name: ["foo", "bar"], arguments: [] },
          { name: ["route"], arguments: [literal("/")] },
        ],
        declaration: { kind: "FunctionDeclaration", name: "main" },
      },
    });
  });
  test("imports, aliases, inheritance, and typed fields", () => {
    expect(
      first('from "esm:pkg" import value as renamed * as all'),
    ).toMatchObject({
      kind: "ImportDeclaration",
      path: "esm:pkg",
      items: [
        { name: "value", alias: "renamed" },
        { name: "*", alias: "all" },
      ],
    });
    expect(first("type Location is Point:\n  String name\n  x")).toMatchObject({
      kind: "TypeDeclaration",
      name: "Location",
      parent: id("Point"),
      members: [
        { name: id("name"), annotation: id("String") },
        { name: id("x"), annotation: null },
      ],
    });
    expect(first("list Numbers: Number")).toMatchObject({
      kind: "ListDeclaration",
      memberType: id("Number"),
    });
  });
  test("formatted strings retain text and expression source spans", () => {
    const text = 'f"Hi 🌍 {@name}!"';
    const ast = first(text);
    expect(ast).toMatchObject({
      kind: "FormattedString",
      tag: id("f"),
      parts: [
        { kind: "StringPart", raw: "Hi 🌍 " },
        {
          kind: "Interpolation",
          expression: {
            kind: "Parameter",
            name: "name",
            span: { start: text.indexOf("@"), end: text.indexOf("}") },
          },
        },
        { kind: "StringPart", raw: "!" },
      ],
    });
  });
  test("comments and CRLF keep original offsets without affecting layout", () => {
    const text = "-- 🌍\r\nfn main:\r\n  1\r\n-- comment\r\n  2\r\n";
    const ast = program(text);
    expect(
      ast.comments.map((comment) =>
        text.slice(comment.span.start, comment.span.end),
      ),
    ).toEqual(["-- 🌍", "-- comment"]);
    expect(ast.body[0]).toMatchObject({
      kind: "FunctionDeclaration",
      body: { body: [literal(1), literal(2)] },
    });
    const numbers = tokenize({ path: "test", text }).tokens.filter(
      (token) => token.tokenType.name === "NumberLiteral",
    );
    expect(
      numbers.map((token) => [token.startLine, token.startColumn]),
    ).toEqual([
      [3, 3],
      [5, 3],
    ]);
  });
});

describe("malformed source and parser isolation", () => {
  test.each([
    "(a",
    "a]",
    '"unterminated',
    'f"{a"',
    "fn :",
    "fn a:",
    "if x: y\nelse: z\nelse: z",
    "1 2",
    "x => 2",
    "a -> 123",
    "a +",
    "from",
  ])("reports errors without returning an AST: %s", (text) => {
    const result = parse({ path: "broken", text });
    expect(result.program).toBeUndefined();
    expect(result.diagnostics.length).toBeGreaterThan(0);
    checkSpans(result.diagnostics, text);
    expect(first("42")).toMatchObject(literal(42));
  });
  test("empty and comment-only files are programs", () => {
    expect(program("").body).toEqual([]);
    expect(program("-- comment\n").body).toEqual([]);
  });
  test("bounded arbitrary source produces a result without crashing", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 100 }), (text) => {
        const result = parse({ path: "fuzz", text });
        checkSpans(result.program ?? result.diagnostics, text);
      }),
      { seed: 20261012, numRuns: 500 },
    );
  });
});
