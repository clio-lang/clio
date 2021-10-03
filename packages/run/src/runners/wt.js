import { dirname, resolve } from "path";

import { Executor } from "clio-rpc/executor";
import { Server } from "clio-rpc/transports/worker-thread";
import { Worker } from "worker_threads";
import { cpus } from "os";
import { fileURLToPath } from "url";
import { run } from "../index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const server = async (dispatcher, options) => {
  const serverTransport = new Server();
  dispatcher.addTransport(serverTransport);
  return serverTransport;
};

const workers = (file, server, { count }) => {
  const workerCount = count === "cpu" ? cpus().length : count;
  const workerFile = resolve(__dirname, "../workers/wt.js");
  for (let i = 0; i < workerCount; i++) {
    const worker = new Worker(workerFile, { workerData: { file } });
    server.addWorker(worker);
  }
};

const executor = (file, dispatcher, server, monitor, { wait_for }, options) => {
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

const _server = server;
export { _server as server };
const _workers = workers;
export { _workers as workers };
const _executor = executor;
export { _executor as executor };
