import { test, expect } from "bun:test";
import {
  createRemoteDispatcher as createDispatcher,
  createRemoteHandler,
  remoteLimits as limits,
  maxRemoteFrameBytes as maxFrameBytes,
  remoteMediaType as mediaType,
  remoteNetworkVersion as networkVersion,
  readRemoteBody as boundedBody,
  loadRemoteDeployment,
  RemoteCleanupError,
} from "../packages/runtime/hosts/bun/remote.js";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const token = "t".repeat(64);
function createHandler(config: {
  revision: string;
  services: Map<
    string,
    import("../packages/runtime/hosts/bun/remote.js").RemoteService
  >;
  run: Parameters<typeof createRemoteHandler>[0]["run"];
}) {
  const handler = createRemoteHandler({
    deployment: config,
    token,
    taskTimeoutMs: 1000,
    run: config.run,
  });
  const wrapped = async (request: Request) => {
    const headers = request.headers;
    const reserved = await handler.fetch(
      new Request("http://127.0.0.1/v2/reserve", { method: "POST", headers }),
    );
    if (reserved.status !== 201) return reserved;
    return handler.fetch(request);
  };
  return Object.assign(wrapped, { raw: handler.fetch });
}
import {
  encodeCall,
  encodeReply,
  schemaKey,
  type CallFrame,
} from "../packages/protocol/src/index.js";
import type { ModuleTask } from "../packages/runtime/src/index.js";

const schema = { args: ["number"], result: "number" } as const;
const task: ModuleTask = {
  module: "file:///client/task.mjs",
  exportName: "double",
  args: [1.5],
  schema,
};
const call: CallFrame = {
  kind: "call",
  id: 1,
  limits,
  task: { ...task, module: "double-v1", schema },
};
function request(
  frame: Uint8Array = encodeCall(call),
  headers: Record<string, string> = {},
) {
  return new Request("http://127.0.0.1/v2/call", {
    method: "POST",
    headers: {
      "content-type": mediaType,
      "x-kalandra-network": networkVersion,
      "x-kalandra-revision": "build-1",
      authorization: `Bearer ${token}`,
      "x-kalandra-request": crypto.randomUUID(),
      ...headers,
    },
    body: new Uint8Array(frame).buffer,
  });
}
function harness() {
  let calls = 0;
  const handler = createHandler({
    revision: "build-1",
    services: new Map([
      [
        "double-v1",
        {
          module: "file:///server/task.mjs",
          exportName: "double",
          schemas: [schemaKey(schema)],
        },
      ],
    ]),
    async run(received, options) {
      calls++;
      expect(received.module).toBe("file:///server/task.mjs");
      expect(options.timeoutMs).toBe(1000);
      return (received.args[0] as number) * 2;
    },
  });
  return { handler, calls: () => calls };
}
const routes = new Map([[task.module + "#double", "double-v1"]]);

test("network reference preserves Sia Numbers and replaces client paths with registered server paths", async () => {
  const h = harness();
  const dispatch = createDispatcher({
    token,
    url: "http://127.0.0.1",
    revision: "build-1",
    routes,
    fetch: (url, options) => h.handler.raw(new Request(url, options)),
  });
  for (const n of [1.5, -0, NaN, Infinity, -Infinity]) {
    const result = await dispatch({ ...task, args: [n] });
    expect(Object.is(result, n * 2)).toBe(true);
  }
  expect(h.calls()).toBe(5);
});

test("protocol, revision and content-type mismatches never invoke a task", async () => {
  const h = harness();
  for (const [header, value, status] of [
    ["x-kalandra-network", "1", 409],
    ["x-kalandra-revision", "different", 409],
    ["content-type", "application/json", 415],
  ] as const)
    expect(
      (await h.handler(request(undefined, { [header]: value }))).status,
    ).toBe(status);
  expect(h.calls()).toBe(0);
});

test("unregistered paths, exports and schemas are rejected before dispatch", async () => {
  const h = harness();
  for (const replacement of [
    { module: "file:///etc/anything.mjs" },
    { exportName: "unknown" },
    { schema: { args: ["number"], result: "string" } as const },
  ]) {
    const response = await h.handler(
      request(encodeCall({ ...call, task: { ...call.task, ...replacement } })),
    );
    expect([404, 409]).toContain(response.status);
  }
  expect(h.calls()).toBe(0);
});

