import { describe, expect, test } from "bun:test";
import {
  analyze,
  analyzeProgram,
  parse,
  typeName,
  type AnalysisOptions,
  type AnalysisResult,
  type SemanticType,
} from "../packages/compiler/src/index.js";
import corpus from "./fixtures/clio/corpus.json";

const number: SemanticType = { kind: "Number" };
const string: SemanticType = { kind: "String" };
const check = (text: string, options: AnalysisOptions = {}) =>
  analyze({ path: "test.kalandra", text }, options);
const errors = (result: AnalysisResult) =>
  result.diagnostics.filter((d) => d.severity === "error");
function valid(text: string, options: AnalysisOptions = {}) {
  const result = check(text, options);
  expect(errors(result)).toEqual([]);
  expect(result.model).toBeDefined();
  return result;
}
function lastType(result: AnalysisResult) {
  return result.model!.types.get(result.program!.body.at(-1)!)!;
}
function fails(text: string, code: string, options: AnalysisOptions = {}) {
  const result = check(text, options);
  expect(errors(result).map((d) => d.code)).toContain(code);
  for (const diagnostic of result.diagnostics) {
    expect(diagnostic.span?.file).toBe("test.kalandra");
    expect(diagnostic.span!.start).toBeGreaterThanOrEqual(0);
    expect(diagnostic.span!.end).toBeLessThanOrEqual(text.length);
  }
  return result;
}

describe("Clio semantic baseline", () => {
  for (const [index, fixture] of corpus.rejected.slice(6).entries())
    test(`type error ${index + 1}: ${fixture.name}`, () => {
      const result = check(fixture.source);
      expect(
        errors(result).some((diagnostic) =>
          diagnostic.message.includes(fixture.expectedError),
        ),
      ).toBe(true);
    });
  test("all accepted syntax fixtures remain free of definite type errors", () => {
    for (const fixture of corpus.accepted)
      expect(errors(check(fixture.source))).toEqual([]);
  });
  test("unknown host names are explicit warnings with opt-in strict errors", () => {
    expect(valid("console.log value").diagnostics.map((d) => d.code)).toEqual([
      "KAL3001",
      "KAL3001",
    ]);
    fails("missing", "KAL3001", { strictNames: true });
    expect(
      valid("value + 1", { globals: { value: number }, strictNames: true })
        .diagnostics,
    ).toEqual([]);
  });
  test("arithmetic follows known values through declarations", () => {
    expect(lastType(valid('hello = "hi"\nhello + "!"'))).toEqual(string);
    fails('n = 2\nn + "two"', "KAL3109");
    fails("n = 2\nn ()", "KAL3107");
    expect(typeName(lastType(valid("[1 2]")))).toBe("Array<Number>");
  });
  test("syntax failures stop before semantic analysis", () => {
    expect(check("fn :").model).toBeUndefined();
    expect(check("fn :").diagnostics[0]?.code).toBe("KAL2001");
  });
});

describe("scopes and bindings", () => {
  test("parameters shadow outer values and closures capture the right binding", () => {
    const result = valid(
      'x = "outer"\nfn outer x:\n  fn inner y: x + y\n  inner\nx',
      { strictNames: true },
    );
    const inner = result.model!.functions.find(
      (info) => "name" in info.node && info.node.name === "inner",
    )!;
    expect(inner.captures.map((symbol) => [symbol.name, symbol.kind])).toEqual([
      ["x", "parameter"],
    ]);
    expect(lastType(result)).toEqual(string);
  });
  test("recursion and sibling function references resolve", () => {
    const result = valid("fn one n: two n\nfn two n: one n", {
      strictNames: true,
    });
    expect(result.diagnostics).toEqual([]);
    expect(result.model!.functions).toHaveLength(2);
  });
  test("branch bindings do not leak", () => {
    fails("if true:\n  local = 1\nlocal", "KAL3001", { strictNames: true });
  });
  test("duplicate locals and parameters are diagnosed", () => {
    fails("x = 1\nx = 2", "KAL3002");
    fails("fn f x x: x", "KAL3002");
    fails("fn f: 1\nfn f: 2", "KAL3002");
  });
  test("flow bindings are available to the rest of the pipeline", () => {
    const result = valid("2 => x -> add x", {
      globals: {
        add: {
          kind: "Callable",
          parameters: [number, number],
          returns: number,
          async: false,
        },
      },
      strictNames: true,
    });
    expect(lastType(result)).toEqual(number);
    expect(result.model!.scopes[0]!.symbols.get("x")?.type).toEqual(number);
  });
  test("analysis does not mutate the AST and repeated runs are isolated", () => {
    const ast = parse({
      path: "same",
      text: "fn isolated x: x\nisolated 2",
    }).program!;
    const before = JSON.stringify(ast);
    analyzeProgram(ast);
    analyzeProgram(ast, { strictNames: true });
    expect(JSON.stringify(ast)).toBe(before);
    fails("isolated 2", "KAL3001", { strictNames: true });
  });
});

