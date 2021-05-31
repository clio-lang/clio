const { run } = require("../index");
const { Executor } = require("clio-rpc/executor");
const WebWorker = require("clio-rpc/transports/web-worker");

const server = async (dispatcher, options) => {
  const serverTransport = new WebWorker.Server();
  dispatcher.addTransport(serverTransport);
  return serverTransport;
};

const workers = (file, server, { count }) => {
  const workerCount =
    count === "cpu" ? window.navigator.hardwareConcurrency : count;
  for (let i = 0; i < workerCount; i++) {
    // TODO: parcel can't handle url parameters
    const worker = new Worker("../workers/ww.js");
    server.addWorker(worker);
  }
};

const executor = (file, dispatcher, server, monitor, { wait_for }, options) => {
  if (options.noMain) return;
  const workerCount =
    wait_for === "cpu" ? window.navigator.hardwareConcurrency : wait_for;
  dispatcher.expectWorkers(workerCount).then(async () => {
    // TODO: this locks us to parcel
    const main = require("main.clio.js");
    const clientTransport = server.getTransport();
    const executor = new Executor(clientTransport);
    await run(main, { executor });
  });
};

module.exports.server = server;
module.exports.workers = workers;
module.exports.executor = executor;
