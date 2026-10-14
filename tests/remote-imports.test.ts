import { expect, test } from "bun:test";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  compileProject,
  analyzeProject,
} from "../packages/compiler/src/index.js";
import { loadRemoteImportDispatcher } from "../packages/runtime/hosts/bun/remote.js";
import { parseRemoteImportManifest } from "../packages/protocol/src/remote-contract.js";

const server = await compileProject(
  "service.kalandra",
  {
    readSource: async () =>
      "@params Number\n@returns Number\nexport fn double n: n * 2",
  },
  { remoteServices: { double: "double" } },
);
const contract = server.output!.files.get(server.output!.remote!.client)!.code;
const prefix = 'from "remote:./math.json" import double\n';
const build = (source: string, text = contract) =>
  compileProject(
    "main.kalandra",
    {
      readSource: async (path) =>
        path === "main.kalandra" ? source : path === "math.json" ? text : null,
    },
    { strictNames: true },
  );

test("independent clients check named, aliased, namespace and explicit parallel calls", async () => {
  const result = await build(
    prefix +
      'import "remote:./math.json" as math\nfrom "remote:./math.json" import double as twice\nexport fn main:\n  [(await double 1.5) (2.5 -> await twice) (await math.double 3.5) (await |double| 4.5) (await double.parallel 5.5)]',
  );
  expect(result.diagnostics).toEqual([]);
  expect(result.output!.remoteImports).toBe("kalandra.remotes.json");
  expect([...result.sources.keys()]).toEqual(["main.kalandra"]);
  expect(result.manifests!.get("math.json")!.text).toBe(contract);
  expect(
    [...result.output!.files.keys()].some((path) =>
      path.includes("service.kalandra"),
    ),
  ).toBe(false);
  const dir = await mkdtemp(join(tmpdir(), "kalandra-remote-imports-"));
  try {
    for (const [path, file] of result.output!.files) {
      await mkdir(dirname(join(dir, path)), { recursive: true });
      await Bun.write(join(dir, path), file.code);
    }
    const program = await import(
      pathToFileURL(join(dir, result.output!.runner)).href
    );
    const calls: unknown[] = [];
    expect(
      await program.run(
        async (task: any) => {
          calls.push(task);
          expect(task.module).toBe("kalandra-remote:math.json/double");
          expect(task.schema).toEqual({ args: ["number"], result: "number" });
          return task.args[0] * 2;
        },
        "main",
        [],
      ),
    ).toEqual([3, 5, 7, 9, 11]);
    expect(calls.length).toBe(5);
    const manifestPath = join(dir, result.output!.remoteImports!);
    await expect(
      loadRemoteImportDispatcher(manifestPath, new Map()),
    ).rejects.toThrow("Missing remote endpoint");
    const dispatch = await loadRemoteImportDispatcher(
      manifestPath,
      new Map([
        ["math.json", { url: "http://127.0.0.1:1", token: "x".repeat(32) }],
      ]),
      { local: async () => 42 },
    );
    expect(
      await dispatch({
        module: "file:///local.mjs",
        exportName: "main",
        args: [],
      }),
    ).toBe(42);
    await expect(
      dispatch({
        module: "kalandra-remote:unknown/work",
        exportName: "main",
        args: [],
      }),
    ).rejects.toThrow("No dispatcher");
    await expect(
      dispatch({
        ...(calls[0] as any),
        schema: { args: ["string"], result: "number" },
      }),
    ).rejects.toThrow("does not match");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("remote boundaries reject Any, missing arguments, unawaited inputs and disguised dynamic results", async () => {
  for (const body of [
    'export fn main: double "wrong"',
    "export fn main x: double x",
    "export fn main: double ()",
    "export fn main: double (double 1)",
    "@params Number\n@returns Number\nfn dynamic n: n.value\nexport fn main: double (dynamic 1)",
    "export fn main: double 1 2",
    "export fn main: double",
    'alias = double\nexport fn main: alias "wrong"',
    "alias = double\nexport fn main n: alias n",
    "alias = double\nexport fn main: alias ()",
    "alias = double\nexport fn main: alias (alias 1)",
    "alias = double\nexport fn main: alias",
    "alias = double\nexport fn main: double alias",
    "export alias = double",
    "fn choose: double\nexport fn main: choose ()",
    "fn invoke f n: f n\nexport fn main: invoke double 1",
    "export fn main: alias = double",
    "alias = double\nexport fn main: [alias]",
    "export double",
  ]) {
    const result = await build(prefix + body);
    expect(result.output, body).toBeUndefined();
    expect(
      result.diagnostics.some((d) => d.severity === "error"),
      body,
    ).toBe(true);
  }
  for (const body of [
    "export fn main: math",
    "alias = math\nexport fn main: alias.double 1",
    "math.double = 1\nexport fn main: math.double 2",
  ]) {
    expect(
      (await build('import "remote:./math.json" as math\n' + body)).output,
      body,
    ).toBeUndefined();
  }
});

test("invalid and missing contracts fail before output and cannot escape the source root", async () => {
  for (const source of [
    'from "remote:../escape.json" import double',
    'from "remote:https://example.com/math.json" import double',
    'from "remote:./missing.json" import double',
    'from "remote:./math.json" import missing',
  ])
    expect((await build(source)).output).toBeUndefined();
  for (const text of [
    "{}",
    "{",
    JSON.stringify({ ...JSON.parse(contract), version: 99 }),
  ]) {
    const result = await build(prefix + "export fn main: double 1", text);
    expect(result.output).toBeUndefined();
    expect(
      result.diagnostics.some(
        (d) => d.code === "KAL4302" && d.span?.file === "main.kalandra",
      ),
    ).toBe(true);
  }
});

test("project analysis loads contract signatures and checks strict remote arguments without emitting", async () => {
  const result = await analyzeProject("main.kalandra", {
    readSource: async (path) =>
      path === "main.kalandra"
        ? prefix + "export fn main x: double x"
        : contract,
  });
  expect(result.output).toBeUndefined();
  expect(
    result.diagnostics.some(
      (d) => d.code === "KAL4202" && d.message.includes("Remote argument"),
    ),
  ).toBe(true);
  expect(
    result.modules.get("main.kalandra")!.model.scopes[0]!.symbols.get("double")!
      .type,
  ).toMatchObject({
    kind: "Callable",
    async: true,
    parameters: [{ kind: "Number" }],
    returns: { kind: "Number" },
  });
});

test("remote contracts preserve array and union call types and require record declarations", async () => {
  const makeContract = (signature: object) => {
    const input = JSON.parse(contract);
    input.services.double.signature = signature;
    input.services.double.schemas = [JSON.stringify(signature)];
    return JSON.stringify(input);
  };
  expect(
    (
      await build(
        prefix + "export fn main: await double [1 2]",
        makeContract({
          args: [{ array: "number" }],
          result: { array: "number" },
        }),
      )
    ).diagnostics,
  ).toEqual([]);
  const union = makeContract({
    args: [{ union: ["number", "string"] }],
    result: "number",
  });
  expect(
    (await build(prefix + "export fn main: await double 1", union)).diagnostics,
  ).toEqual([]);
  const record = makeContract({
    args: [],
    result: { record: { id: "Point", fields: [["x", "number"]] } },
  });
  const rejected = await build(
    prefix + "export fn main: await double ()",
    record,
  );
  expect(rejected.output).toBeUndefined();
  expect(
    rejected.diagnostics.some((d) =>
      d.message.includes("Remote record declarations are required"),
    ),
  ).toBe(true);
});

test("remote import manifests reject malformed routing groups", () => {
  for (const value of [
    { version: 2, contracts: { "math.json": JSON.parse(contract) } },
    { version: 1, contracts: {} },
    { version: 1, contracts: { "../escape.json": JSON.parse(contract) } },
  ])
    expect(() => parseRemoteImportManifest(JSON.stringify(value))).toThrow();
});

test("editor project cache refreshes changed and newly available remote contracts", async () => {
  const { ProjectIndex } =
    await import("../packages/language-server/src/project-index.js");
  const index = new ProjectIndex({ strictNames: true });
  let text: string | null = null;
  const read = async (path: string) =>
    path === "main.kalandra" ? prefix + "export fn main: await double 2" : text;
  expect(
    (await index.analyze("/project", "main.kalandra", read)).diagnostics.some(
      (d) => d.code === "KAL4302",
    ),
  ).toBe(true);
  text = contract;
  expect(
    (await index.analyze("/project", "main.kalandra", read)).diagnostics,
  ).toEqual([]);
  const changed = JSON.parse(contract);
  changed.services.double.signature.args = ["string"];
  changed.services.double.schemas = [
    JSON.stringify(changed.services.double.signature),
  ];
  text = JSON.stringify(changed);
  expect(
    (await index.analyze("/project", "main.kalandra", read)).diagnostics.some(
      (d) => d.code === "KAL3106",
    ),
  ).toBe(true);
});

test("local workers route checked remote aliases, namespaces and transitive calls through the parent host", async () => {
  const sources = new Map([
    [
      "main.kalandra",
      'from "./helper" import work\nexport fn main: await |work| 2\n',
    ],
    [
      "helper.kalandra",
      prefix +
        'import "remote:./math.json" as math\nmoduleAlias = double\n@params Number\nfn helper n: await double n\n@params Number\nexport fn work n:\n  chosen = moduleAlias\n  again = (chosen)\n  named = math.double\n  parallel = double.parallel\n  wrapped = |double|\n  [(await helper n) (await again n) (await named n) (await parallel n) (await wrapped n)]\n',
    ],
    ["math.json", contract],
  ]);
  const result = await compileProject(
    "main.kalandra",
    { readSource: async (path) => sources.get(path) ?? null },
    { strictNames: true },
  );
  expect(result.diagnostics).toEqual([]);
  const dir = await mkdtemp(join(tmpdir(), "kalandra-remote-workers-"));
  const { createBunWorkerPool } =
    await import("../packages/runtime/hosts/bun/index.js");
  const calls: string[] = [];
  const pool = createBunWorkerPool({
    maxWorkers: 1,
    maxQueuedTasks: 0,
    dispatchRemote: async (task) => {
      calls.push(task.module);
      expect(task.schema).toEqual({ args: ["number"], result: "number" });
      return (task.args[0] as number) * 2;
    },
  });
  try {
    for (const [path, file] of result.output!.files) {
      await mkdir(dirname(join(dir, path)), { recursive: true });
      await Bun.write(join(dir, path), file.code);
    }
    const program = await import(
      pathToFileURL(join(dir, result.output!.runner)).href
    );
    expect(
      await program.run((task: any) => pool.run(task), "main", []),
    ).toEqual([4, 4, 4, 4, 4]);
    expect(calls.length).toBe(5);
    expect(calls.every((module) => module.startsWith("kalandra-remote:"))).toBe(
      true,
    );
  } finally {
    await pool.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("worker remote calls retain strict argument checks and services declare outbound contracts", async () => {
  const invalid = await build(
    prefix +
      "@params Number\nfn work n: await double n.value\nexport fn main: await |work| 2\n",
  );
  expect(invalid.output).toBeUndefined();
  const sources = new Map([
    [
      "main.kalandra",
      prefix + "@params Number\nexport fn work n: await double n\n",
    ],
    ["math.json", contract],
  ]);
  const service = await compileProject(
    "main.kalandra",
    { readSource: async (path) => sources.get(path) ?? null },
    { remoteServices: { work: "work" } },
  );
  expect(service.diagnostics).toEqual([]);
  expect(service.output).toBeDefined();
  const deployment = JSON.parse(
    service.output!.files.get("kalandra.deployment.json")!.code,
  );
  expect(deployment.remoteImports).toBe("kalandra.remotes.json");
});

test("independent remote maps register callback metadata without server call sites", async () => {
  const service = await compileProject(
    "service.kalandra",
    {
      readSource: async () => `list Numbers: Number
@params Number Number
export fn scale n factor: n * factor
@params Number Number
export fn indexed n index: n + index
@params Number Number Numbers
export fn collection n index values: n + values[index]
Number offset = 10
@params Number
export fn captured n: n + offset`,
    },
    {
      remoteServices: {
        scale: "scale",
        indexed: "indexed",
        collection: "collection",
        captured: "captured",
      },
    },
  );
  expect(service.diagnostics).toEqual([]);
  const manifest = service.output!.files.get(
    service.output!.remote!.client,
  )!.code;
  const result = await build(
    `from "remote:./math.json" import scale indexed collection captured
import "remote:./math.json" as math
export fn main:
  a = [1 2] -> * [await] scale 3
  b = [1 2] -> * [await] indexed
  c = [1 2] -> * [await] math.collection
  d = [1 2] -> * [await] |captured|
  [a b c d]
`,
    manifest,
  );
  expect(result.diagnostics).toEqual([]);
  const dir = await mkdtemp(join(tmpdir(), "kalandra-remote-maps-"));
  try {
    for (const [path, file] of result.output!.files) {
      await mkdir(dirname(join(dir, path)), { recursive: true });
      await Bun.write(join(dir, path), file.code);
    }
    const program = await import(
      pathToFileURL(join(dir, result.output!.runner)).href
    );
    const calls: any[] = [];
    const values = await program.run(
      async (task: any) => {
        calls.push(task);
        const id = task.module.split("/").at(-1);
        expect(JSON.parse(manifest).services[id].schemas).toContain(
          JSON.stringify(task.schema),
        );
        const [n, extra, third, fourth] = task.args;
        if (id === "scale") {
          expect(fourth).toEqual([1, 2]);
          return n * extra;
        }
        expect(third).toEqual([1, 2]);
        return id === "indexed"
          ? n + extra
          : id === "collection"
            ? n + third[extra]
            : n + 10;
      },
      "main",
      [],
    );
    expect(values).toEqual([
      [3, 6],
      [1, 3],
      [2, 4],
      [11, 12],
    ]);
    expect(calls).toHaveLength(8);
    for (const body of [
      'export fn main: [1 2] -> * [await] scale "wrong"',
      "export fn main values: values -> * [await] captured",
      'export fn main: [1 "two"] -> * [await] captured',
    ])
      expect(
        (
          await build(
            'from "remote:./math.json" import scale captured\n' + body,
            manifest,
          )
        ).output,
      ).toBeUndefined();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("local remote aliases retain map schemas and respect lexical shadowing", async () => {
  const result = await build(
    prefix +
      `alias = double
@params Number
fn shadow alias: alias + 1
export fn main:
  chosen = alias
  mapped = [1 2] -> * [await] chosen
  [mapped (shadow 4)]
`,
  );
  expect(result.diagnostics).toEqual([]);
  const dir = await mkdtemp(join(tmpdir(), "kalandra-remote-alias-map-"));
  try {
    for (const [path, file] of result.output!.files) {
      await mkdir(dirname(join(dir, path)), { recursive: true });
      await Bun.write(join(dir, path), file.code);
    }
    const program = await import(
      pathToFileURL(join(dir, result.output!.runner)).href
    );
    const calls: any[] = [];
    const value = await program.run(
      async (task: any) => {
        calls.push(task);
        expect(task.module).toStartWith("kalandra-remote:math.json/double");
        expect(task.schema.result).toBe("number");
        expect(
          task.args.every((value: unknown) => typeof value !== "function"),
        ).toBe(true);
        return task.args[0] * 2;
      },
      "main",
      [],
    );
    expect(value).toEqual([[2, 4], 5]);
    expect(calls).toHaveLength(2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("local helpers pass and return checked handles without skipping effects in workers", async () => {
  const result = await build(
    prefix +
      `type Counter:
  Number count
@params Counter
fn choose state:
  state.count = state.count + 1
  double
fn identity f: f
@params Function Number
fn invoke f n: await f n
@params Number
fn work n:
  state = Counter 0
  picked = choose state
  forwarded = identity picked
  a = await invoke forwarded n
  b = await (choose state) n
  [a b state.count]
export fn main: await |work| 3
`,
  );
  expect(result.diagnostics).toEqual([]);
  const dir = await mkdtemp(join(tmpdir(), "kalandra-remote-helpers-"));
  const { createBunWorkerPool } =
    await import("../packages/runtime/hosts/bun/index.js");
  let calls = 0;
  const pool = createBunWorkerPool({
    maxWorkers: 1,
    maxQueuedTasks: 0,
    dispatchRemote: async (task) => {
      calls++;
      expect(task.args).toEqual([3]);
      expect(task.schema).toEqual({ args: ["number"], result: "number" });
      return 6;
    },
  });
  try {
    for (const [path, file] of result.output!.files) {
      await mkdir(dirname(join(dir, path)), { recursive: true });
      await Bun.write(join(dir, path), file.code);
    }
    const program = await import(
      pathToFileURL(join(dir, result.output!.runner)).href
    );
    expect(
      await program.run((task: any) => pool.run(task), "main", []),
    ).toEqual([6, 6, 2]);
    expect(calls).toBe(2);
  } finally {
    await pool.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("helper inference does not admit escapes, mixed identities or dynamic wire values", async () => {
  for (const source of [
    "fn choose: double\nexport fn main: [choose ()]",
    "fn choose: double\nexport fn main: double (choose ())",
    "@params Function Number\nexport fn invoke f n: await f n\nexport fn main: invoke double 1",
    "@params Function Number\nfn invoke f n: await f n\nalias = invoke\nexport fn main: alias double 1",
    "fn invoke f n: await f n\nexport fn main: invoke double 1",
    "@params Function Number\nfn invoke f n: await f n.value\nexport fn main: invoke double 1",
    "@params Function Number\nfn invoke f n: await f n\nexport fn main: await |invoke| double 1",
  ]) {
    const result = await build(prefix + source);
    expect(result.output, source).toBeUndefined();
  }
  const source =
    prefix +
    'from "remote:./other.json" import double as other\n@params Function Number\nfn invoke f n: await f n\nexport fn main: [(await invoke double 1) (await invoke other 2)]';
  const result = await compileProject(
    "main.kalandra",
    {
      readSource: async (path) =>
        path === "main.kalandra" ? source : contract,
    },
    { strictNames: true },
  );
  expect(result.output).toBeUndefined();
});