describe("annotations and declared types", () => {
  test("typed parameters, arguments, and returns", () => {
    const declaration =
      "@params Number Number\n@returns Number\nfn add a b: a + b\n";
    expect(lastType(valid(declaration + "add 1 2"))).toEqual(number);
    fails(declaration + 'add 1 "two"', "KAL3106");
    fails('@returns Number\nfn bad: "string"', "KAL3105");
    fails("@params Number\nfn bad a b: a", "KAL3104");
    fails("@returns\nfn bad: 1", "KAL3104");
  });
  test("checks branch returns including the missing else path", () => {
    valid("@returns Number\nfn f x:\n  if x: 1\n  else: 2");
    fails('@returns Number\nfn f x:\n  if x: 1\n  else: "two"', "KAL3105");
    fails("@returns Number\nfn f x:\n  if x: 1", "KAL3105");
  });
  test("list annotations validate every known element", () => {
    valid("list Numbers: Number\nNumbers values = [1 2]");
    valid("list Numbers: Number\nNumbers values = []");
    fails('list Numbers: Number\nNumbers values = [1 "two"]', "KAL3111");
    fails("Missing value = 1", "KAL3101");
    fails("x = 1\nx value = 1", "KAL3101");
  });
  test("record construction, inherited order, nominal identity, and fields", () => {
    const declaration =
      "type Point:\n  Number x\n  Number y\ntype Location is Point:\n  String name\n";
    expect(
      lastType(valid(declaration + 'p = Location "home" 1 2\np.x')),
    ).toEqual(number);
    fails(declaration + 'Location 1 "home" 2', "KAL3106");
    fails(declaration + "p = Point 1 2\np.missing", "KAL3108");
    fails("type A: x\ntype B: x\nA value = B 1", "KAL3111");
    fails("type A: x x", "KAL3002");
  });
  test("cyclic type definitions terminate with diagnostics", () => {
    fails("list A: B\nlist B: A", "KAL3102");
    fails("type A is B: x\ntype B is A: y", "KAL3102");
  });
});

describe("quick functions, async, and mapped calls", () => {
  test("quick parameters are ordered and deduplicated with captures", () => {
    const result = valid("offset = 2\nquick = (@b + @a + @b + offset)", {
      strictNames: true,
    });
    const fn = result.model!.functions[0]!;
    expect(fn.parameters.map((symbol) => symbol.name)).toEqual(["b", "a"]);
    expect(fn.captures.map((symbol) => symbol.name)).toEqual(["offset"]);
  });
  test("nested quick functions own their parameters", () => {
    const result = valid("(@outer + (@inner + 1))");
    expect(
      result.model!.functions.map((fn) =>
        fn.parameters.map((symbol) => symbol.name),
      ),
    ).toEqual([["inner"], ["outer"]]);
  });
  test("async does not leak from nested functions or quick functions", () => {
    const result = valid(
      "fn outer:\n  fn inner: await work ()\n  (await work @x)",
      { globals: { work: { kind: "Function" } } },
    );
    expect(result.model!.functions.map((fn) => fn.async)).toEqual([
      true,
      true,
      false,
    ]);
    expect(result.model!.moduleAsync).toBe(false);
    expect(valid("await work ()").model!.moduleAsync).toBe(true);
  });
  test("mapped calls check item types and await-all unwraps parallel results", () => {
    const declaration = "@params Number\n@returns Number\nfn double x: x * 2\n";
    expect(
      typeName(lastType(valid(declaration + "[1 2] -> * [await] |double|"))),
    ).toBe("Array<Number>");
    expect(typeName(lastType(valid(declaration + "[1 2] -> * |double|")))).toBe(
      "Array<Promise<Number>>",
    );
    fails(declaration + '[1 "two"] -> * double', "KAL3106");
    fails(declaration + "2 -> * double", "KAL3110");
    valid(declaration + "1..3 -> * double");
  });
  test("parallel references remain asynchronous through aliases", () => {
    expect(
      typeName(lastType(valid("@returns Number\nfn f: 1\np = |f|\np ()"))),
    ).toBe("Promise<Number>");
  });
});

