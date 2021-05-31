const { run } = require("../index");
const { Worker } = require("clio-rpc/worker");
const { Executor } = require("clio-rpc/executor");
const WebWorker = require("clio-rpc/transports/web-worker");

const transport = new WebWorker.Client({
  postMessage(data) {
    postMessage(data);
  },
});

const worker = new Worker(transport);
const executor = new Executor(transport);

onmessage = (message) => transport.onmessage(message);

// To be worked out by the bundler
const main = require("main.clio.js");
run(main, { worker, executor }, { noMain: true }).then(() => worker.connect());
