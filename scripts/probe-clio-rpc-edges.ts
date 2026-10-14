import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import evidence from "../tests/fixtures/clio/port-probes/rpc-edges.json";

// Use a clean archive of evidence.commit; never run against a modified checkout.
// Original components share a process but all RPC traffic crosses TCP sockets.
const snapshot = process.argv[2];
if (!snapshot)
  throw new Error(
    "Usage: bun scripts/probe-clio-rpc-edges.ts /path/to/restored-clio-snapshot",
  );
const selected = process.argv[3];
if (!selected) {
  for (const entry of evidence.cases) {
    const child: Bun.Subprocess<"ignore", "pipe", "pipe"> = Bun.spawn(
      [process.execPath, import.meta.path, snapshot, entry.name],
      { stdin: "ignore", stdout: "pipe", stderr: "pipe" },
    );
    const timer = setTimeout(() => child.kill("SIGKILL"), 20000);
    try {
      const [code, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ]);
      assert.equal(code, 0, stderr || stdout);
      const result = JSON.parse(stdout);
      assert.deepEqual(result, entry.expected);
      const { generated: _generated, ...summary } = result;
      console.log(JSON.stringify(summary));
    } finally {
      clearTimeout(timer);
    }
  }
  process.exit(0);
}
const entry = evidence.cases.find((value) => value.name === selected);
assert.ok(entry, "Unknown probe case");
let fatalError: (error: unknown) => void;
const fatal = new Promise<never>((_, reject) => {
  fatalError = reject;
});
// Observe historical asynchronous failures only to stop this isolated probe and clean up.
const onFatal = (error: unknown) => fatalError(error);
process.on("uncaughtException", onFatal);
process.on("unhandledRejection", onFatal);
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
let phase = "startup";
const workers: any[] = [];
const generated: Record<string, string> = {};
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
      fatal,
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
    phase = "host:" + prefix;
    const worker = new Worker(transport());
    workers.push(worker);
    const { code } = compile(source, "service.clio", { rpcPrefix: prefix });
    generated[prefix] = code.replaceAll(String(port), "PORT");
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
  await host("export fn add a b: a + b\n", "base", 1);
  await host(entry.source.replaceAll("PORT", String(port)), "edge", 2);
  const args =
    entry.name === "remote-handle-argument"
      ? [caller.getFunction("base/service.clio/add")]
      : entry.args;
  phase = "call";
  const value = await bounded(
    caller.call(`edge/service.clio/${entry.route}`, args),
  );
  console.log(
    JSON.stringify({
      name: entry.name,
      value: value ?? null,
      valueType: typeof value,
      generated,
    }),
  );
} catch (error) {
  console.log(
    JSON.stringify({
      name: entry.name,
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.name : typeof error,
      phase,
      generated,
      registered: [...dispatcher.workers.keys()],
      workerFunctions: workers.map((worker) => [...worker.functions.keys()]),
    }),
  );
} finally {
  for (const client of clients) client.socket?.destroy();
  for (const socket of sockets) socket.destroy();
  if (server.tcpServer?.listening)
    await new Promise<void>((done) => server.tcpServer.close(done));
  clearTimeout(deadline);
  process.off("uncaughtException", onFatal);
  process.off("unhandledRejection", onFatal);
  await rm(directory, { recursive: true, force: true });
}
