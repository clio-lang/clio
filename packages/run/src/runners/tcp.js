import { Client, Server } from "clio-rpc/transports/tcp";
import { dirname, resolve } from "path";

import { Executor } from "clio-rpc/executor";
import { cpus } from "os";
import { fileURLToPath } from "url";
import { fork } from "child_process";
import { run } from "../index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const server = async (dispatcher, { host, port }) => {
  const config = host && port ? { host, port } : Server.defaultTCPConfig();
  const transport = new Server(config);
  dispatcher.addTransport(transport);
  return new Promise((resolve) => {
    transport.tcpServer.on("listening", () => resolve(transport));
  });
};

export const workers = (file, server, { host, port, server: name, count }) => {
  const workerCount = count === "cpu" ? cpus().length : count;
  const config = name ? server.tcpConfig : { host, port };
  for (let i = 0; i < workerCount; i++) {
    fork(resolve(__dirname, "../workers/tcp.js"), [
      config.host,
      config.port,
      file,
    ]);
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
  const { host, port, server: name, wait_for } = config;
  const tcpConfig = name ? server.tcpConfig : { host, port };
  if (name && server.tcpConfig.host === "0.0.0.0") tcpConfig.host = "127.0.0.1";
  const workerCount = wait_for === "cpu" ? cpus().length : wait_for;
  dispatcher.expectWorkers(workerCount).then(async () => {
    const main = await import(file);
    const transport = new Client(tcpConfig);
    const executor = new Executor(transport);
    if (!options.noExit) monitor.freeze();
    await run(main, { executor }, options);
    if (!options.noExit) monitor.exit();
  });
};
