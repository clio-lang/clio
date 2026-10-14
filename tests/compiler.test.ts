import { describe, expect, test } from "bun:test";
import { compile, analyze, lower } from "../packages/compiler/src/index.js";
import corpus from "./fixtures/clio/corpus.json";

async function moduleOf(source: string) {
  const result = compile({ path: "test.kalandra", text: source });
  expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  expect(result.output).toBeDefined();
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { pathToFileURL } = await import("node:url");
  const directory = await mkdtemp(join(tmpdir(), "kalandra-execute-"));
  try {
    const file = join(directory, "program.mjs");
    await Bun.write(file, result.output!.code);
    return await import(pathToFileURL(file).href);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
const fixture = (name: string) =>
  corpus.accepted.find((item) => item.name === name)!;

describe("executable JavaScript target", () => {
  test("exports constants, functions, and strict equality", async () => {
    const module = await moduleOf(
      "export Number answer = 42\nexport fn add a b: a + b\nexport fn same a b: a == b",
    );
    expect(module.answer).toBe(42);
    expect(module.add(2, 3)).toBe(5);
    expect(module.same(2, "2")).toBe(false);
  });
  test("preserves arithmetic grouping and signed exponentiation", async () => {
    const module = await moduleOf(
      "export fn math a b c: (a + b) * c ** 2\nexport square = -2 ** 2\nexport minusZero = -0",
    );
    expect(module.math(1, 2, 3)).toBe(27);
    expect(module.square).toBe(4);
    expect(Object.is(module.minusZero, -0)).toBe(true);
  });
  test("implicit returns include branches and declarations", async () => {
    const module = await moduleOf(
      "export fn choose a:\n  if a: 1\n  else: 2\nexport fn maybe a:\n  if a: 3\nexport fn binding:\n  result = 42\nexport fn outer:\n  fn inner: 7",
    );
    expect(module.choose(true)).toBe(1);
    expect(module.choose(false)).toBe(2);
    expect(module.maybe(false)).toBeUndefined();
    expect(module.binding()).toBe(42);
    expect(module.outer()()).toBe(7);
  });
  test("recursive functions and nested closures execute", async () => {
    const module = await moduleOf(
      fixture("fib.clio").source +
        "\nexport fib\nexport fn outer x:\n  fn inner y: x + y\n  inner",
    );
    expect(module.fib(10)).toBe(89);
    expect(module.outer(7)(3)).toBe(10);
  });
  test("quick functions capture variables and order parameters", async () => {
    const module = await moduleOf(
      "export fn make offset: (@b + @a + @b + offset)\nexport fn nested: (@a + (@b + 1))",
    );
    expect(module.make(10)(2, 3)).toBe(17);
    expect(typeof module.nested()).toBe("function");
  });
  test("flow bindings and mixed assignments evaluate once", async () => {
    const module = await moduleOf(
      "export fn main source add:\n  result = source () => value -> add 2\n  [result value]",
    );
    let calls = 0;
    expect(
      module.main(
        () => {
          calls++;
          return 4;
        },
        (a: number, b: number) => a + b,
      ),
    ).toEqual([6, 4]);
    expect(calls).toBe(1);
  });
  test("calls and method pipes preserve argument order and receivers", async () => {
    const module = await moduleOf(
      "export fn call obj get: obj.add (get 1) (get 2)\nexport fn push values x: values -> .push x\nexport fn direct values x: .push values x",
    );
    const seen: number[] = [];
    const obj = {
      bias: 10,
      add(a: number, b: number) {
        return this.bias + a + b;
      },
    };
    expect(
      module.call(obj, (n: number) => {
        seen.push(n);
        return n;
      }),
    ).toBe(13);
    expect(seen).toEqual([1, 2]);
    const array: number[] = [];
    expect(module.push(array, 4)).toBe(1);
    expect(module.direct(array, 5)).toBe(2);
    expect(array).toEqual([4, 5]);
  });
  test("logical expressions short-circuit", async () => {
    const module = await moduleOf(
      "export fn both value thunk: value and (thunk ())\nexport fn either value thunk: value or (thunk ())",
    );
    const fail = () => {
      throw new Error("must not evaluate");
    };
    expect(module.both(false, fail)).toBe(false);
    expect(module.either("present", fail)).toBe("present");
  });
  test("chained comparisons retain Clio's repeated middle evaluation", async () => {
    const module = await moduleOf("export fn compare next: 0 < (next ()) < 3");
    let calls = 0;
    expect(module.compare(() => ++calls)).toBe(true);
    expect(calls).toBe(2);
    calls = 0;
    expect(
      module.compare(() => {
        calls++;
        return -1;
      }),
    ).toBe(false);
    expect(calls).toBe(1);
  });
  test("arrays, sets, hashmaps and property stores", async () => {
    const module = await moduleOf(
      'export data = [1 [2 3]]\nexport unique = {1 1 2}\nexport settings = # title: "Hi" nested: (# value: 3)\nexport fn update obj value: obj.value = value',
    );
    expect(module.data).toEqual([1, [2, 3]]);
    expect([...module.unique]).toEqual([1, 2]);
    expect(module.settings).toEqual({ title: "Hi", nested: { value: 3 } });
    const obj = { value: 0 };
    expect(module.update(obj, 4)).toBe(4);
    expect(obj.value).toBe(4);
  });
  test("awaiting, await-all, and async pipes", async () => {
    const module = await moduleOf(
      "export fn wait task: await task ()\nexport fn all tasks: [await] tasks\nexport fn piped value mapper: value -> await mapper\nexport value = await 42",
    );
    expect(await module.wait(async () => 3)).toBe(3);
    expect(await module.all([Promise.resolve(1), Promise.resolve(2)])).toEqual([
      1, 2,
    ]);
    expect(await module.piped(2, async (x: number) => x * 3)).toBe(6);
    expect(module.value).toBe(42);
  });
  test("local reserved names and generated-name collisions are hygienic", async () => {
    const module = await moduleOf(
      "export class = 42\nexport fn test __kalandra0:\n  __kalandra1 = 2\n  __kalandra0 + __kalandra1",
    );
    expect(module.class).toBe(42);
    expect(module.test(3)).toBe(5);
  });
});

describe("Clio saved JavaScript compatibility", () => {
  const cases: [string, string[], unknown[]][] = [
    ["Booleans", [], []],
    ["Null", [], []],
    ["Array", [], []],
    ["Array (Empty)", [], []],
    ["Array (Nested)", [], []],
    ["Set", [], []],
    ["Set (Empty)", [], []],
    ["Math", ["a", "b", "c"], [2, 3, 4]],
    ["Math (Power)", ["a", "b"], [2, 3]],
    ["Wrapped", ["a", "b", "c"], [2, 3, 4]],
    ["Comparison", ["a", "b"], [2, 3]],
    ["Comparison (Chained)", ["a", "b", "c"], [1, 2, 3]],
    ["Logical", ["a", "b"], ["value", 0]],
    ["Logical (Chained)", ["a", "b", "c"], [true, false, "fallback"]],
    ["Not", ["a"], [0]],
    ["Not (Complex)", ["a", "b"], [2, 3]],
    ["Not (Chained)", ["a", "b", "c"], [1, 2, 1]],
    [
      "Call",
      ["add", "a", "b", "c"],
      [(...values: number[]) => values.reduce((a, b) => a + b), 1, 2, 3],
    ],
    ["Call (No Args)", ["die"], [() => 42]],
    ["Pipe", ["a", "double"], [4, (n: number) => n * 2]],
    ["Pipe (w/args)", ["a", "add"], [4, (a: number, b: number) => a + b]],
    ["Call (Quick Fn)", ["b"], [10]],
    ["Hashmap", ["value"], [42]],
    ["Hashmap (Empty)", [], []],
  ];
  for (const [name, parameters, args] of cases)
    test(name, async () => {
      const sample = fixture(name);
      const source = `export fn probe ${parameters.join(" ")}:\n  ${sample.source.replaceAll("\n", "\n  ")}`;
      const current = await moduleOf(source);
      // Trusted, committed fixture text: execute the saved old emitter result, not an old compiler.
      const reference = new Function(
        ...parameters,
        `return (${sample.expectedJavaScript});`,
      );
      expect(current.probe(...args)).toEqual(reference(...args));
    });
  test("function behavior matches the old registered implementation", async () => {
    const sample = fixture("Functions (Expression)");
    const reference = new Function(
      "register",
      `${sample.expectedJavaScript}; return add;`,
    )((_id: string, fn: unknown) => fn);
    const current = await moduleOf(sample.source + "\nexport add");
    for (const [a, b] of [
      [1, 2],
      [-3, 7],
      [0, 0],
    ])
      expect(current.add(a, b)).toBe(reference(a, b));
  });
  test("every reference fixture either produces parsable JS or a feature diagnostic", () => {
    let emitted = 0;
    for (const sample of corpus.accepted) {
      const result = compile({ path: sample.file, text: sample.source });
      if (result.output) {
        expect(() =>
          new Bun.Transpiler({ loader: "js" }).transformSync(
            result.output!.code,
          ),
        ).not.toThrow();
        emitted++;
      } else
        expect(result.diagnostics.some((d) => d.code === "KAL4001")).toBe(true);
    }
    expect(emitted).toBe(146);
  });
});

describe("compiler boundaries", () => {
  test.each(["|task| 1", 'import "ws:pkg"', "1 in [1 2]", "true and (1 => x)"])(
    "unsupported source produces no output: %s",
    (text) => {
      const result = compile({ path: "unsupported", text });
      expect(result.output).toBeUndefined();
      expect(result.diagnostics.some((d) => d.code === "KAL4001")).toBe(true);
    },
  );
  test("analysis errors prevent emission; strict names remain opt-in", () => {
    expect(
      compile({ path: "bad", text: 'Number n = "wrong"' }).output,
    ).toBeUndefined();
    expect(compile({ path: "bad", text: "fn :" }).output).toBeUndefined();
    expect(compile({ path: "external", text: "host 1" }).output).toBeDefined();
    expect(
      compile({ path: "external", text: "host 1" }, { strictNames: true })
        .output,
    ).toBeUndefined();
    expect(
      compile({ path: "external", text: "class" }).diagnostics.some(
        (d) => d.code === "KAL4002",
      ),
    ).toBe(true);
  });
  test("lowering produces a typed, independent and deterministic IR", () => {
    const analyzed = analyze({
      path: "module.kalandra",
      text: "export Number n = 42",
    });
    const before = JSON.stringify(analyzed.program);
    const result = lower(analyzed.program!, analyzed.model!);
    expect(result.diagnostics).toEqual([]);
    expect(result.module?.body[0]).toMatchObject({
      kind: "Bind",
      binding: { name: "n", type: { kind: "Number" } },
      value: { kind: "Literal", value: 42, type: { kind: "Number" } },
    });
    expect(JSON.stringify(analyzed.program)).toBe(before);
    const source = { path: "deterministic", text: "export fn double x: x * 2" };
    expect(compile(source)).toEqual(compile(source));
  });
});

// Decode source-map VLQ segments independently of the emitter to verify actual locations.
function mappings(map: {
  mappings: string;
  sources: string[];
  names: string[];
}) {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let source = 0,
    originalLine = 0,
    originalColumn = 0,
    name = 0;
  return map.mappings.split(";").flatMap((line, lineIndex) => {
    let column = 0;
    return line
      .split(",")
      .filter(Boolean)
      .map((segment) => {
        const values: number[] = [];
        let value = 0,
          shift = 0;
        for (const char of segment) {
          const digit = alphabet.indexOf(char);
          value += (digit & 31) * 2 ** shift;
          if (digit & 32) shift += 5;
          else {
            values.push(value & 1 ? -(value >> 1) : value >> 1);
            value = 0;
            shift = 0;
          }
        }
        column += values[0]!;
        if (values.length < 4)
          return { generatedLine: lineIndex + 1, generatedColumn: column };
        source += values[1]!;
        originalLine += values[2]!;
        originalColumn += values[3]!;
        if (values.length === 5) name += values[4]!;
        return {
          generatedLine: lineIndex + 1,
          generatedColumn: column,
          source: map.sources[source],
          line: originalLine + 1,
          column: originalColumn,
          name: values.length === 5 ? map.names[name] : undefined,
        };
      });
  });
}

test("source maps retain source text, Unicode offsets, and original binding names", () => {
  const text = "-- 🌍\r\nexport fn add x:\r\n  x + 42";
  const result = compile({ path: "src/🌍 example.kalandra", text });
  expect(result.output).toBeDefined();
  const map = JSON.parse(result.output!.sourceMap);
  expect(map.version).toBe(3);
  expect(map.sources).toEqual(["src/🌍 example.kalandra"]);
  expect(map.sourcesContent).toEqual([text]);
  expect(map.names).toContain("x");
  const decoded = mappings(map);
  expect(
    decoded.some(
      (item) => item.line === 3 && item.column === 2 && item.name === "x",
    ),
  ).toBe(true);
  const lines = result.output!.code.split("\n");
  const numeric = decoded.find((item) => item.line === 3 && item.column === 6)!;
  expect(
    lines[numeric.generatedLine - 1]!.slice(numeric.generatedColumn),
  ).toStartWith("42");
});

test("implicit property-assignment returns read the stored property", async () => {
  const module = await moduleOf(
    "export fn update obj value: obj.value = value\nexport fn flow obj value consume: value => obj.value -> consume\nexport fn silent obj:\n  obj.value = 2\n  42",
  );
  let value = 0,
    reads = 0;
  const object = {
    set value(input: number) {
      value = input * 2;
    },
    get value() {
      reads++;
      return value;
    },
  };
  expect(module.update(object, 3)).toBe(6);
  expect(reads).toBe(1);
  expect(module.flow(object, 4, (x: number) => x + 1)).toBe(9);
  reads = 0;
  expect(module.silent(object)).toBe(42);
  expect(reads).toBe(0);
});

test("the documented Fibonacci example compiles and executes under Bun", async () => {
  const source = await Bun.file("examples/fibonacci.kalandra").text();
  const compiled = compile({
    path: "examples/fibonacci.kalandra",
    text: source,
  });
  expect(compiled.output).toBeDefined();
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const directory = await mkdtemp(join(tmpdir(), "kalandra-example-"));
  try {
    const path = join(directory, "fibonacci.mjs");
    await Bun.write(path, compiled.output!.code);
    const process = Bun.spawnSync([Bun.which("bun")!, path]);
    expect(process.exitCode).toBe(0);
    expect(process.stdout.toString().trim()).toBe("89");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("duplicate prototype entries fail compilation instead of producing invalid JS", () => {
  const result = compile({
    path: "proto.kalandra",
    text: "export value = # __proto__: 1 __proto__: 2",
  });
  expect(result.output).toBeUndefined();
  expect(result.diagnostics.some((item) => item.code === "KAL4001")).toBe(true);
});

test("source-map columns after astral Unicode use UTF-16 offsets", () => {
  const text = 'export answer = ("🌍" == "🌍") and 42';
  const result = compile({ path: "unicode.kalandra", text });
  const map = JSON.parse(result.output!.sourceMap);
  const numeric = mappings(map).find(
    (item) => item.line === 1 && item.column === text.indexOf("42"),
  )!;
  expect(numeric).toBeDefined();
  expect(
    result
      .output!.code.split("\n")
      [numeric.generatedLine - 1]!.slice(numeric.generatedColumn),
  ).toStartWith("42");
});

describe("tail recursion", () => {
  test("deep direct and piped self-calls use bounded stack", async () => {
    const module = await moduleOf(`export fn sum n total:
  if n > 0: sum (n - 1) (total + n)
  else: total
export fn count n:
  if n > 0: (n - 1) -> count
  else: n`);
    expect(module.sum(100000, 0)).toBe(5000050000);
    expect(module.count(100000)).toBe(0);
    expect(module.sum.length).toBe(2);
  });

  test("async direct and piped tail calls reach 100,000 iterations before the base await", async () => {
    const module = await moduleOf(`export fn sum n total:
  if n > 0: sum (n - 1) (total + n)
  else: await total
export fn count n:
  if n > 0: (n - 1) -> count
  else: await n`);
    const sum = module.sum(100000, 0);
    expect(sum).toBeInstanceOf(Promise);
    expect(await sum).toBe(5000050000);
    expect(await module.count(100000)).toBe(0);
    expect(module.sum.length).toBe(2);
  });

  test("async iterations preserve suspension points, closures, and concurrent invocation state", async () => {
    const module = await moduleOf(`export fn collect n callbacks pause:
  fn read: n
  callbacks -> .push read
  await pause n
  if n > 0: collect (n - 1) callbacks pause
  else: callbacks`);
    const gates: (() => void)[] = [];
    const seen: number[] = [];
    const callbacks: (() => number)[] = [];
    const pending = module.collect(2, callbacks, (n: number) => {
      seen.push(n);
      return new Promise<void>((resolve) => gates.push(resolve));
    });
    expect(seen).toEqual([2]);
    expect(callbacks.map((read) => read())).toEqual([2]);
    gates.shift()!();
    await Promise.resolve();
    expect(seen).toEqual([2, 1]);
    expect(callbacks.map((read) => read())).toEqual([2, 1]);
    gates.shift()!();
    await Promise.resolve();
    expect(seen).toEqual([2, 1, 0]);
    gates.shift()!();
    expect((await pending).map((read: () => number) => read())).toEqual([
      2, 1, 0,
    ]);
    const [first, second] = await Promise.all([
      module.collect(3, [], async () => {}),
      module.collect(1, [], async () => {}),
    ]);
    expect(first.map((read: () => number) => read())).toEqual([3, 2, 1, 0]);
    expect(second.map((read: () => number) => read())).toEqual([1, 0]);
  });

  test("async tail arguments preserve ordering, arity effects, and rejection identity", async () => {
    const module = await moduleOf(`export fn rotate n a b trace:
  if n > 0: rotate (n - 1) (await trace b) (await trace a) trace (await trace 99)
  else: await [a b]
export fn missing n value:
  if n > 0: missing (n - 1)
  else: await value`);
    const seen: number[] = [];
    expect(
      await module.rotate(2, 1, 2, async (value: number) => {
        seen.push(value);
        return value;
      }),
    ).toEqual([1, 2]);
    expect(seen).toEqual([2, 1, 99, 1, 2, 99]);
    expect(await module.missing(100000, 42)).toBeUndefined();
    const failure = new Error("stop");
    seen.length = 0;
    await expect(
      module.rotate(2, 1, 2, (value: number) => {
        seen.push(value);
        return Promise.reject(failure);
      }),
    ).rejects.toBe(failure);
    expect(seen).toEqual([2]);
  });

  test("arguments use old bindings, evaluate left to right, and retain extra effects", async () => {
    const module = await moduleOf(`export fn rotate n a b trace:
  if n > 0: rotate (n - 1) (trace b) (trace a) trace (trace 99)
  else: [a b]
export fn missing n value:
  if n > 0: missing (n - 1)
  else: value`);
    const seen: number[] = [];
    expect(
      module.rotate(2, 1, 2, (value: number) => {
        seen.push(value);
        return value;
      }),
    ).toEqual([1, 2]);
    expect(seen).toEqual([2, 1, 99, 1, 2, 99]);
    expect(module.missing(1, 42)).toBeUndefined();
  });

  test("escaped closures retain each invocation's parameters and locals", async () => {
    const module = await moduleOf(`export fn collect n callbacks:
  value = n * 2
  fn read: [n value]
  callbacks -> .push read
  if n > 0: collect (n - 1) callbacks
  else: callbacks`);
    expect(module.collect(3, []).map((read: () => number[]) => read())).toEqual(
      [
        [3, 6],
        [2, 4],
        [1, 2],
        [0, 0],
      ],
    );
  });

  test("fallthrough terminates and nested functions own separate loops", async () => {
    const module = await moduleOf(`export fn maybe n:
  if n > 0: maybe (n - 1)
export fn outer n:
  fn inner m:
    if m > 0: inner (m - 1)
    else: n
  if n > 0: outer ((inner 10) - 1)
  else: inner 100000`);
    expect(module.maybe(100000)).toBeUndefined();
    expect(module.outer(100)).toBe(0);
  });

  test("awaited self-calls, shadowed calls, and non-tail calls stay ordinary", async () => {
    const source = `export fn asyncCount n:
  if n > 0: await asyncCount (n - 1)
  else: n
export fn factorial n:
  if n > 0: n * (factorial (n - 1))
  else: 1
export fn shadow shadow: shadow 5`;
    const result = compile({ path: "ordinary.kalandra", text: source });
    expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual(
      [],
    );
    expect(result.output!.code).not.toContain("while");
    const module = await moduleOf(source);
    expect(await module.asyncCount(10)).toBe(0);
    expect(module.factorial(5)).toBe(120);
    expect(module.shadow((n: number) => n + 1)).toBe(6);
  });
});

describe("bindings inside eager expressions", () => {
  test("arithmetic bindings are visible after the containing statement", async () => {
    const module = await moduleOf(`export fn calculate read:
  result = (read 1 => first) + (read 2 => second) * 3
  [result first second]
export fn single read: 10 + (read 4 => value)
export fn nested read: 1 + (read (2 => argument))`);
    const seen: number[] = [];
    const read = (n: number) => {
      seen.push(n);
      return n;
    };
    expect(module.calculate(read)).toEqual([7, 1, 2]);
    expect(seen).toEqual([1, 2]);
    expect(module.single(read)).toBe(14);
    expect(module.nested(read)).toBe(3);
  });

  test("lifted bindings precede ordinary operand effects, as in Clio", async () => {
    const module = await moduleOf(`export fn calculate read:
  (read 1) + (read 2 => second) + (read 3 => third)
export fn consume read sink:
  sink (read 1) ((read 2 => bound) * 3)`);
    const seen: number[] = [];
    const read = (n: number) => {
      seen.push(n);
      return n;
    };
    expect(module.calculate(read)).toBe(6);
    expect(seen).toEqual([2, 3, 1]);
    seen.length = 0;
    expect(module.consume(read, (a: number, b: number) => a + b)).toBe(7);
    expect(seen).toEqual([2, 1]);
  });

  test("property bases lift their bindings and preserve getter reads", async () => {
    const module = await moduleOf(`export fn select read:
  result = (read () => object).value
  [result object]
export fn nested read: ((read () => object).value => selected).answer`);
    let reads = 0;
    const object = {
      get value() {
        reads++;
        return { answer: 42 };
      },
    };
    expect(module.select(() => object)).toEqual([{ answer: 42 }, object]);
    expect(reads).toBe(1);
    expect(module.nested(() => object)).toBe(42);
    expect(reads).toBe(2);
  });

  test("async binding values finish before ordinary arithmetic operands", async () => {
    const module = await moduleOf(`export fn calculate read:
  (read 1) + (await read 2 => bound)`);
    const seen: number[] = [];
    expect(
      await module.calculate((n: number) => {
        seen.push(n);
        return n === 2 ? Promise.resolve(n) : n;
      }),
    ).toBe(3);
    expect(seen).toEqual([2, 1]);
  });

  test("mapped arithmetic bindings run once, including on empty inputs", async () => {
    const module = await moduleOf(`export fn mapped items read add:
  items -> * add ((read 2 => bound) * 3)`);
    let reads = 0;
    const read = (n: number) => {
      reads++;
      return n;
    };
    expect(
      module.mapped([1, 2], read, (a: number, b: number) => a + b),
    ).toEqual([7, 8]);
    expect(reads).toBe(1);
    expect(module.mapped([], read, () => 0)).toEqual([]);
    expect(reads).toBe(2);
  });

  test("unresolved evaluation contexts still reject lifted declarations", () => {
    for (const source of [
      "true and ((1 => value) + 2)",
      "1 < ((2 => value) + 3)",
      "not ((1 => value) + 2)",
      "if (1 => value) + 2: 3",
    ]) {
      const result = compile({ path: "unsupported.kalandra", text: source });
      expect(result.output).toBeUndefined();
      expect(result.diagnostics.some((d) => d.code === "KAL4001")).toBe(true);
    }
  });
});

describe("bindings in call targets", () => {
  test("callee bindings precede argument bindings and remain in scope", async () => {
    const module = await moduleOf(`export fn invoke make read:
  result = (make () => target) (read 2 => value)
  [result target value]`);
    const seen: string[] = [];
    const target = (n: number) => {
      seen.push("call");
      return n * 3;
    };
    expect(
      module.invoke(
        () => {
          seen.push("target");
          return target;
        },
        (n: number) => {
          seen.push("argument");
          return n;
        },
      ),
    ).toEqual([6, target, 2]);
    expect(seen).toEqual(["target", "argument", "call"]);
  });

  test("bound property bases preserve receivers and getter evaluation order", async () => {
    const module = await moduleOf(`export fn invoke make read:
  (make () => object).run (read 2 => value)`);
    const seen: string[] = [];
    const object = {
      bias: 10,
      get run() {
        seen.push("getter");
        return function (this: { bias: number }, n: number) {
          return this.bias + n;
        };
      },
    };
    expect(
      module.invoke(
        () => {
          seen.push("base");
          return object;
        },
        (n: number) => {
          seen.push("argument");
          return n;
        },
      ),
    ).toBe(12);
    expect(seen).toEqual(["base", "argument", "getter"]);
  });

  test("pipe targets lift before input bindings, with ordinary inputs evaluated later", async () => {
    const module = await moduleOf(`export fn invoke make read:
  (read 1 => input) -> (make () => target) (read 2 => extra)`);
    const seen: number[] = [];
    expect(
      module.invoke(
        () => {
          seen.push(0);
          return (a: number, b: number) => a + b;
        },
        (n: number) => {
          seen.push(n);
          return n;
        },
      ),
    ).toBe(3);
    expect(seen).toEqual([0, 1, 2]);
  });

  test("mapped target bindings without extra arguments run once, even on empty inputs", async () => {
    const module = await moduleOf(`export fn mapped items make:
  items -> * (make () => target)`);
    let calls = 0;
    const make = () => {
      calls++;
      return (n: number) => n * 2;
    };
    expect(module.mapped([1, 2], make)).toEqual([2, 4]);
    expect(calls).toBe(1);
    expect(module.mapped([], make)).toEqual([]);
    expect(calls).toBe(2);
  });

  test("mapped targets with extra arguments retain a diagnostic where Clio loses declarations", () => {
    const result = compile({
      path: "unsupported.kalandra",
      text: "[1 2] -> * (make () => target) 3",
    });
    expect(result.output).toBeUndefined();
    expect(result.diagnostics.some((d) => d.code === "KAL4001")).toBe(true);
  });

  test("async target creation finishes before lifted arguments", async () => {
    const module = await moduleOf(`export fn invoke make read:
  (await make () => target) (read 3 => value)`);
    const seen: string[] = [];
    expect(
      await module.invoke(
        async () => {
          seen.push("target");
          return (n: number) => n * 2;
        },
        (n: number) => {
          seen.push("argument");
          return n;
        },
      ),
    ).toBe(6);
    expect(seen).toEqual(["target", "argument"]);
  });

  test("short-circuit contexts still reject calls containing lifted target bindings", () => {
    const result = compile({
      path: "unsupported.kalandra",
      text: "true and ((make () => target) 1)",
    });
    expect(result.output).toBeUndefined();
    expect(result.diagnostics.some((d) => d.code === "KAL4001")).toBe(true);
  });
});

test("LD-006: direct await operands cannot silently lose lifted bindings", () => {
  for (const text of [
    "await work (1 => value)",
    "[await] work (1 => value)",
    "await [(1 => value)]",
  ]) {
    const result = compile({ path: "await-bindings.kalandra", text });
    expect(result.output).toBeUndefined();
    expect(result.diagnostics.some((item) => item.code === "KAL4001")).toBe(
      true,
    );
  }
});
