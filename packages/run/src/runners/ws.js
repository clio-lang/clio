const { run } = require("../index");
const { Executor } = require("clio-rpc/executor");
const WS = require("clio-rpc/transports/ws");
const path = require("path");

const child_process = require("child_process");
const os = require("os");

const server = async (dispatcher, { host = "127.0.0.1", port = 9123 }) => {
  const url = `ws://${host}:${port}`;
  const transport = new WS.Server({ port, url });
  dispatcher.addTransport(transport);
  return new Promise((resolve) => {
    transport.wsServer.on("listening", () => resolve(transport));
  });
};

const workers = (file, server, { url = "ws://localhost:9123", count }) => {
  const workerCount = count === "cpu" ? os.cpus().length : count;
  for (let i = 0; i < workerCount; i++) {
    child_process.fork(path.resolve(__dirname, "../workers/ws.js"), [
      url,
      file,
    ]);
  }
};

const executor = (file, dispatcher, server, monitor, config, options) => {
  if (options.noMain) return;
  const { url = "ws://localhost:9123", wait_for } = config;
  const workerCount = wait_for === "cpu" ? os.cpus().length : wait_for;
  dispatcher.expectWorkers(workerCount).then(async () => {
    const main = require(file);
    const transport = new WS.Client({ url });
    const executor = new Executor(transport);
    if (!options.noExit) monitor.freeze();
    await run(main, { executor }, options);
    if (!options.noExit) monitor.exit();
  });
};

module.exports.server = server;
module.exports.workers = workers;
module.exports.executor = executor;
