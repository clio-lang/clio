import tailProbe from "./fixtures/clio/port-probes/decorated-tail.json";
import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { compile } from "../packages/compiler/src/index.js";
import corpus from "./fixtures/clio/corpus.json";
import runtime from "./fixtures/clio/runtime.json";

async function moduleOf(text: string) {
  const compiled = compile({ path: "decorators.kalandra", text });
  expect(compiled.diagnostics.filter((d) => d.severity === "error")).toEqual(
    [],
  );
  expect(compiled.output).toBeDefined();
  const dir = await mkdtemp(join(tmpdir(), "kalandra-decorators-"));
  try {
    const file = join(dir, "program.mjs");
    await Bun.write(file, compiled.output!.code);
    return await import(pathToFileURL(file).href);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
const old = new Function(
  runtime.sources.types.replaceAll("export ", "") +
    "\n" +
    runtime.sources.decorators.replaceAll("export ", "") +
    "\nreturn {Any,describe,params,returns,check};",
)();

describe("decorator compatibility", () => {
  for (const [index, fixture] of corpus.accepted
    .filter((f) => f.name.startsWith("Decorators"))
    .entries()) {
    test(`saved decorator ${index + 1}: ${fixture.name}`, async () => {
      const source = fixture.source
        .replace("export fn", "fn")
        .split("\n")
        .map((line) => `  ${line}`)
        .join("\n");
      const mod = await moduleOf(
        `export fn make silent route foo console:\n${source}\n  print`,
      );
      const execute = (factory: (...args: any[]) => any) => {
        const events: unknown[] = [];
        const silent = (...args: any[]) => {
          events.push(["silent", args.length]);
          return args.at(-1);
        };
        const route = (path: string, fn: any) => {
          events.push(["route", path]);
          return fn;
        };
        const foo = {
          bar(fn: any) {
            events.push(["bar", this === foo]);
            return fn;
          },
        };
        const console = {
          log(value: unknown) {
            events.push(["print", value]);
            return value;
          },
        };
        const fn = factory(silent, route, foo, console);
        expect(fn(42)).toBe(42);
        return events;
      };
      const reference = new Function(
        "silent",
        "route",
        "foo",
        "console",
        "clio",
        fixture.expectedJavaScript + ";return print;",
      );
      expect(execute(mod.make)).toEqual(
        execute((...args: any[]) => reference(...args, { exports: {} })),
      );
    });
  }
  test("exported builtins attach metadata and check arguments and returns", async () => {
    const mod = await moduleOf(
      '@describe "Doubles a number"\n@check\n@params Number\n@returns Number\nexport fn double x: x * 2',
    );
    const reference = old.describe(
      "Doubles a number",
      old.check(
        old.params(
          Number,
          old.returns(Number, (x: number) => x * 2),
        ),
      ),
    );
    expect(mod.double(3)).toBe(reference(3));
    expect(mod.double.__doc__).toBe(reference.__doc__);
    expect(mod.double.__accepts__).toEqual([Number]);
    expect(mod.double.__returns__).toBe(Number);
    const message = (fn: any, value: unknown) => {
      try {
        fn(value);
      } catch (e) {
        return (e as Error).message;
      }
    };
    expect(message(mod.double, "x")).toBe(message(reference, "x"));
    const bad = await moduleOf(
      "@check\n@returns Number\nexport fn identity callback: callback ()",
    );
    const expected = old.check(
      old.returns(Number, (callback: any) => callback()),
    );
    expect(message(bad.identity, () => "wrong")).toBe(
      message(expected, () => "wrong"),
    );
  });
  test("list descriptors, nominal records, Any, and async checks retain upstream behavior", async () => {
    const mod = await moduleOf(
      "export type Point: x\nlist Points: Point\n@check\n@params Points\nexport fn accept xs: xs\nexport marker = Any\n@check\n@params Any\nexport fn any x: x\n@check\n@returns Number\nexport fn asyncResult callback: await callback ()",
    );
    const p = new mod.Point(1);
    expect(mod.accept([p])).toEqual([p]);
    expect(() => mod.accept([{ x: 1 }])).toThrow();
    expect(typeof mod.marker).toBe("symbol");
    expect(() => mod.any(1)).toThrow(TypeError);
    expect(() => old.check(old.params(old.Any, (x: any) => x))(1)).toThrow(
      TypeError,
    );
    expect(() => mod.asyncResult(async () => 1)).toThrow(
      "does not satisfy return type",
    );
  });
  test("decorated recursion and nested implicit returns use decorated bindings", async () => {
    const mod = await moduleOf(
      '@describe "factorial"\nexport fn fact n:\n  if n < 2: 1\n  else: n * (fact n - 1)\nexport fn nested:\n  @describe "inner"\n  fn inner: 7',
    );
    expect(mod.fact(5)).toBe(120);
    expect(mod.nested()()).toBe(7);
    expect(mod.nested().__doc__).toBe("inner");
  });
  test("custom decorators named params are ordinary functions", async () => {
    const mod = await moduleOf(
      "export fn make params:\n  @params 42\n  fn value x: x\n  value",
    );
    expect(
      mod.make((n: number, fn: any) => {
        expect(n).toBe(42);
        return fn;
      })(3),
    ).toBe(3);
  });
});

describe("bindings in collection elements and call arguments", () => {
  test("saved array fixture hoists its binding", async () => {
    const mod = await moduleOf(
      "export fn run a double:\n  result = [(a -> double => b)]\n  [result b]",
    );
    expect(mod.run(3, (x: number) => x * 2)).toEqual([[6], 6]);
  });
  test("mapped bindings execute once before mapping, including empty collections", async () => {
    const mod = await moduleOf(
      "export fn run a add source:\n  result = a -> * add (source () => x)\n  [result x]",
    );
    let calls = 0;
    expect(
      mod.run(
        [1, 2],
        (x: number, y: number) => x + y,
        () => ++calls,
      ),
    ).toEqual([[2, 3], 1]);
    expect(
      mod.run(
        [],
        (x: number, y: number) => x + y,
        () => ++calls,
      ),
    ).toEqual([[], 2]);
    expect(calls).toBe(2);
  });
  test("nested bindings cannot disappear in unsupported expression contexts", () => {
    for (const text of [
      "true and (1 => x)",
      "true and [(1 => x)]",
      "1 < (work (1 => x))",
    ]) {
      const result = compile({ path: "invalid.kalandra", text });
      expect(result.output).toBeUndefined();
      expect(result.diagnostics.some((d) => d.code === "KAL4001")).toBe(true);
    }
  });
});

test("generated names avoid external decorator roots", async () => {
  const source = "@__kalandra0\nexport fn value: 1";
  const result = compile({ path: "names.kalandra", text: source });
  expect(result.output!.code).not.toContain("const __kalandra0 =");
  expect(result.output!.code).toContain("__kalandra0(");
});

test("decorated tail recursion matches executed pinned Clio output", async () => {
  const factory = new Function(
    tailProbe.code.replace("export default", "return"),
  )();
  const reference = await factory({
    ...old,
    exports: {},
    register: (_id: string, fn: unknown) => fn,
  });
  const current = await moduleOf(tailProbe.source);
  for (const module of [reference, current]) {
    expect(module.sum(100000, 0)).toBe(tailProbe.results.sum);
    expect(module.sum.__doc__).toBe(tailProbe.results.doc);
    expect(module.sum.__accepts__).toEqual([Number, Number]);
    expect(module.sum.__returns__).toBe(Number);
    expect(() => module.sum("bad", 0)).toThrow();
    let calls = 0;
    const count = module.make(
      (fn: (...args: number[]) => number) =>
        (...args: number[]) => {
          calls++;
          return fn(...args);
        },
    );
    expect(count(100000, 0)).toBe(tailProbe.results.decorated);
    expect(calls).toBe(tailProbe.results.calls);
    let pauses = 0;
    expect(
      await module.asyncSum(100000, 0, async (value: number) => {
        pauses++;
        return value;
      }),
    ).toBe(tailProbe.results.asyncSum);
    expect(pauses).toBe(1);
  }
});

test("decorated non-tail recursion still invokes the wrapper and shadowed calls are not loops", async () => {
  const module = await moduleOf(`export fn make decorate:
  @decorate
  fn factorial n:
    if n > 1: n * (factorial (n - 1))
    else: 1
  factorial
export fn shadow decorate:
  @decorate
  fn invoke invoke: invoke 4
  invoke`);
  let calls = 0;
  const decorate =
    (fn: (...args: any[]) => any) =>
    (...args: any[]) => {
      calls++;
      return fn(...args);
    };
  expect(module.make(decorate)(5)).toBe(120);
  expect(calls).toBe(5);
  expect(module.shadow(decorate)((n: number) => n + 1)).toBe(5);
});
