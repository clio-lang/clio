const { run } = require("../index");
const { Executor } = require("clio-rpc/executor");
const WebWorker = require("clio-rpc/transports/web-worker");
const { getCPUCount } = require("../lib/web-cpu");

const server = async (dispatcher, options) => {
  const serverTransport = new WebWorker.Server();
  dispatcher.addTransport(serverTransport);
  return serverTransport;
};

const workers = async (file, server, { count }) => {
  const workerCount = count === "cpu" ? await getCPUCount() : count;
  const workerPath = require("worker.clio.js");
  for (let i = 0; i < workerCount; i++) {
    const worker = new Worker(workerPath, { type: "module" });
    server.addWorker(worker);
  }
};

const executor = async (_, dispatcher, server, __, { wait_for }, options) => {
  if (options.noMain) return;
  const workerCount = wait_for === "cpu" ? await getCPUCount() : wait_for;
  dispatcher.expectWorkers(workerCount).then(async () => {
    const main = require("main.clio.js");
    const clientTransport = server.getTransport();
    const executor = new Executor(clientTransport);
    await run(main, { executor });
  });
};

module.exports.server = server;
module.exports.workers = workers;
module.exports.executor = executor;
