const { parentPort } = require("worker_threads");
const { Worker } = require("../../worker");
const WorkerThread = require("../../transports/worker-thread");
const transport = new WorkerThread.Client({
  postMessage(data) {
    parentPort.postMessage(data);
  },
});
const worker = new Worker(transport);
worker.register({ path: "/api/add", fn: (a, b) => a + b });
parentPort.on("message", message => transport.onmessage(message));
worker.connect();
