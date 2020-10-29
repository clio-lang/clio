const { run } = require("../index");
const { Worker } = require("worker_threads");
const { Dispatcher } = require("clio-rpc/dispatcher");
const { Executor } = require("clio-rpc/executor");
const WorkerThread = require("clio-rpc/transports/worker-thread");

const os = require("os");

const start = file => {
  const numCPUs = os.cpus().length;
  const main = require(file);

  const dispatcher = new Dispatcher();
  const serverTransport = new WorkerThread.Server();
  for (let i = 0; i < numCPUs; i++) {
    // TODO: can parcel handle this?
    const worker = new Worker(`../workers/ww.js?file=${file}`);
    serverTransport.addWorker(worker);
  }
  dispatcher.addTransport(serverTransport);
  dispatcher.expectWorkers(numCPUs).then(() => {
    const clientTransport = serverTransport.getTransport();
    const executor = new Executor(clientTransport);
    run(main, { executor });
  });
};

module.exports = start;
