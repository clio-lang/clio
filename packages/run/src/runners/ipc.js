import { Client, Server } from "clio-rpc/transports/ipc";
import { dirname, resolve } from "path";

import { Executor } from "clio-rpc/executor";
import { cpus } from "os";
import { fileURLToPath } from "url";
import { fork } from "child_process";
import { run } from "../index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const server = async (dispatcher, config) => {
  const ipcConfig = config.path ? config : Server.defaultIPCConfig();
  const transport = new Server(ipcConfig);
  dispatcher.addTransport(transport);
  return new Promise((resolve) => {
    transport.ipcServer.on("listening", () => resolve(transport));
  });
};

export const workers = (file, server, config) => {
  const workerCount = config.count === "cpu" ? cpus().length : config.count;
  const ipcConfig = config.server ? server.ipcConfig : { path: config.path };
  for (let i = 0; i < workerCount; i++) {
    fork(resolve(__dirname, "../workers/ipc.js"), [ipcConfig.path, file]);
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
  const { server: name, wait_for } = config;
  const ipcConfig = name ? server.ipcConfig : { path: config.path };
  const workerCount = wait_for === "cpu" ? cpus().length : wait_for;
  dispatcher.expectWorkers(workerCount).then(async () => {
    const main = await import(file);
    const transport = new Client(ipcConfig);
    const executor = new Executor(transport);
    if (!options.noExit) monitor.freeze();
    await run(main, { executor }, options);
    if (!options.noExit) monitor.exit();
  });
};
