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
    monitor.freeze();
    await run(main, { executor });
    monitor.exit();
  });
};

const start = (file) => {
  const numCPUs = os.cpus().length;
  const main = require(file);
  const monitor = new Monitor();
  const dispatcher = new Dispatcher();
  const serverTransport = new WorkerThread.Server();
  const workerFile = path.resolve(__dirname, "../workers/wt.js");
  for (let i = 0; i < numCPUs; i++) {
    const worker = new Worker(workerFile, { workerData: { file } });
    serverTransport.addWorker(worker);
  }
  dispatcher.addTransport(serverTransport);
  dispatcher.expectWorkers(numCPUs).then(async () => {
    const clientTransport = serverTransport.getTransport();
    const executor = new Executor(clientTransport);
    monitor.freeze();
    await run(main, { executor });
    monitor.exit();
  });
};

module.exports.server = server;
module.exports.workers = workers;
module.exports.executor = executor;
