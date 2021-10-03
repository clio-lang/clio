import { Client, Server } from "clio-rpc/transports/ws";
import { dirname, resolve } from "path";

import { Executor } from "clio-rpc/executor";
import { cpus } from "os";
import { fileURLToPath } from "url";
import { fork } from "child_process";
import { run } from "../index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const server = async (
  dispatcher,
  { host = "127.0.0.1", port = 9123 }
) => {
  const url = `ws://${host}:${port}`;
  const transport = new Server({ port, url });
  dispatcher.addTransport(transport);
  return new Promise((resolve) => {
    transport.wsServer.on("listening", () => resolve(transport));
  });
};

export const workers = (
  file,
  server,
  { url = "ws://localhost:9123", count }
) => {
  const workerCount = count === "cpu" ? cpus().length : count;
  for (let i = 0; i < workerCount; i++) {
    fork(resolve(__dirname, "../workers/ws.js"), [url, file]);
  }
};

export const executor = (
  file,
  dispatcher,
  server,
  monitor,
  config,
  options
) => {
  if (options.noMain) return;
  const { url = "ws://localhost:9123", wait_for: waitFor } = config;
  const workerCount = waitFor === "cpu" ? cpus().length : waitFor;
  dispatcher.expectWorkers(workerCount).then(async () => {
    const main = await import(file);
    const transport = new Client({ url });
    const executor = new Executor(transport);
    if (!options.noExit) monitor.freeze();
    await run(main, { executor }, options);
    if (!options.noExit) monitor.exit();
  });
};
