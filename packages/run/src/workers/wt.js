const { run } = require("../index");
const { parentPort, workerData } = require("worker_threads");
const { Worker } = require("clio-rpc/worker");
const { Executor } = require("clio-rpc/executor");
const WorkerThread = require("clio-rpc/transports/worker-thread");

const transport = new WorkerThread.Client({
  postMessage(data) {
    parentPort.postMessage(data);
  },
});

const worker = new Worker(transport);
const executor = new Executor(transport);

parentPort.on("message", message => transport.onmessage(message));

const main = require(workerData.file);
run(main, { worker, executor }).then(() => worker.connect());
