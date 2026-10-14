const runtime = (await import(
  process.argv[3]!
)) as typeof import("../../packages/runtime/hosts/bun/remote.js");
const deployment = await runtime.loadRemoteDeployment(process.argv[2]!);
const server = runtime.serveRemoteTasks({
  deployment,
  token: process.env.KALANDRA_REMOTE_TOKEN!,
  taskTimeoutMs: 1000,
});
console.log(JSON.stringify({ url: server.url, pid: process.pid }));
process.on("message", (message) => {
  if (message === "stats")
    process.send?.({
      workers: server.workers,
      activeRequests: server.activeRequests,
    });
});
let closing = false;
process.on("SIGTERM", () => {
  void (async () => {
    if (closing) return;
    closing = true;
    await server.close();
    if (server.workers || server.activeRequests)
      throw new Error("Remote resources survived shutdown");
    process.exit(0);
  })().catch((error) => {
    console.error(error);
    process.exit(1);
  });
});
