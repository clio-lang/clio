import { expect, test } from "bun:test";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { compileProject } from "../packages/compiler/src/index.js";
import {
  parseRemoteClientManifest,
  type RemoteClientManifest,
} from "../packages/protocol/src/remote-contract.js";

const source = `export type Point:
  Number z
  Number x
export type NamedPoint is Point:
  String name
@params NamedPoint
@returns NamedPoint
export fn echo point: point
export type Unused: dynamic
`;
async function service(text = source) {
  const result = await compileProject(
    "service.kalandra",
    { readSource: async () => text },
    { remoteServices: { echo: "echo" } },
  );
  expect(result.diagnostics).toEqual([]);
  return parseRemoteClientManifest(
    result.output!.files.get(result.output!.remote!.client)!.code,
  );
}
const contract = await service();
const named = contract.types!.NamedPoint!;
const point = contract.types!.Point!;
const compile = (
  source: string,
  contracts: Record<string, RemoteClientManifest> = { "a.json": contract },
) =>
  compileProject(
    "main.kalandra",
    {
      readSource: async (path) =>
        path === "main.kalandra"
          ? source
          : Object.hasOwn(contracts, path)
            ? JSON.stringify(contracts[path as keyof typeof contracts])
            : null,
    },
    { strictNames: true },
  );

test("contracts retain constructor order and parents, exposing only reachable exported types", () => {
  expect(contract.records![point]!.fields).toEqual([
    ["z", "number"],
    ["x", "number"],
  ]);
  expect(contract.records![named]).toEqual({
    name: "NamedPoint",
    parent: point,
    fields: [["name", "string"]],
  });
  expect(Object.keys(contract.types!)).toEqual(["NamedPoint", "Point"]);
  expect(
    Object.keys(contract.records!).some((id) => id.endsWith(":Unused")),
  ).toBe(false);
});