describe("host supplied module boundaries", () => {
  const modules = {
    "esm:math": {
      double: {
        kind: "Callable" as const,
        parameters: [number],
        returns: number,
        async: false,
      },
      Number: {
        kind: "TypeValue" as const,
        instance: number,
        parameters: null,
      },
    },
  };
  test("aliases and namespace imports carry supplied signatures", () => {
    expect(
      lastType(
        valid('from "esm:math" import double as twice\ntwice 2', {
          modules,
          strictNames: true,
        }),
      ),
    ).toEqual(number);
    fails('from "esm:math" import * as math\nmath.double "bad"', "KAL3106", {
      modules,
    });
    fails('from "esm:math" import missing', "KAL3004", { modules });
    fails('import "esm:math"', "KAL3004", { modules });
    expect(
      lastType(
        valid('import "esm:math"\nmath 2', {
          modules: {
            "esm:math": {
              ...modules["esm:math"],
              default: modules["esm:math"].double,
            },
          },
        }),
      ),
    ).toEqual(number);
  });
  test("imported annotations work without filesystem resolution", () => {
    valid(
      'from "esm:math" import Number as Numeric\n@params Numeric\n@returns Numeric\nfn f x: x\nf 2',
      { modules, strictNames: true },
    );
  });
  test("unknown modules remain explicit warnings", () => {
    const result = valid('import "cjs:express"\nexpress ()', {
      strictNames: true,
    });
    expect(result.diagnostics.map((d) => d.code)).toEqual(["KAL3004"]);
    expect(result.model!.imports).toEqual(["cjs:express"]);
  });
  test("exports record bindings and reject invalid positions", () => {
    const result = valid("export fn main: 1\nexport Number pi = 3.14");
    expect([...result.model!.exports.keys()]).toEqual(["main", "pi"]);
    fails("fn outer:\n  export fn inner: 1", "KAL3005");
    fails("export 1", "KAL3005");
    fails("x = 1\nexport x\nexport x", "KAL3005");
  });
});

test("later closure bindings resolve, direct reads before initialization fail", () => {
  const result = valid("fn read: later\nlater = 1", { strictNames: true });
  expect(
    result.model!.functions[0]!.captures.map((symbol) => symbol.name),
  ).toEqual(["later"]);
  fails("x\nx = 1", "KAL3007", { strictNames: true });
  fails("x = x", "KAL3007", { strictNames: true });
  fails("fn read:\n  later\n  later = 1", "KAL3007", { strictNames: true });
});

test("nested closures propagate outer dependencies without capturing recursion itself", () => {
  const result = valid(
    "value = 1\nfn outer:\n  fn inner: value\n  inner\nfn recursive x: recursive x",
    { strictNames: true },
  );
  expect(
    result.model!.functions.map((fn) =>
      fn.captures.map((symbol) => symbol.name),
    ),
  ).toEqual([["value"], ["value"], []]);
});

test("forward annotated async calls preserve Promise types", () => {
  const result = valid(
    "task = later ()\n@returns Number\nfn later: await work ()",
    {
      globals: {
        work: {
          kind: "Callable",
          parameters: [],
          returns: number,
          async: false,
        },
      },
    },
  );
  expect(typeName(result.model!.scopes[0]!.symbols.get("task")!.type)).toBe(
    "Promise<Number>",
  );
});

test("await assimilates nested Promise types", () => {
  expect(
    lastType(
      valid("await pending", {
        globals: {
          pending: {
            kind: "Promise",
            element: { kind: "Promise", element: number },
          },
        },
      }),
    ),
  ).toEqual(number);
});

test("default import names preserve Clio's extension and separator handling", () => {
  valid('import "esm:my-helper.js"\nmyHelper ()', { strictNames: true });
});

test("list type declarations are annotations, not callable constructors", () => {
  fails('list Numbers: Number\nNumbers "bad"', "KAL3107");
});
