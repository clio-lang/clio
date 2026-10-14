import assert from "node:assert/strict";
import { verifyRemoteCli } from "./verify-remote-cli.js";
import { mkdtemp, mkdir, rm, readFile, realpath, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = await realpath(await mkdtemp(join(tmpdir(), "kalandra-network-")));
let server: ReturnType<typeof Bun.spawn> | undefined;
try {
  let compilerUrl = new URL(
    "../packages/compiler/src/index.ts",
    import.meta.url,
  ).href;
  let runtimeUrl = new URL(
    "../packages/runtime/hosts/bun/remote.ts",
    import.meta.url,
  ).href;
  if (process.argv.includes("--built")) {
    await cp("dist/runtime", join(root, "runtime"), { recursive: true });
    await cp("dist/compiler", join(root, "compiler"), { recursive: true });
    compilerUrl = pathToFileURL(join(root, "compiler/index.js")).href;
    runtimeUrl = pathToFileURL(join(root, "runtime/bun/remote.js")).href;
  }
  const {
    createRemoteDispatcher: createDispatcher,
    loadRemoteClient,
    loadRemoteImportDispatcher,
  } = (await import(
    runtimeUrl
  )) as typeof import("../packages/runtime/hosts/bun/remote.js");
  const { compileProject } = (await import(
    compilerUrl
  )) as typeof import("../packages/compiler/src/index.js");
  const token =
    crypto.randomUUID().replaceAll("-", "") +
    crypto.randomUUID().replaceAll("-", "");
  let receiveStats: (value: {
    workers: number;
    activeRequests: number;
  }) => void = () => {};
  const stats = () =>
    new Promise<{ workers: number; activeRequests: number }>(
      (resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("Server stats timed out")),
          3000,
        );
        receiveStats = (value) => {
          clearTimeout(timer);
          resolve(value);
        };
        server!.send("stats");
      },
    );
  const sources = new Map(
    await Promise.all(
      ["main", "tasks"].map(
        async (name) =>
          [
            name + ".kalandra",
            await readFile(`tests/fixtures/network/${name}.kalandra`, "utf8"),
          ] as const,
      ),
    ),
  );
  const result = await compileProject(
    "main.kalandra",
    { readSource: async (path) => sources.get(path) ?? null },
    {
      strictNames: true,
      remoteServices: {
        calculate: "calculate",
        capturedCalculate: "capturedCalculate",
        capturedRecord: "capturedRecord",
        capturedNaN: "capturedNaN",
        broken: "broken",
        slow: "slow",
        echoPoint: "echoPoint",
        mapPoint: "mapPoint",
        echoNamed: "echoNamed",
        echoBox: "echoBox",
        choosePoint: "choosePoint",
      },
    },
  );
  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.output);
  assert.ok(result.output.remote);
  for (const [path, file] of result.output.files) {
    for (const side of ["client", "server"]) {
      const target = join(root, side, path);
      await mkdir(dirname(target), { recursive: true });
      await Bun.write(target, file.code);
    }
  }
  const { revision: buildRevision, routes } = await loadRemoteClient(
    join(root, "client", result.output.remote.client),
  );
  assert.equal(routes.size, 11);
  const config = join(root, "server", result.output.remote.deployment);
  server = Bun.spawn(
    [process.execPath, resolve("tests/network/server.ts"), config, runtimeUrl],
    {
      stdout: "pipe",
      stderr: "inherit",
      env: { ...process.env, KALANDRA_REMOTE_TOKEN: token },
      ipc: (message) =>
        receiveStats(message as { workers: number; activeRequests: number }),
    },
  );
  assert.ok(server.stdout && typeof server.stdout !== "number");
  const reader = server.stdout.getReader();
  const startup = setTimeout(() => server?.kill("SIGKILL"), 5000);
  let line = "";
  try {
    while (!line.includes("\n")) {
      const chunk = await reader.read();
      assert.ok(!chunk.done, "server exited before readiness");
      line += new TextDecoder().decode(chunk.value);
      assert.ok(line.length < 8192);
    }
  } finally {
    clearTimeout(startup);
    reader.releaseLock();
  }
  const ready = JSON.parse(line.split("\n")[0]!);
  assert.notEqual(ready.pid, process.pid);
  const program = await import(
    pathToFileURL(join(root, "client", result.output.runner)).href
  );
  const dispatcher = createDispatcher({
    url: ready.url,
    revision: buildRevision,
    token,
    routes,
  });
  assert.deepEqual(
    await program.run(dispatcher, "main", []),
    [3.25, 5.25, 7.25],
  );
  await assert.rejects(
    program.run(dispatcher, "failure", []),
    /Remote task failed:.*missing/,
  );
  await assert.rejects(
    program.run(dispatcher, "deadline", []),
    /Remote task failed: Task deadline exceeded/,
  );
  assert.deepEqual(
    await program.run(dispatcher, "main", []),
    [3.25, 5.25, 7.25],
  );
  await assert.rejects(
    program.run(
      createDispatcher({
        url: ready.url,
        revision: "wrong-build",
        token,
        routes,
      }),
      "main",
      [],
    ),
    /HTTP 409/,
  );
  await assert.rejects(
    program.run(
      createDispatcher({
        url: ready.url,
        revision: buildRevision,
        token: "x".repeat(64),
        routes,
      }),
      "main",
      [],
    ),
    /HTTP 401/,
  );
  // Compile a second client with only its own source and the JSON contract.
  const clientSource = await readFile(
    "tests/fixtures/network/remote-client.kalandra",
    "utf8",
  );
  const contract = result.output.files.get(result.output.remote.client)!.code;
  const imported = await compileProject(
    "main.kalandra",
    {
      readSource: async (path) =>
        path === "main.kalandra"
          ? clientSource
          : path === "math.client.json"
            ? contract
            : null,
    },
    { strictNames: true },
  );
  assert.deepEqual(imported.diagnostics, []);
  assert.ok(imported.output?.remoteImports);
  assert.deepEqual([...imported.sources.keys()], ["main.kalandra"]);
  assert.ok(
    ![...imported.output.files.keys()].some((path) =>
      path.includes("tasks.kalandra"),
    ),
  );
  for (const [path, file] of imported.output.files) {
    const target = join(root, "independent", path);
    await mkdir(dirname(target), { recursive: true });
    await Bun.write(target, file.code);
  }
  const remoteProgram = await import(
    pathToFileURL(join(root, "independent", imported.output.runner)).href
  );
  const importManifest = join(
    root,
    "independent",
    imported.output.remoteImports,
  );
  const endpoints = new Map([
    ["math.client.json", { url: ready.url as string, token }],
  ]);
  const remoteDispatch = await loadRemoteImportDispatcher(
    importManifest,
    endpoints,
  );
  assert.deepEqual(
    await remoteProgram.run(remoteDispatch, "captures", []),
    [4, 4],
  );
  assert.deepEqual(
    await remoteProgram.run(remoteDispatch, "captures", []),
    [4, 4],
  );
  assert.ok(
    Number.isNaN(await remoteProgram.run(remoteDispatch, "capturedNumber", [])),
  );
  const capturedRecord = await remoteProgram.run(
    remoteDispatch,
    "capturedRecords",
    [],
  );
  assert.equal(capturedRecord.name, "baseline");
  assert.equal(capturedRecord.z, 5.5);
  const { createBunWorkerPool } = await import(
    runtimeUrl.replace(/remote\.(ts|js)$/, "index.$1")
  );
  const localPool = createBunWorkerPool({
    maxWorkers: 1,
    maxQueuedTasks: 0,
    dispatchRemote: (
      task: import("../packages/runtime/src/index.js").ModuleTask,
      signal: AbortSignal,
    ) => remoteDispatch(task, { signal }),
  });
  try {
    assert.equal(
      await remoteProgram.run(
        (task: import("../packages/runtime/src/index.js").ModuleTask) =>
          localPool.run(task),
        "fromWorker",
        [],
      ),
      3.25,
    );
    const localRecord = await remoteProgram.run(
      (task: import("../packages/runtime/src/index.js").ModuleTask) =>
        localPool.run(task),
      "recordsFromWorker",
      [],
    );
    const localBox = await remoteProgram.run(
      (task: import("../packages/runtime/src/index.js").ModuleTask) =>
        localPool.run(task),
      "boxesFromWorker",
      [],
    );
    const localTypes = await import(
      pathToFileURL(join(root, "independent", imported.output.entry)).href
    );
    assert.deepEqual(
      await remoteProgram.run(
        (task: import("../packages/runtime/src/index.js").ModuleTask) =>
          localPool.run(task),
        "mapsFromWorker",
        [],
      ),
      [4, 5],
    );
    await assert.rejects(
      remoteProgram.run(remoteDispatch, "checkedMapFailure", []),
      /instanceof/,
    );
    const mappedRecords = await remoteProgram.run(
      remoteDispatch,
      "mappedRecords",
      [],
    );
    assert.deepEqual(
      mappedRecords.map((point: { z: number; x: number }) => [
        point.z,
        point.x,
      ]),
      [
        [1.5, 2.5],
        [3.5, 4.5],
      ],
    );
    assert.ok(
      mappedRecords.every(
        (point: unknown) => point instanceof localTypes.Point,
      ),
    );
    assert.ok(localRecord instanceof localTypes.NamedPoint);
    assert.ok(localRecord instanceof localTypes.Point);
    assert.deepEqual(
      [localRecord.name, localRecord.z, localRecord.x],
      ["worker", 1.5, 2.5],
    );
    assert.ok(localBox instanceof localTypes.Box);
    assert.ok(localBox.points[0] instanceof localTypes.Point);
    const derived = await remoteProgram.run(
      (task: import("../packages/runtime/src/index.js").ModuleTask) =>
        localPool.run(task),
      "subclassFromWorker",
      [],
    );
    assert.ok(derived instanceof localTypes.MeasuredPoint);
    assert.ok(derived instanceof localTypes.NamedPoint);
    assert.ok(derived instanceof localTypes.Point);
    assert.deepEqual(
      [derived.weight, derived.name, derived.z, derived.x],
      [7, "measured", 1.5, 2.5],
    );
    await assert.rejects(
      remoteProgram.run(
        (task: import("../packages/runtime/src/index.js").ModuleTask) =>
          localPool.run(task, { timeoutMs: 200 }),
        "workerDeadline",
        [],
      ),
      /deadline/,
    );
    assert.deepEqual(await stats(), { workers: 0, activeRequests: 0 });
  } finally {
    await localPool.close();
  }
  assert.equal(localPool.stats.workers, 0);
  const clientTypes = await import(
    pathToFileURL(join(root, "independent", imported.output.entry)).href
  );
  const values = await remoteProgram.run(remoteDispatch, "records", []);
  assert.ok(values[0] instanceof clientTypes.Point);
  assert.deepEqual([values[0].z, values[0].x], [1.5, 2.5]);
  assert.ok(values[1] instanceof clientTypes.NamedPoint);
  assert.ok(values[1] instanceof clientTypes.Point);
  assert.deepEqual(
    [values[1].name, values[1].z, values[1].x],
    ["named", 3.5, 4.5],
  );
  assert.ok(values[2] instanceof clientTypes.Box);
  assert.ok(
    values[2].points.every(
      (point: unknown) => point instanceof clientTypes.Point,
    ),
  );
  assert.deepEqual(
    values[2].points.map((point: { z: number; x: number }) => [
      point.z,
      point.x,
    ]),
    [
      [5.5, 6.5],
      [1.5, 2.5],
    ],
  );
  assert.ok(values[3] instanceof clientTypes.Point);
  assert.ok(values[4] instanceof clientTypes.Other);
  assert.ok(!(values[4] instanceof clientTypes.Point));
  let accessed = false;
  const accessor = new clientTypes.Point(1, 2);
  Object.defineProperty(accessor, "x", {
    enumerable: true,
    get() {
      accessed = true;
      return 2;
    },
  });
  for (const value of [
    { z: 1, x: 2 },
    new clientTypes.Other(1, 2),
    Object.assign(new clientTypes.Point(1, 2), { extra: 3 }),
    accessor,
  ]) {
    await assert.rejects(
      remoteProgram.run(remoteDispatch, "recordInput", [value]),
      /record|Record/,
    );
  }
  assert.equal(accessed, false);
  assert.deepEqual(await stats(), { workers: 0, activeRequests: 0 });
  assert.deepEqual(
    await remoteProgram.run(remoteDispatch, "main", []),
    [3.25, 5.25, 7.25],
  );
  await assert.rejects(
    remoteProgram.run(remoteDispatch, "failure", []),
    /Remote task failed:.*missing/,
  );
  await assert.rejects(
    remoteProgram.run(remoteDispatch, "deadline", []),
    /Remote task failed: Task deadline exceeded/,
  );
  const stale = JSON.parse(
    imported.output.files.get(imported.output.remoteImports)!.code,
  );
  stale.contracts["math.client.json"].revision = "stale-revision";
  const stalePath = join(root, "independent/stale.json");
  await Bun.write(stalePath, JSON.stringify(stale));
  await assert.rejects(
    remoteProgram.run(
      await loadRemoteImportDispatcher(stalePath, endpoints),
      "main",
      [],
    ),
    /HTTP 409/,
  );
  await assert.rejects(
    remoteProgram.run(
      await loadRemoteImportDispatcher(
        importManifest,
        new Map([
          [
            "math.client.json",
            { url: ready.url as string, token: "x".repeat(64) },
          ],
        ]),
      ),
      "main",
      [],
    ),
    /HTTP 401/,
  );
  const controller = new AbortController();
  const cancelled = remoteProgram.run(
    await loadRemoteImportDispatcher(importManifest, endpoints, {
      signal: controller.signal,
    }),
    "deadline",
    [],
  );
  const expectedCancellation = assert.rejects(
    cancelled,
    /Remote call cancelled/,
  );
  const started = Date.now();
  while ((await stats()).workers === 0) {
    assert.ok(Date.now() - started < 800, "Remote worker never started");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  controller.abort();
  await expectedCancellation;
  assert.deepEqual(await stats(), { workers: 0, activeRequests: 0 });
  assert.deepEqual(
    await remoteProgram.run(remoteDispatch, "main", []),
    [3.25, 5.25, 7.25],
  );
  assert.deepEqual(
    await program.run(dispatcher, "main", []),
    [3.25, 5.25, 7.25],
  );
  await verifyRemoteCli({
    runtimeUrl,
    root,
    deployment: config,
    contract: join(root, "client", result.output.remote.client),
    token,
    url: ready.url,
    stats,
    built: process.argv.includes("--built"),
  });
  server.kill("SIGTERM");
  const shutdown = setTimeout(() => server?.kill("SIGKILL"), 5000);
  try {
    assert.equal(await server.exited, 0);
  } finally {
    clearTimeout(shutdown);
  }
  await assert.rejects(program.run(dispatcher, "main", []));
  await assert.rejects(remoteProgram.run(remoteDispatch, "main", []));
  console.log(
    "Network acceptance passed: generated service manifests/contracts, independently compiled remote imports and nominal records (inheritance, nested arrays, unions, invalid inputs), authenticated Sia calls, deployment/schema validation, task failure, deadline/recovery, revision rejection, explicit cancellation with worker cleanup, disconnect, and clean shutdown.",
  );
} finally {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    const cleanup = setTimeout(() => server?.kill("SIGKILL"), 5000);
    try {
      await server.exited;
    } finally {
      clearTimeout(cleanup);
    }
  }
  await rm(root, { recursive: true, force: true });
}
