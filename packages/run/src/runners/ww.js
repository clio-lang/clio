const { run } = require("../index");
const { Dispatcher } = require("clio-rpc/dispatcher");
const { Executor } = require("clio-rpc/executor");
const WebWorker = require("clio-rpc/transports/web-worker");

const os = require("os");

const start = (file) => {
  const numCPUs = os.cpus().length;
  const main = require(file);

  const dispatcher = new Dispatcher();
  const serverTransport = new WebWorker.Server();
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
