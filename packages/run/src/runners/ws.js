const { run } = require("../index");
const { Dispatcher } = require("clio-rpc/dispatcher");
const { Executor } = require("clio-rpc/executor");
const WS = require("clio-rpc/transports/ws");
const path = require("path");

const child_process = require("child_process");
const os = require("os");

const server = async (dispatcher, { host, port }) => {
  const location = host === "0.0.0.0" ? "127.0.0.1" : host;
  const url = `ws://${location}:${port}`;
  const transport = new WS.Server({ port, url });
  dispatcher.addTransport(transport);
  return new Promise((resolve) => {
    transport.wsServer.on("listening", () => resolve(transport));
  });
};

const workers = (file, server, { url, count }) => {
  const workerCount = count === "cpu" ? os.cpus().length : count;
  for (let i = 0; i < workerCount; i++) {
    child_process.fork(path.resolve(__dirname, "../workers/ws.js"), [
      url,
      file,
    ]);
  }
};

const executor = (file, dispatcher, server, monitor, config, options) => {
  const { url, wait_for } = config;
  const workerCount = wait_for === "cpu" ? os.cpus().length : wait_for;
  dispatcher.expectWorkers(workerCount).then(async () => {
    const main = require(file);
    const transport = new WS.Client({ url });
    const executor = new Executor(transport);
    monitor.freeze();
    await run(main, { executor }, options);
    monitor.exit();
  });
};

const start = (file) => {
  const numCPUs = os.cpus().length;
  const port = 1337;
  const url = "ws://localhost:1337";
  const main = require(file);

  const dispatcher = new Dispatcher();
  const transport = new WS.Server({ port, url });

  const spawnWorkers = () => {
    for (let i = 0; i < numCPUs; i++) {
      child_process.fork(path.resolve(__dirname, "../workers/ws.js"), [
        url,
        file,
      ]);
    }
  };

  dispatcher.addTransport(transport);
  transport.wsServer.on("listening", spawnWorkers);

  dispatcher.expectWorkers(numCPUs).then(() => {
    const transport = new WS.Client({ url });
    const executor = new Executor(transport);
    run(main, { executor }, { noExit: true, noMain: true });
  });
};

module.exports.server = server;
module.exports.workers = workers;
module.exports.executor = executor;
