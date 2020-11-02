const { run, Montior } = require("../index");
const { Worker } = require("worker_threads");
const { Dispatcher } = require("clio-rpc/dispatcher");
const { Executor } = require("clio-rpc/executor");
const WorkerThread = require("clio-rpc/transports/worker-thread");
const path = require("path");

const os = require("os");

const start = (file) => {
  const numCPUs = os.cpus().length;
  const main = require(file);
  const monitor = new Montior();
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

module.exports = start;