test("remote constructor aliases share identity and round trips retain inheritance", async () => {
  const result = await compile(
    `from "remote:./a.json" import Point NamedPoint echo
from "remote:./b.json" import NamedPoint as Alias
export Point
export NamedPoint
export Alias
@params NamedPoint
@check
fn checked value: value
export fn main:
  value = await echo (Alias "label" 1.5 2.5)
  checked value`,
    { "a.json": contract, "b.json": contract },
  );
  expect(result.diagnostics).toEqual([]);
  const dir = await mkdtemp(join(tmpdir(), "kalandra-remote-records-"));
  try {
    for (const [path, file] of result.output!.files) {
      await mkdir(dirname(join(dir, path)), { recursive: true });
      await Bun.write(join(dir, path), file.code);
    }
    const module = await import(
      pathToFileURL(join(dir, result.output!.entry)).href
    );
    const program = await import(
      pathToFileURL(join(dir, result.output!.runner)).href
    );
    expect(module.Alias).toBe(module.NamedPoint);
    const value = await program.run(
      async (task: any) => {
        expect(task.args[0].$record).toBe(named);
        expect(task.schema.args[0].record.id).toBe(named);
        expect(task.args[0].fields).toEqual({ name: "label", x: 2.5, z: 1.5 });
        return structuredClone(task.args[0]);
      },
      "main",
      [],
    );
    expect(value).toBeInstanceOf(module.NamedPoint);
    expect(value).toBeInstanceOf(module.Point);
    expect([value.name, value.z, value.x]).toEqual(["label", 1.5, 2.5]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("nominal records from different deployments and local look-alikes cannot cross the boundary", async () => {
  const other = await service(
    source.replace(
      "export fn echo point: point",
      "export fn echo point:\n  1 + 1\n  point",
    ),
  );
  expect(other.revision).not.toBe(contract.revision);
  const result = await compile(
    'from "remote:./a.json" import echo\nfrom "remote:./b.json" import NamedPoint\nexport fn main: await echo (NamedPoint "bad" 1 2)',
    { "a.json": contract, "b.json": other },
  );
  expect(result.output).toBeUndefined();
  expect(result.diagnostics.some((d) => d.code === "KAL3106")).toBe(true);
  const local = await compile(
    'from "remote:./a.json" import echo\ntype Point:\n  Number z\n  Number x\ntype NamedPoint is Point:\n  String name\nexport fn main: await echo (NamedPoint "bad" 1 2)',
  );
  expect(local.output).toBeUndefined();
  expect(local.diagnostics.some((d) => d.code === "KAL3106")).toBe(true);
  const wrong = await compile(
    'from "remote:./a.json" import NamedPoint echo\nexport fn main: await echo (NamedPoint 1 "wrong" 2)',
  );
  expect(wrong.output).toBeUndefined();
});

test("malformed declarations and conflicts are rejected before client emission", async () => {
  for (const mutate of [
    (value: any) => {
      delete value.records[point];
    },
    (value: any) => {
      value.records[point].parent = named;
    },
    (value: any) => {
      value.records[point].fields[0][1] = "string";
    },
    (value: any) => {
      value.types.echo = point;
    },
    (value: any) => {
      value.types.Broken = "missing";
    },
    (value: any) => {
      value.records[point].fields.push(["z", "number"]);
    },
    (value: any) => {
      const schema = JSON.parse(value.services.echo.schemas[0]);
      schema.result.record.fields[0][1] = "number";
      value.services.echo.schemas.push(JSON.stringify(schema));
    },
  ]) {
    const copy = structuredClone(contract);
    mutate(copy);
    expect(() => parseRemoteClientManifest(JSON.stringify(copy))).toThrow();
  }
  // Wire fields agree, but constructor order differs for the same deployment ID.
  const conflicting = structuredClone(contract) as any;
  conflicting.records[point].fields.reverse();
  expect(() =>
    parseRemoteClientManifest(JSON.stringify(conflicting)),
  ).not.toThrow();
  const result = await compile(
    'from "remote:./a.json" import echo\nfrom "remote:./b.json" import NamedPoint\nexport fn main: await echo (NamedPoint "bad" 1 2)',
    { "a.json": contract, "b.json": conflicting },
  );
  expect(result.output).toBeUndefined();
  expect(
    result.diagnostics.some(
      (d) => d.code === "KAL4302" && d.message.includes("Conflicting"),
    ),
  ).toBe(true);
});

test("local subclasses of remote records retain constructor order and identity through workers", async () => {
  const sources = new Map([
    ["a.json", JSON.stringify(contract)],
    [
      "types.kalandra",
      `import "remote:./a.json" as remote
from "remote:./a.json" import NamedPoint as Parent
export Parent
export type Local is remote.NamedPoint:
  Number extra
export type Leaf is Local:
  Number flag
list Leaves: Leaf
export type Box:
  Leaves values
`,
    ],
    [
      "work.kalandra",
      `from "./types" import Leaf Box
Leaf saved = Leaf 1 10 "saved" 3 4
@params Leaf
@returns Leaf
@check
fn child value:
  value.extra = value.extra + saved.extra
  value
@params Leaf
@returns Leaf
export fn work value: await |child| value
@params Box
@returns Box
@check
export fn boxed value: value
@params Number
@returns Leaf
export fn construct n: Leaf 0 n "built" 5 6
`,
    ],
    [
      "main.kalandra",
      `from "./types" import Parent Local Leaf Box
from "./work" import work boxed construct
export Parent
export Local
export Leaf
export fn main:
  value = await |construct| 2
  result = await |work| value
  box = await |boxed| (Box [result])
  box.values[0]
@params Leaf
export fn accept value: await |work| value
`,
    ],
  ]);
  const result = await compileProject(
    "main.kalandra",
    {
      readSource: async (path) => sources.get(path) ?? null,
    },
    { strictNames: true },
  );
  expect(result.diagnostics).toEqual([]);
  const dir = await mkdtemp(join(tmpdir(), "kalandra-remote-subclasses-"));
  const { createBunWorkerPool } =
    await import("../packages/runtime/hosts/bun/index.js");
  const pool = createBunWorkerPool({ maxWorkers: 1, maxQueuedTasks: 0 });
  try {
    for (const [path, file] of result.output!.files) {
      await mkdir(dirname(join(dir, path)), { recursive: true });
      await Bun.write(join(dir, path), file.code);
    }
    const module = await import(
      pathToFileURL(join(dir, result.output!.entry)).href
    );
    const program = await import(
      pathToFileURL(join(dir, result.output!.runner)).href
    );
    const run = (name: string, args: unknown[] = []) =>
      program.run((task: any) => pool.run(task), name, args);
    for (let i = 0; i < 2; i++) {
      const value = await run("main");
      expect(value).toBeInstanceOf(module.Leaf);
      expect(value).toBeInstanceOf(module.Local);
      expect(value).toBeInstanceOf(module.Parent);
      expect([value.flag, value.extra, value.name, value.z, value.x]).toEqual([
        0,
        12,
        "built",
        5,
        6,
      ]);
    }
    const original = new module.Leaf(1, 1, "copy", 2, 3);
    expect((await run("accept", [original])).extra).toBe(11);
    expect(original.extra).toBe(1);
    let getterCalls = 0;
    const accessor = new module.Leaf(1, 1, "getter", 2, 3);
    Object.defineProperty(accessor, "z", {
      enumerable: true,
      get() {
        getterCalls++;
        return 2;
      },
    });
    for (const invalid of [
      accessor,
      new module.Parent("base", 2, 3),
      new module.Local(1, "base", 2, 3),
      { flag: 1, extra: 1, name: "fake", z: 2, x: 3 },
      Object.assign(new module.Leaf(1, 1, "extra", 2, 3), { other: 0 }),
      new module.Leaf(1, 1, "wrong", "dynamic", 3),
    ])
      await expect(run("accept", [invalid])).rejects.toThrow();
    expect(getterCalls).toBe(0);
  } finally {
    await pool.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("local subclasses cannot impersonate remote parents or hide dynamic task fields", async () => {
  const remote = await compile(`from "remote:./a.json" import NamedPoint echo
type Local is NamedPoint:
  Number extra
export fn main: await echo (Local 1 "bad" 2 3)`);
  expect(remote.output).toBeUndefined();
  expect(remote.diagnostics.some((d) => d.code === "KAL3106")).toBe(true);
  const dynamic = await compile(`from "remote:./a.json" import Point
type Local is Point:
  extra
@params Local
@returns Local
fn identity value: value
export fn main: await |identity| (Local 1 2 3)`);
  expect(dynamic.output).toBeUndefined();
  expect(dynamic.diagnostics.some((d) => d.code === "KAL4202")).toBe(true);
  const mutable = await compile(`from "remote:./a.json" import echo * as rest
type Local is rest.Point:
  Number extra
@params Local
fn identity value: value
export fn main: await |identity| (Local 1 2 3)`);
  expect(mutable.output).toBeUndefined();
});

test("remote record annotations survive local workers, nested scheduling and remote round trips", async () => {
  const result =
    await compile(`from "remote:./a.json" import Point NamedPoint as Named echo
import "remote:./a.json" as math
export Point
export Named
list Names: math.NamedPoint
type Box:
  Names values

@params math.NamedPoint
@returns Named
fn child value:
  value.z = value.z + 1
  await echo value

@params Named
@returns Named
fn work value: await |child| value

@params Named
export fn accept value: await |work| value

@params Number
fn construct n: math.NamedPoint "new" n 2

@params Box
@returns Box
@check
fn boxed value: value

export fn main:
  value = await |construct| 1.5
  result = await |work| value
  container = await |boxed| (Box [result])
  container.values[0]
`);
  expect(result.diagnostics).toEqual([]);
  const dir = await mkdtemp(join(tmpdir(), "kalandra-remote-record-workers-"));
  const { createBunWorkerPool } =
    await import("../packages/runtime/hosts/bun/index.js");
  const calls: any[] = [];
  const pool = createBunWorkerPool({
    maxWorkers: 1,
    maxQueuedTasks: 0,
    dispatchRemote: async (task) => {
      calls.push(task);
      expect((task.schema!.args[0] as any).record.id).toBe(named);
      return structuredClone(task.args[0]);
    },
  });
  try {
    for (const [path, file] of result.output!.files) {
      await mkdir(dirname(join(dir, path)), { recursive: true });
      await Bun.write(join(dir, path), file.code);
    }
    const module = await import(
      pathToFileURL(join(dir, result.output!.entry)).href
    );
    const program = await import(
      pathToFileURL(join(dir, result.output!.runner)).href
    );
    const run = (name: string, args: unknown[] = []) =>
      program.run((task: any) => pool.run(task), name, args);
    const value = await run("main");
    expect(value).toBeInstanceOf(module.Named);
    expect(value).toBeInstanceOf(module.Point);
    expect([value.name, value.z, value.x]).toEqual(["new", 2.5, 2]);
    const original = new module.Named("copy", 3, 4);
    expect((await run("accept", [original])).z).toBe(4);
    expect(original.z).toBe(3);
    const count = calls.length;
    let getterCalls = 0;
    const accessor = new module.Named("getter", 1, 2);
    Object.defineProperty(accessor, "z", {
      enumerable: true,
      get() {
        getterCalls++;
        return 1;
      },
    });
    for (const invalid of [
      accessor,
      { name: "fake", z: 1, x: 2 },
      new module.Point(1, 2),
      Object.assign(new module.Named("extra", 1, 2), { extra: 3 }),
      new module.Named("bad", "dynamic", 2),
    ])
      await expect(run("accept", [invalid])).rejects.toThrow();
    expect(calls.length).toBe(count);
    expect(getterCalls).toBe(0);
  } finally {
    await pool.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("local worker signatures reject record identity mismatches and mutable namespace copies", async () => {
  const other = await service(
    source.replace(
      "export fn echo point: point",
      "export fn echo point:\n  1 + 1\n  point",
    ),
  );
  for (const [imports, value] of [
    ['from "remote:./b.json" import NamedPoint as Other', 'Other "bad" 1 2'],
    ["type Other:\n  String name\n  Number z\n  Number x", 'Other "bad" 1 2'],
  ]) {
    const result = await compile(
      `from "remote:./a.json" import NamedPoint
${imports}
@params NamedPoint
@returns NamedPoint
fn identity value: value
export fn main: await |identity| (${value})`,
      { "a.json": contract, "b.json": other },
    );
    expect(result.output).toBeUndefined();
    expect(result.diagnostics.some((d) => d.severity === "error")).toBe(true);
  }
  const mutable = await compile(
    'from "remote:./a.json" import echo * as rest\n@params rest.NamedPoint\nfn identity value: value\nexport fn main: await |identity| (rest.NamedPoint "bad" 1 2)',
  );
  expect(mutable.output).toBeUndefined();
});

test("worker extraction follows remote constructor re-exports and typed captures across local modules", async () => {
  const sources = new Map([
    [
      "main.kalandra",
      'from "./types" import Named\nfrom "./work" import work\nexport Named\nexport fn main: await |work| (Named "arg" 1 2)\n',
    ],
    [
      "types.kalandra",
      'from "remote:./a.json" import NamedPoint as Named\nexport Named\n',
    ],
    [
      "work.kalandra",
      'import "./types" as types\nfrom "./types" import Named\nNamed saved = Named "saved" 3 4\n@params types.Named\n@returns Named\n@check\nexport fn work value:\n  saved.z = saved.z + value.z\n  saved\n',
    ],
    ["a.json", JSON.stringify(contract)],
  ]);
  const result = await compileProject(
    "main.kalandra",
    { readSource: async (path) => sources.get(path) ?? null },
    { strictNames: true },
  );
  expect(result.diagnostics).toEqual([]);
  const dir = await mkdtemp(join(tmpdir(), "kalandra-remote-type-imports-"));
  const { createBunWorkerPool } =
    await import("../packages/runtime/hosts/bun/index.js");
  const pool = createBunWorkerPool({ maxWorkers: 1, maxQueuedTasks: 0 });
  try {
    for (const [path, file] of result.output!.files) {
      await mkdir(dirname(join(dir, path)), { recursive: true });
      await Bun.write(join(dir, path), file.code);
    }
    const module = await import(
      pathToFileURL(join(dir, result.output!.entry)).href
    );
    const program = await import(
      pathToFileURL(join(dir, result.output!.runner)).href
    );
    for (let index = 0; index < 2; index++) {
      const value = await program.run(
        (task: any) => pool.run(task),
        "main",
        [],
      );
      expect(value).toBeInstanceOf(module.Named);
      expect([value.name, value.z, value.x]).toEqual(["saved", 4, 4]);
    }
  } finally {
    await pool.close();
    await rm(dir, { recursive: true, force: true });
  }
});
