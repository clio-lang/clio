import { expect, test } from "bun:test";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { compileProject } from "../packages/compiler/src/index.js";
import {
  loadRemoteDeployment,
  createRemoteHandler,
  createRemoteDispatcher,
} from "../packages/runtime/hosts/bun/remote.js";
import { createBunWorkerPool } from "../packages/runtime/hosts/bun/index.js";

const source = `export type Settings:
  Number factor
Settings settings = Settings 3
@params Number
export fn multiply n:
  settings.factor = settings.factor + 1
  n * settings.factor
`;

async function build(text: string) {
  return compileProject(
    "main.kalandra",
    { readSource: async (path) => (path === "main.kalandra" ? text : null) },
    { strictNames: true, remoteServices: { calculate: "multiply" } },
  );
}
test("remote captures have private worker schemas and isolated server-owned snapshots", async () => {
  const result = await build(source);
  expect(result.diagnostics).toEqual([]);
  expect(result.output).toBeDefined();
  const output = result.output!;
  const client = JSON.parse(output.files.get(output.remote!.client)!.code);
  const manifest = JSON.parse(
    output.files.get(output.remote!.deployment)!.code,
  );
  expect(client.services.calculate.signature.args).toEqual(["number"]);
  expect(client.captures).toBeUndefined();
  expect(manifest.captures.bindings.calculate.schema.args.length).toBe(2);
  const directory = await mkdtemp(join(tmpdir(), "kalandra-captures-"));
  const pool = createBunWorkerPool({ maxWorkers: 1, maxQueuedTasks: 10 });
  let handler: ReturnType<typeof createRemoteHandler> | undefined;
  try {
    for (const [path, file] of output.files) {
      await mkdir(dirname(join(directory, path)), { recursive: true });
      await Bun.write(join(directory, path), file.code);
    }
    const deployment = await loadRemoteDeployment(
      join(directory, output.remote!.deployment),
    );
    handler = createRemoteHandler({
      deployment,
      token: "a".repeat(32),
      run: (task, options) => pool.run(task, options),
    });
    const call = createRemoteDispatcher({
      url: "http://127.0.0.1:3000",
      token: "a".repeat(32),
      revision: deployment.revision,
      routes: new Map([
        ["client#" + client.services.calculate.exportName, "calculate"],
      ]),
      fetch: (url, options) => handler!.fetch(new Request(url, options)),
    });
    const task = {
      module: "client",
      exportName: client.services.calculate.exportName,
      args: [4],
      schema: client.services.calculate.signature,
    };
    await expect(
      call({
        ...task,
        args: [4, 999],
        schema: { args: ["number", "number"], result: "number" },
      }),
    ).rejects.toThrow("409");
    expect(await call(task)).toBe(16);
    const mapped: import("../packages/runtime/src/index.js").ModuleTask = {
      ...task,
      args: [4, 0, [4, 5]],
      schema: {
        args: ["number", "number", { array: "number" }],
        result: "number",
      },
    };
    expect(await call(mapped)).toBe(16);
    expect(await Promise.all([call(mapped), call(mapped)])).toEqual([16, 16]);
    expect(await Promise.all([call(task), call(task)])).toEqual([16, 16]);
  } finally {
    await handler?.close();
    await pool.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("remote capture initializers reject dynamic setup without evaluating it", async () => {
  for (const declaration of [
    "Number factor = console.read ()",
    "Number factor = 3\nfactor = 4",
    "Number factor = 3\nalias = factor\nalias = 7",
    "Number factor = later\nNumber later = factor",
    "Number factor = 3\nfn decorate f: f\n@decorate\nfn unused: 1",
  ]) {
    const result = await build(
      declaration + "\n@params Number\nexport fn multiply n: n * factor\n",
    );
    expect(result.output).toBeUndefined();
    expect(result.diagnostics.some((d) => d.severity === "error")).toBe(true);
  }
});

test("bootstrap initialization has a deadline, is cancellable and validates plans before evaluation", async () => {
  const result = (await build(source)).output!;
  const directory = await mkdtemp(join(tmpdir(), "kalandra-bootstrap-"));
  try {
    for (const [path, file] of result.files) {
      await mkdir(dirname(join(directory, path)), { recursive: true });
      await Bun.write(join(directory, path), file.code);
    }
    const path = join(directory, result.remote!.deployment);
    const original = result.files.get(result.remote!.deployment)!.code;
    const manifest = JSON.parse(original);
    manifest.captures.bindings.calculate.indices = [999];
    await Bun.write(path, JSON.stringify(manifest));
    await expect(loadRemoteDeployment(path)).rejects.toThrow("indices");
    manifest.captures.bindings.calculate.indices = [0];
    manifest.captures.bindings.calculate.schema.args = ["number"];
    await Bun.write(path, JSON.stringify(manifest));
    await expect(loadRemoteDeployment(path)).rejects.toThrow("schema");
    await Bun.write(path, original);

    const bootstrapPath = join(directory, ".kalandra/bootstrap.mjs");
    const bootstrap = result.files.get(".kalandra/bootstrap.mjs")!.code;
    const pidFile = join(directory, "bootstrap.pid");
    await Bun.write(
      bootstrapPath,
      'import { writeFileSync } from "node:fs";\n'.replace("\\n", "\n") +
        bootstrap.replace(
          "export function initialize() {",
          `export function initialize() { writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); while (true) {}`,
        ),
    );
    await expect(
      loadRemoteDeployment(path, { timeoutMs: 500 }),
    ).rejects.toThrow("deadline");
    const firstPid = Number(await Bun.file(pidFile).text());
    expect(() => process.kill(firstPid, 0)).toThrow();

    const controller = new AbortController();
    const loading = loadRemoteDeployment(path, { signal: controller.signal });
    const rejected = loading.then(
      () => null,
      (error) => error,
    );
    const started = Date.now();
    let secondPid = firstPid;
    while (secondPid === firstPid && Date.now() - started < 2000) {
      await Bun.sleep(10);
      secondPid = Number(await Bun.file(pidFile).text());
    }
    expect(secondPid).not.toBe(firstPid);
    controller.abort();
    expect(await rejected).toBeInstanceOf(Error);
    expect(() => process.kill(secondPid, 0)).toThrow();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("shared and transitive captures have one bootstrap identity, separate from public schemas", async () => {
  const sources = new Map([
    ["main.kalandra", 'from "./helper" import multiply\nexport multiply\n'],
    [
      "helper.kalandra",
      "Number base = 2\nNumber factor = base + 1\n@params Number\nfn helper n: n * factor\n@params Number\nexport fn multiply n: helper n\n",
    ],
  ]);
  const result = await compileProject(
    "main.kalandra",
    { readSource: async (path) => sources.get(path) ?? null },
    { strictNames: true, remoteServices: { calculate: "multiply" } },
  );
  expect(result.diagnostics).toEqual([]);
  const manifest = JSON.parse(
    result.output!.files.get("kalandra.deployment.json")!.code,
  );
  expect(manifest.captures.bindings.calculate.indices).toEqual([0]);
  const code = result.output!.files.get(".kalandra/bootstrap.mjs")!.code;
  expect(code).toContain("const c0 = 2");
  expect(code).not.toContain("helper.kalandra");
});