test("invalid frame, worker parent IDs and unsupported limits are rejected", async () => {
  const h = harness();
  for (const bytes of [
    new Uint8Array([1, 2]),
    encodeCall({ ...call, parentId: 1 }),
    encodeCall({ ...call, limits: { ...limits, maxNodes: 20000 } }),
  ])
    expect((await h.handler(request(bytes))).status).toBe(400);
  expect(h.calls()).toBe(0);
});

test("streaming body limit applies even without Content-Length", async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(maxFrameBytes + 1));
    },
    cancel() {
      cancelled = true;
    },
  });
  await expect(boundedBody(new Response(stream))).rejects.toThrow(
    "network limit",
  );
  expect(cancelled).toBe(true);
});

test("client refuses missing schema or routing and mismatched response identity", async () => {
  let requests = 0;
  const dispatch = createDispatcher({
    token,
    url: "http://127.0.0.1",
    revision: "build-1",
    routes,
    fetch: async (url) => {
      if (url.pathname === "/v2/reserve")
        return new Response(null, { status: 201 });
      if (url.pathname === "/v2/cancel")
        return new Response(null, { status: 204 });
      requests++;
      return new Response(
        new Uint8Array(
          encodeReply(
            { ...call, id: 999 },
            { kind: "result", id: 999, value: 3 },
          ),
        ).buffer,
        {
          headers: {
            "content-type": mediaType,
            "x-kalandra-network": networkVersion,
            "x-kalandra-revision": "build-1",
          },
        },
      );
    },
  });
  const { schema: _, ...untyped } = task;
  await expect(dispatch(untyped)).rejects.toThrow("concrete Sia schema");
  await expect(
    dispatch({ ...task, module: "file:///unknown" }),
  ).rejects.toThrow("registered");
  expect(requests).toBe(0);
  await expect(dispatch(task)).rejects.toThrow();
  expect(requests).toBe(1);
});

test("admission rejects excess calls and releases capacity after failures", async () => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started = 0;
  const handler = createHandler({
    revision: "build-1",
    services: new Map([
      [
        "double-v1",
        {
          module: "file:///server/task.mjs",
          exportName: "double",
          schemas: [schemaKey(schema)],
        },
      ],
    ]),
    async run() {
      started++;
      await pending;
      throw new Error("failed");
    },
  });
  const calls = Array.from({ length: 8 }, () => handler(request()));
  expect((await handler(request())).status).toBe(503);
  release();
  expect(
    (await Promise.all(calls)).every((response) => response.status === 200),
  ).toBe(true);
  expect(started).toBe(8);
  expect((await handler(request())).status).toBe(200);
  expect(started).toBe(9);
});

const deployment = {
  revision: "build-1",
  services: new Map([
    [
      "double-v1",
      {
        module: "file:///server/task.mjs",
        exportName: "double",
        schemas: [schemaKey(schema)],
      },
    ],
  ]),
};
function control(route: string, id: string, auth = token) {
  return new Request(`http://127.0.0.1/v2/${route}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${auth}`,
      "x-kalandra-network": networkVersion,
      "x-kalandra-revision": "build-1",
      "x-kalandra-request": id,
    },
  });
}
test("authentication protects admission and cancellation; credentials and endpoint configuration are validated", async () => {
  let calls = 0;
  const handler = createRemoteHandler({
    deployment,
    token,
    async run() {
      calls++;
      return 3;
    },
  });
  const id = crypto.randomUUID();
  expect((await handler.fetch(control("reserve", id, "wrong"))).status).toBe(
    401,
  );
  expect(handler.activeRequests).toBe(0);
  expect((await handler.fetch(control("reserve", id))).status).toBe(201);
  expect((await handler.fetch(control("cancel", id, "wrong"))).status).toBe(
    401,
  );
  expect(handler.activeRequests).toBe(1);
  expect((await handler.fetch(control("cancel", id))).status).toBe(204);
  expect(handler.activeRequests).toBe(0);
  expect(calls).toBe(0);
  expect(() =>
    createRemoteHandler({ deployment, token: "short", async run() {} }),
  ).toThrow("token");
  for (const url of [
    "http://example.com",
    "https://user:pass@example.com",
    "ftp://127.0.0.1",
  ])
    expect(() =>
      createDispatcher({ url, revision: "build-1", token, routes }),
    ).toThrow("HTTPS");
  await handler.close();
});

