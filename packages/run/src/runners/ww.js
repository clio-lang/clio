import { Executor } from "clio-rpc/executor";
import { Server } from "clio-rpc/transports/web-worker";
import { getCPUCount } from "../lib/web-cpu.js";
import { run } from "../index.js";

export const server = async (dispatcher, options) => {
  const serverTransport = new Server();
  dispatcher.addTransport(serverTransport);
  return serverTransport;
};

export const workers = async (file, server, { count }) => {
  const workerCount = count === "cpu" ? await getCPUCount() : count;
  const workerPath = await import("worker.clio.js");
  for (let i = 0; i < workerCount; i++) {
    const worker = new Worker(workerPath, { type: "module" });
    server.addWorker(worker);
  }
};

export const executor = async (
  _,
  dispatcher,
  server,
  __,
  { wait_for },
  options
) => {
  if (options.noMain) return;
  const workerCount = wait_for === "cpu" ? await getCPUCount() : wait_for;
  dispatcher.expectWorkers(workerCount).then(async () => {
    const main = await import("main.clio.js");
    const clientTransport = server.getTransport();
    const executor = new Executor(clientTransport);
    await run(main, { executor });
  });
};
