import { dirname, resolve } from "path";

import { Executor } from "clio-rpc/executor.js";
import { Server } from "clio-rpc/transports/worker-thread/index.js";
import { Worker } from "worker_threads";
import { cpus } from "os";
import { fileURLToPath } from "url";
import { run } from "../index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const server = async (dispatcher, options) => {
  const serverTransport = new Server();
  dispatcher.addTransport(serverTransport);
  return serverTransport;
};

export const workers = (file, server, { count }) => {
  const workerCount = count === "cpu" ? cpus().length : count;
  const workerFile = resolve(__dirname, "../workers/wt.js");
  for (let i = 0; i < workerCount; i++) {
    const worker = new Worker(workerFile, { workerData: { file } });
    server.addWorker(worker);
  }
};

export const executor = (
  file,
  dispatcher,
  server,
  monitor,
  { wait_for },
  options
) => {
  if (options.noMain) return;
  const workerCount = wait_for === "cpu" ? cpus().length : wait_for;
  dispatcher.expectWorkers(workerCount).then(async () => {
    const main = await import(file);
    const clientTransport = server.getTransport();
    const executor = new Executor(clientTransport);
    if (!options.noExit) monitor.freeze();
    await run(main, { executor });
    if (!options.noExit) monitor.exit();
  });
};

export default {
  executor,
  server,
  workers,
};
