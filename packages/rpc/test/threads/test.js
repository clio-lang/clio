const { Worker } = require("worker_threads");
const { Dispatcher } = require("../../dispatcher");
const { Executor } = require("../../executor");
const WorkerThread = require("../../transports/worker-thread");
const os = require("os");

const numCPUs = os.cpus().length;

const logResults = (args) => (result) =>
  console.log(`${args.join(" ")} -> /api/add := ${result}`);

const call = (server) => () => {
  const transport = server.getTransport();
  const executor = new Executor(transport);
  executor.call("/api/add", [1, 2]).then(logResults([1, 2]));
  executor.call("/api/add", [2, 3]).then(logResults([2, 3]));
  executor.call("/api/add", [3, 4]).then(logResults([3, 4]));
  executor.call("/api/add", [4, 5]).then(logResults([4, 5]));
};

const dispatcher = new Dispatcher();
const transport = new WorkerThread.Server();
for (let i = 0; i < numCPUs; i++) {
  const worker = new Worker("./worker.js");
  transport.addWorker(worker);
}
dispatcher.addTransport(transport);
dispatcher.expectWorkers(numCPUs).then(call(transport));
