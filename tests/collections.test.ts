import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { compile, analyze, typeName } from "../packages/compiler/src/index.js";
import corpus from "./fixtures/clio/corpus.json";
import runtime from "./fixtures/clio/runtime.json";

async function moduleOf(text: string) {
  const result = compile({ path: "collections.kalandra", text });
  expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  expect(result.output).toBeDefined();
  const dir = await mkdtemp(join(tmpdir(), "kalandra-collections-"));
  try {
    const file = join(dir, "module.mjs");
    await Bun.write(file, result.output!.code);
    return await import(pathToFileURL(file).href);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
// Trusted, committed upstream helper code; no installed Clio compiler/runtime needed.
const old = new Function(
  runtime.sources.range.replaceAll("export ", "") +
    "\n" +
    runtime.sources.slice
      .replace(/^import .*$/gm, "")
      .replace("export default slice;", "") +
    "\n" +
    runtime.sources.format.replace("export default", "const f =") +
    "\nreturn {range, slice, f};",
)();
const sample = (name: string) => corpus.accepted.find((f) => f.name === name)!;

describe("collection compatibility", () => {
  test("range defaults, endpoints, iteration, and historical edge cases", async () => {
    const mod = await moduleOf(
      "export fn make start end step: range start end step\nexport fn open: ..\nexport fn bounds: 0..10 by 2",
    );
    expect([...mod.bounds()]).toEqual([0, 2, 4, 6, 8]);
    expect([...mod.open().take(3)]).toEqual([0, 1, 2]);
    for (const args of [
      [0, 10, 2],
      [0, 5, 2],
      [5, 0, undefined],
      [0, 0, 1],
      [0, 3, 0],
      [undefined, 4, undefined],
    ]) {
      const a = mod.make(...args),
        b = old.range(...args);
      expect(a.length).toBe(b.length);
      expect(a.toString()).toBe(b.toString());
      expect([...a]).toEqual([...b]);
      expect([...a]).toEqual([...b]); // completed iterators reset
      for (const index of [-1, 0, 2, 5, 6])
        expect(a.get(index)).toBe(b.get(index));
      expect([...a.skip(1).take(2)]).toEqual([...b.skip(1).take(2)]);
      expect([...a.slice(1, 3)]).toEqual([...b.slice(1, 3)]);
    }
  });
  test("range maps are lazy, composed, and include the terminal callback", async () => {
    const mod = await moduleOf("export fn mapped callback: 0..3 -> * callback");
    const calls: unknown[] = [],
      referenceCalls: unknown[] = [];
    const a = mod.mapped((value: number, index: number, range: any) => {
      calls.push([value, index, range.start]);
      return value * 2;
    });
    const b = old
      .range(0, 3)
      .map((value: number, index: number, range: any) => {
        referenceCalls.push([value, index, range.start]);
        return value * 2;
      });
    expect(calls).toEqual([]);
    expect([...a.map((x: number) => x + 1)]).toEqual([
      ...b.map((x: number) => x + 1),
    ]);
    expect(calls).toEqual(referenceCalls);
    expect(calls).toHaveLength(4);
  });
  test("explicit slice helper preserves scalar, multiple, nested, and range slicing", async () => {
    const mod = await moduleOf(
      "export fn sliced items indices: slice items indices\nexport fn span items: slice items (0..4)\nexport fn rangeItems: slice (0..10 by 2) [0 1 2]",
    );
    for (const indices of [[1], [0, 2], [-1], [3]])
      expect(mod.sliced([10, 20, 30], indices)).toEqual(
        old.slice([10, 20, 30], indices),
      );
    expect(
      mod.sliced(
        [
          [1, 2],
          [3, 4],
        ],
        [[0], [1]],
      ),
    ).toEqual(
      old.slice(
        [
          [1, 2],
          [3, 4],
        ],
        [[0], [1]],
      ),
    );
    expect(mod.span([10, 20, 30])).toEqual(
      old.slice([10, 20, 30], old.range(0, 4)),
    );
    expect(mod.rangeItems()).toEqual([0, 2, 4]);
  });
  test("brackets preserve JavaScript property lookup, not helper slicing", async () => {
    const mod = await moduleOf(
      "export fn scalar arr: arr[0]\nexport fn multiple arr first last: arr[(first ()) (last ())]\nexport fn span arr: arr[0..100]",
    );
    expect(mod.scalar([10, 20])).toBe(10);
    const calls: number[] = [];
    expect(
      mod.multiple(
        [10, 20],
        () => {
          calls.push(0);
          return 0;
        },
        () => {
          calls.push(1);
          return 1;
        },
      ),
    ).toBe(20);
    expect(calls).toEqual([0, 1]);
    const arr = { "[0:100:1]": 42 };
    const legacy = new Function(
      "arr",
      "range",
      `return ${sample("Slice").expectedJavaScript}`,
    );
    expect(mod.span(arr)).toBe(legacy(arr, old.range));
  });
  test("map passes metadata and evaluates explicit arguments per item", async () => {
    const mod = await moduleOf(
      "export fn bare items callback: items -> * callback\nexport fn extra items callback arg: items -> * callback (arg ())",
    );
    const items = [2, 3];
    let count = 0;
    expect(
      mod.bare(items, (x: number, i: number, a: number[]) => [
        x,
        i,
        a === items,
      ]),
    ).toEqual([
      [2, 0, true],
      [3, 1, true],
    ]);
    expect(
      mod.extra(
        items,
        (x: number, arg: number, i: number, a: number[]) => [
          x,
          arg,
          i,
          a === items,
        ],
        () => ++count,
      ),
    ).toEqual([
      [2, 1, 0, true],
      [3, 2, 1, true],
    ]);
    expect(count).toBe(2);
    mod.extra(
      [],
      () => {},
      () => ++count,
    );
    expect(count).toBe(2);
  });
  test("mapped method calls retain receiver and omit callback metadata", async () => {
    const mod = await moduleOf(
      "export fn methods items: items -> * .read\nexport fn extra items x: items -> * .read x",
    );
    const obj = {
      value: 7,
      read(...args: unknown[]) {
        return [this.value, ...args];
      },
    };
    expect(mod.methods([obj])).toEqual([[7]]);
    expect(mod.extra([obj], 2)).toEqual([[7, 2]]);
  });
  test("await and await-all differ for mapped results; explicit awaits are per item", async () => {
    const mod = await moduleOf(
      "export fn plain items callback: items -> * await callback\nexport fn all items callback: items -> * [await] callback\nexport fn args items callback fetch: items -> * callback (await fetch ())\nexport fn lazy callback: 0..3 -> * [await] callback",
    );
    const promises = await mod.plain([1, 2], async (x: number) => x * 2);
    expect(promises[0]).toBeInstanceOf(Promise);
    expect(await mod.all([1, 2], async (x: number) => x * 2)).toEqual([2, 4]);
    expect(
      await Promise.all(
        await mod.args(
          [1, 2],
          (x: number, y: number) => x + y,
          async () => 3,
        ),
      ),
    ).toEqual([4, 5]);
    expect(await mod.lazy(async (x: number) => x * 2)).toEqual([0, 2, 4]);
  });
});

describe("formats and declared types", () => {
  test.each([
    "Formatted String",
    "Formatted String (Single)",
    "Formatted String (Empty)",
    "Formatted String (Escape)",
  ])("saved output: %s", async (name) => {
    const fixture = sample(name);
    const mod = await moduleOf(`export fn run a double: ${fixture.source}`);
    const legacy = new Function(
      "f",
      "a",
      "double",
      `return ${fixture.expectedJavaScript}`,
    );
    expect(mod.run(3, (x: number) => x * 2)).toBe(
      legacy(old.f, 3, (x: number) => x * 2),
    );
  });
  test("custom tags receive individual escape arguments and empty interpolation null", async () => {
    const mod = await moduleOf(
      'export fn run tag value: tag"a\\n\\{x}{value}{}"\nexport fn empty tag: tag""\nexport fn shadow f: f"hello"',
    );
    expect(mod.run((...args: unknown[]) => args, undefined)).toEqual([
      "a",
      "\n",
      "{",
      "x}",
      undefined,
      null,
    ]);
    expect(mod.empty((...args: unknown[]) => args)).toEqual([]);
    expect(mod.shadow((x: string) => x.toUpperCase())).toBe("HELLO");
  });
  test("records, derived constructor ordering, members, and list descriptors", async () => {
    const source =
      'export type Point: x y\nexport type Location is Point: name\nexport list Points: Point\nexport fn point: Point 1 2\nexport fn location: Location "here" 3 4\nexport fn mapped items: items -> * Point';
    const mod = await moduleOf(source);
    expect(mod.point()).toBeInstanceOf(mod.Point);
    const location = mod.location();
    expect(location).toBeInstanceOf(mod.Point);
    expect(location).toBeInstanceOf(mod.Location);
    expect({ ...location }).toEqual({ x: 3, y: 4, name: "here" });
    expect(mod.Point.name).toBe("Point");
    expect(mod.Location.members).toBe(2);
    expect(mod.Points).toEqual([mod.Point]);
    expect(mod.mapped([10, 20]).map((x: any) => ({ ...x }))).toEqual([
      { x: 10, y: 0 },
      { x: 20, y: 1 },
    ]);
  });
  test("typed constructors match saved record fixture behavior", async () => {
    const fixture = corpus.accepted.find(
      (f) => f.source === "export type Point: x y",
    )!;
    const legacy = new Function(
      "clio",
      fixture.expectedJavaScript + ";return Point;",
    )({ exports: {} });
    const mod = await moduleOf(fixture.source);
    expect({ ...new mod.Point(2, 5) }).toEqual({ ...new legacy(2, 5) });
    expect(mod.Point.members).toBe(legacy.members);
  });
});

test("mapped ranges retain their type", () => {
  const result = analyze({
    path: "types.kalandra",
    text: "fn double x: 2\n1..4 -> * double",
  });
  expect(typeName(result.model!.types.get(result.program!.body.at(-1)!)!)).toBe(
    "Range<Number>",
  );
});

test("helper sources are separately mapped and only included when needed", () => {
  const simple = compile({ path: "simple.kalandra", text: "export x = 1" });
  expect(JSON.parse(simple.output!.sourceMap).sources).toEqual([
    "simple.kalandra",
  ]);
  const ranged = compile({ path: "range.kalandra", text: "export x = 0..3" });
  const map = JSON.parse(ranged.output!.sourceMap);
  expect(map.sources).toEqual([
    "range.kalandra",
    "kalandra:compatibility-helpers.js",
  ]);
  expect(map.sourcesContent[0]).toBe("export x = 0..3");
  expect(map.sourcesContent[1]).toContain("class Range");
});

describe("saved mapped-pipe output", () => {
  test.each([
    "Map",
    "Map (w/args)",
    "Flow (Map)",
    "Flow (Chain Map)",
    "Flow (Chain Maps)",
  ])("%s", async (name) => {
    const fixture = sample(name);
    const mod = await moduleOf(
      `export fn run a double add print: ${fixture.source}`,
    );
    const reference = new Function(
      "a",
      "double",
      "add",
      "print",
      `return ${fixture.expectedJavaScript}`,
    );
    const args = [
      [2, 4],
      (x: number) => x * 2,
      (...args: unknown[]) => args,
      (x: unknown) => x,
    ];
    expect(mod.run(...args)).toEqual(reference(...args));
  });
  test("member callbacks are detached without extra arguments and bound with them", async () => {
    const mod = await moduleOf(
      "export fn bare items obj: items -> * obj.read\nexport fn extra items obj: items -> * obj.read 2",
    );
    const obj = {
      read(this: unknown) {
        return this === obj;
      },
    };
    expect(mod.bare([1], obj)).toEqual([false]);
    expect(mod.extra([1], obj)).toEqual([true]);
  });
  test("pipe constructors retain callee types for both bare and explicit-argument targets", async () => {
    const mod = await moduleOf(
      "export type Point: x y\nexport fn first: 1 -> Point\nexport fn both: 1 -> Point 2",
    );
    expect(mod.first()).toBeInstanceOf(mod.Point);
    expect({ ...mod.both() }).toEqual({ x: 1, y: 2 });
  });
});

describe("indexed assignment compatibility", () => {
  test("numeric, string, multiple and range indices use JavaScript property writes", async () => {
    const mod =
      await moduleOf(`export fn write items index value: items[index] = value
export fn multiple items first last value: items[first last] = value
export fn span items value: items[0..3] = value
export fn nested items value: items[0][1] = value`);
    const items = [1, 2, 3];
    expect(mod.write(items, 1, 9)).toBe(9);
    expect(mod.multiple(items, 0, 2, 8)).toBe(8);
    expect(items).toEqual([1, 9, 8]);
    const object: Record<string, number> = {};
    expect(mod.write(object, "key", 4)).toBe(4);
    expect(mod.span(object, 5)).toBe(5);
    expect(object).toEqual({ key: 4, "[0:3:1]": 5 });
    const matrix = [[1, 2]];
    expect(mod.nested(matrix, 7)).toBe(7);
    expect(matrix).toEqual([[1, 7]]);
  });
  test("implicit returns re-evaluate the target and read the stored value", async () => {
    // The pinned Clio assignment generator emits target=value; its return
    // generator emits return target. Retain both evaluations, including accessors.
    const mod =
      await moduleOf(`export fn write target index value: target.items[(index ())] = value ()
export fn silent target index value:
  target.items[(index ())] = value ()
  42`);
    const events: string[] = [];
    let stored = 0;
    const object = {
      set key(value: number) {
        events.push("set");
        stored = value * 2;
      },
      get key() {
        events.push("get");
        return stored;
      },
    };
    const target = {
      get items() {
        events.push("target");
        return object;
      },
    };
    const index = () => {
      events.push("index");
      return "key";
    };
    const value = () => {
      events.push("value");
      return 3;
    };
    expect(mod.write(target, index, value)).toBe(6);
    expect(events).toEqual([
      "target",
      "index",
      "value",
      "set",
      "target",
      "index",
      "get",
    ]);
    events.length = 0;
    expect(mod.silent(target, index, value)).toBe(42);
    expect(events).toEqual(["target", "index", "value", "set"]);
  });
  test("flow assignments read back the property before continuing the pipe", async () => {
    const mod = await moduleOf(
      `export fn flow items index value consume: value => items[index] -> consume`,
    );
    let stored = 0;
    const object = {
      set key(value: number) {
        stored = value * 2;
      },
      get key() {
        return stored;
      },
    };
    expect(mod.flow(object, "key", 3, (value: number) => value + 1)).toBe(7);
  });
  test("async target, indices and values retain their evaluation order", async () => {
    const mod = await moduleOf(
      `export fn write target first last value: target.items[(await first ()) (await last ())] = await value ()`,
    );
    const events: string[] = [];
    const items = [1, 2];
    const step = (name: string, value: unknown) => async () => {
      events.push(name);
      return value;
    };
    expect(
      await mod.write(
        {
          get items() {
            events.push("target");
            return items;
          },
        },
        step("first", 0),
        step("last", 1),
        step("value", 9),
      ),
    ).toBe(9);
    expect(items).toEqual([1, 9]);
    expect(events).toEqual([
      "target",
      "first",
      "last",
      "value",
      "target",
      "first",
      "last",
    ]);
  });
  test("typed element mismatches and empty bracket targets remain diagnostics", () => {
    const mismatch = compile({
      path: "write.kalandra",
      text: `list Numbers: Number\nNumbers items = [1]\nitems[0] = "wrong"`,
    });
    expect(mismatch.output).toBeUndefined();
    expect(mismatch.diagnostics.some((d) => d.code === "KAL3111")).toBe(true);
    const empty = compile({ path: "write.kalandra", text: "items[] = 1" });
    expect(empty.output).toBeUndefined();
    expect(empty.diagnostics.some((d) => d.severity === "error")).toBe(true);
  });
});
