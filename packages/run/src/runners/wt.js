const { run, Monitor } = require("../index");
const { Worker } = require("worker_threads");
const { Dispatcher } = require("clio-rpc/dispatcher");
const { Executor } = require("clio-rpc/executor");
const WorkerThread = require("clio-rpc/transports/worker-thread");
const path = require("path");

const os = require("os");

const server = async (dispatcher, options) => {
  const serverTransport = new WorkerThread.Server();
  dispatcher.addTransport(serverTransport);
  return serverTransport;
};

const workers = (file, server, { count }) => {
  const workerCount = count === "cpu" ? os.cpus().length : count;
  const workerFile = path.resolve(__dirname, "../workers/wt.js");
  for (let i = 0; i < workerCount; i++) {
    const worker = new Worker(workerFile, { workerData: { file } });
    server.addWorker(worker);
  }
};

const executor = (file, dispatcher, server, monitor, { wait_for }, options) => {
  const workerCount = wait_for === "cpu" ? os.cpus().length : wait_for;
  dispatcher.expectWorkers(workerCount).then(async () => {
    const main = require(file);
    const clientTransport = server.getTransport();
    const executor = new Executor(clientTransport);
    if (!options.noExit) monitor.freeze();
    await run(main, { executor });
    if (!options.noExit) monitor.exit();
  });
};

module.exports.server = server;
module.exports.workers = workers;
module.exports.executor = executor;
