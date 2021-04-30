const { run } = require("../index");
const { parentPort, workerData } = require("worker_threads");
const { Worker } = require("clio-rpc/worker");
const { Executor } = require("clio-rpc/executor");
const WorkerThread = require("clio-rpc/transports/worker-thread");

const transport = new WorkerThread.Client({ parentPort });

// worker and executor shouldn't share the same socket
const worker = new Worker(transport);
const executor = new Executor(transport);

const main = require(workerData.file);
run(main, { worker, executor }).then(() => worker.connect());
