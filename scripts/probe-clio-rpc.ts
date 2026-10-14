import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import evidence from "../tests/fixtures/clio/port-probes/rpc-results.json";

// Use a clean archive of evidence.commit; never run against a modified checkout.
// Original components share a process but all RPC traffic crosses TCP sockets.
const snapshot = process.argv[2];
if (!snapshot)
  throw new Error(
    "Usage: bun scripts/probe-clio-rpc.ts /path/to/restored-clio-snapshot",
  );
const load = (path: string) =>
  import(pathToFileURL(resolve(snapshot, path)).href);
const { compile } = await load("packages/core/index.js");
const { Dispatcher } = await load("packages/rpc/dispatcher.js");
const { Worker } = await load("packages/rpc/worker.js");
const { Executor } = await load("packages/rpc/executor.js");
const { Server } = await load("packages/rpc/transports/tcp/server.js");
const { Client } = await load("packages/rpc/transports/tcp/client.js");
const builtins = await load("node_modules/clio-lang-internals/src/index.js");
assert.equal(
  builtins.EventEmitter,
  (await load("packages/rpc/common.js")).EventEmitter,
);
const directory = await mkdtemp(join(tmpdir(), "kalandra-clio-rpc-"));
const clients: any[] = [],
  sockets = new Set<any>();
const dispatcher = new Dispatcher();
const server = new Server({ host: "127.0.0.1", port: 0 });
const deadline = setTimeout(() => {
  console.error("Historical RPC probe timed out");
  process.exit(2);
}, 15000);
async function bounded<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("operation timed out")),
          3000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
try {
  const listening = new Promise<void>((done) => server.on("listening", done));
  dispatcher.addTransport(server);
  server.tcpServer.on("connection", (socket: any) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  await bounded(listening);
  const port = server.tcpServer.address().port;
  const transport = () => {
    const client = new Client({ host: "127.0.0.1", port });
    clients.push(client);
    return client;
  };
  const caller = new Executor(transport());
  const outbound = new Executor(transport());
  async function host(source: string, prefix: string, expectedWorkers: number) {
    const worker = new Worker(transport());
    const { code } = compile(source, "service.clio", { rpcPrefix: prefix });
    const path = join(directory, prefix + ".mjs");
    await writeFile(path, code);
    const factory = (await import(pathToFileURL(path).href)).default;
    const clio = {
      ...builtins,
      exports: {},
      distributed: {
        getExecutor: async (protocol: string, host: string) => {
          assert.equal(protocol, "tcp");
          assert.equal(host, `127.0.0.1:${port}`);
          return outbound;
        },
      },
      register: (path: string, fn: any) => {
        worker.register({ path, fn });
        fn.parallel = outbound.getFunction(path);
        return fn;
      },
    };
    await bounded(factory(clio));
    worker.connect();
    await bounded(dispatcher.expectWorkers(expectedWorkers));
    return worker;
  }
  await host(
    `export fn add a b: a + b
export fn channel:
  events = emitter ()
  fn ping n: events.emit "pong" (n + 1)
  events.on "ping" ping
  events
shared = emitter ()
export fn sharedChannel: shared
`,
    "base",
    1,
  );
  await host(
    `from "tcp:127.0.0.1:${port}/base/service.clio" import add
export fn relay n: await add n 1
export fn nested n: await |relay| n
`,
    "relay",
    2,
  );
  const discovered = (await bounded(
    caller.getFunctions("base/service.clio"),
  )) as Record<string, any>;
  const direct = await bounded(discovered["base/service.clio/add"](2, 3));
  const mapped = await bounded(
    Promise.all(
      [1, 2, 3].map((n) => caller.call("base/service.clio/add", [n, 10])),
    ),
  );
  const chained = await bounded(caller.call("relay/service.clio/relay", [5]));
  const nested = await bounded(caller.call("relay/service.clio/nested", [6]));
  assert.equal(direct, 5);
  assert.deepEqual(mapped, [11, 12, 13]);
  assert.equal(chained, 6);
  assert.equal(nested, 7);
  const channel: any = await bounded(
    caller.call("base/service.clio/channel", []),
  );
  const reply = new Promise<number>((done) => channel.on("pong", done));
  channel.emit("ping", 7);
  assert.equal(await bounded(reply), 8);
  const first: any = await bounded(
    caller.call("base/service.clio/sharedChannel", []),
  );
  const second: any = await bounded(
    caller.call("base/service.clio/sharedChannel", []),
  );
  assert.equal(typeof first.on, "function");
  assert.equal(typeof second.on, "undefined");
  assert.equal(second.emitter, first);
  const results = {
    direct,
    mapped,
    chained,
    nested,
    eventReply: 8,
    repeatedEmitter: "second result is registry wrapper, not emitter",
  };
  assert.deepEqual(results, evidence.results);
  console.log(JSON.stringify(results));
} finally {
  for (const client of clients) client.socket?.destroy();
  for (const socket of sockets) socket.destroy();
  if (server.tcpServer?.listening)
    await new Promise<void>((done) => server.tcpServer.close(done));
  clearTimeout(deadline);
  await rm(directory, { recursive: true, force: true });
}
