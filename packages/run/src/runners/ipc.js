const { run } = require("../index");
const { Executor } = require("clio-rpc/executor");
const IPC = require("clio-rpc/transports/ipc");
const path = require("path");

const child_process = require("child_process");
const os = require("os");

const server = async (dispatcher, config) => {
  const ipcConfig = config.path ? config : IPC.Server.defaultIPCConfig();
  const transport = new IPC.Server(ipcConfig);
  dispatcher.addTransport(transport);
  return new Promise((resolve) => {
    transport.ipcServer.on("listening", () => resolve(transport));
  });
};

const workers = (file, server, config) => {
  const workerCount = config.count === "cpu" ? os.cpus().length : config.count;
  const ipcConfig = config.server ? server.ipcConfig : { path: config.path };
  for (let i = 0; i < workerCount; i++) {
    child_process.fork(path.resolve(__dirname, "../workers/ipc.js"), [
      ipcConfig.path,
      file,
    ]);
  }
};

const executor = (file, dispatcher, server, monitor, config, options) => {
  if (options.noMain) return;
  const { server: name, wait_for } = config;
  const ipcConfig = name ? server.ipcConfig : { path: config.path };
  const workerCount = wait_for === "cpu" ? os.cpus().length : wait_for;
  dispatcher.expectWorkers(workerCount).then(async () => {
    const main = require(file);
    const transport = new IPC.Client(ipcConfig);
    const executor = new Executor(transport);
    if (!options.noExit) monitor.freeze();
    await run(main, { executor }, options);
    if (!options.noExit) monitor.exit();
  });
};

module.exports.server = server;
module.exports.workers = workers;
module.exports.executor = executor;