test("cancellation before execution prevents a late call and rejects replay", async () => {
  let calls = 0;
  const handler = createRemoteHandler({
    deployment,
    token,
    async run() {
      calls++;
      return 3;
    },
  });
  const id = crypto.randomUUID();
  expect((await handler.fetch(control("reserve", id))).status).toBe(201);
  expect((await handler.fetch(control("cancel", id))).status).toBe(204);
  expect(
    (await handler.fetch(request(undefined, { "x-kalandra-request": id })))
      .status,
  ).toBe(409);
  expect((await handler.fetch(control("reserve", id))).status).toBe(409);
  expect(
    (await handler.fetch(control("cancel", crypto.randomUUID()))).status,
  ).toBe(404);
  expect(calls).toBe(0);
  await handler.close();
});

test("cancellation acknowledgement waits for task cleanup and server close aborts reservations", async () => {
  let started!: () => void;
  const running = new Promise<void>((resolve) => {
    started = resolve;
  });
  let release!: () => void;
  const cleanup = new Promise<void>((resolve) => {
    release = resolve;
  });
  const handler = createRemoteHandler({
    deployment,
    token,
    async run(_, options) {
      started();
      await new Promise<void>((resolve) =>
        options.signal!.addEventListener("abort", () => resolve(), {
          once: true,
        }),
      );
      await cleanup;
      throw new Error("stopped");
    },
  });
  const id = crypto.randomUUID();
  await handler.fetch(control("reserve", id));
  const result = handler.fetch(
    request(undefined, { "x-kalandra-request": id }),
  );
  await running;
  let acknowledged = false;
  const cancel = handler.fetch(control("cancel", id)).then((response) => {
    acknowledged = true;
    return response;
  });
  await Promise.resolve();
  expect(acknowledged).toBe(false);
  expect(handler.activeRequests).toBe(1);
  release();
  expect((await cancel).status).toBe(204);
  await result;
  expect(handler.activeRequests).toBe(0);
  await handler.fetch(control("reserve", crypto.randomUUID()));
  await handler.close();
  expect(handler.activeRequests).toBe(0);
  expect(
    (await handler.fetch(control("reserve", crypto.randomUUID()))).status,
  ).toBe(503);
});

test("missing cancellation acknowledgement reports an unknown execution outcome", async () => {
  const controller = new AbortController();
  const dispatch = createDispatcher({
    url: "http://127.0.0.1",
    revision: "build-1",
    token,
    routes,
    signal: controller.signal,
    fetch: async (url, options) => {
      if (url.pathname.endsWith("reserve"))
        return new Response(null, { status: 201 });
      if (url.pathname.endsWith("cancel"))
        return new Response(null, { status: 404 });
      return new Promise<Response>((_, reject) => {
        options.signal!.addEventListener(
          "abort",
          () => reject(new Error("aborted")),
          { once: true },
        );
        controller.abort();
      });
    },
  });
  await expect(dispatch(task)).rejects.toThrow("cancellation unconfirmed");
});

test("body-read deadlines release reservations without invoking workers", async () => {
  let called = false;
  const handler = createRemoteHandler({
    deployment,
    token,
    bodyTimeoutMs: 20,
    async run() {
      called = true;
      return 3;
    },
  });
  const id = crypto.randomUUID();
  const headers = control("reserve", id).headers;
  await handler.fetch(control("reserve", id));
  headers.set("content-type", mediaType);
  const response = await handler.fetch(
    new Request("http://127.0.0.1/v2/call", {
      method: "POST",
      headers,
      body: new ReadableStream<Uint8Array>(),
    }),
  );
  expect(response.status).toBe(400);
  expect(called).toBe(false);
  expect(handler.activeRequests).toBe(0);
  await handler.close();
});

test("deployment manifests validate paths and generated schema declarations", async () => {
  const root = await mkdtemp(join(tmpdir(), "kalandra-deployment-"));
  try {
    const key = schemaKey(schema);
    await Bun.write(
      join(root, "tasks.mjs"),
      `export function double(n){return n*2;} export const __kalandraSchemas = ${JSON.stringify({ double: [key] })};`,
    );
    const path = join(root, "deploy/deployment.json");
    await Bun.write(
      join(root, "deploy/tasks.mjs"),
      await Bun.file(join(root, "tasks.mjs")).text(),
    );
    const manifest = {
      version: 1,
      revision: "build-1",
      services: {
        double: { module: "tasks.mjs", exportName: "double", schemas: [key] },
      },
    };
    await Bun.write(path, JSON.stringify(manifest));
    expect((await loadRemoteDeployment(path)).services.size).toBe(1);
    await expect(
      loadRemoteDeployment(path, { endpoints: new Map() }),
    ).rejects.toThrow("no remote imports");
    await Bun.write(join(root, "deploy/imports.json"), "{}");
    await Bun.write(
      path,
      JSON.stringify({ ...manifest, remoteImports: "imports.json" }),
    );
    await expect(loadRemoteDeployment(path)).rejects.toThrow(
      "endpoint bindings",
    );
    for (const remoteImports of ["../tasks.mjs", join(root, "tasks.mjs"), 42]) {
      await Bun.write(path, JSON.stringify({ ...manifest, remoteImports }));
      await expect(
        loadRemoteDeployment(path, { endpoints: new Map() }),
      ).rejects.toThrow();
    }
    await symlink(
      join(root, "tasks.mjs"),
      join(root, "deploy/import-link.json"),
    );
    await Bun.write(
      path,
      JSON.stringify({ ...manifest, remoteImports: "import-link.json" }),
    );
    await expect(
      loadRemoteDeployment(path, { endpoints: new Map() }),
    ).rejects.toThrow("escapes");

    for (const module of ["../tasks.mjs", join(root, "tasks.mjs")]) {
      await Bun.write(
        path,
        JSON.stringify({
          ...manifest,
          services: { double: { ...manifest.services.double, module } },
        }),
      );
      await expect(loadRemoteDeployment(path)).rejects.toThrow();
    }
    await symlink(join(root, "tasks.mjs"), join(root, "deploy/outside.mjs"));
    await Bun.write(
      path,
      JSON.stringify({
        ...manifest,
        services: {
          double: { ...manifest.services.double, module: "outside.mjs" },
        },
      }),
    );
    await expect(loadRemoteDeployment(path)).rejects.toThrow("escapes");
    await Bun.write(
      path,
      JSON.stringify({
        ...manifest,
        services: {
          double: {
            ...manifest.services.double,
            schemas: [schemaKey({ args: ["string"], result: "string" })],
          },
        },
      }),
    );
    await expect(loadRemoteDeployment(path)).rejects.toThrow("does not match");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("cleanup failure closes admission and never acknowledges cancellation as successful", async () => {
  const handler = createRemoteHandler({
    deployment,
    token,
    async run() {
      throw new RemoteCleanupError("cannot reap");
    },
  });
  const id = crypto.randomUUID();
  await handler.fetch(control("reserve", id));
  expect(
    (await handler.fetch(request(undefined, { "x-kalandra-request": id })))
      .status,
  ).toBe(503);
  expect((await handler.fetch(control("cancel", id))).status).toBe(503);
  expect(
    (await handler.fetch(control("reserve", crypto.randomUUID()))).status,
  ).toBe(503);
  await expect(handler.close()).rejects.toThrow("cleanup is unconfirmed");
});

test("service hop budget reaches the host and invalid depths never dispatch", async () => {
  let observed = -1;
  const handler = createRemoteHandler({
    deployment: {
      revision: "build-1",
      services: new Map([
        [
          "double-v1",
          {
            module: "file:///server/task.mjs",
            exportName: "double",
            schemas: [schemaKey(schema)],
          },
        ],
      ]),
    },
    token,
    async run(_task, options) {
      observed = options.remoteDepth;
      return 3;
    },
  });
  const dispatch = createDispatcher({
    token,
    url: "http://127.0.0.1",
    revision: "build-1",
    routes,
    fetch: (url, options) => handler.fetch(new Request(url, options)),
  });
  try {
    expect(await dispatch(task, { remoteDepth: 32 })).toBe(3);
    expect(observed).toBe(32);
    for (const remoteDepth of [33, -1, 0.5, NaN])
      await expect(dispatch(task, { remoteDepth })).rejects.toThrow(
        "nesting limit",
      );
    for (const depth of ["33", "-1", "1.5", "NaN", "01"])
      expect(
        (await handler.fetch(request(undefined, { "x-kalandra-depth": depth })))
          .status,
      ).toBe(400);
    expect(handler.activeRequests).toBe(0);
  } finally {
    await handler.close();
  }
});
