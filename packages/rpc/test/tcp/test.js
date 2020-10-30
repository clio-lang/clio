const { Dispatcher } = require("../../dispatcher");
const { Worker } = require("../../worker");
const { Executor } = require("../../executor");
const TCP = require("../../transports/tcp");
const os = require("os");
const cluster = require("cluster");

const numCPUs = os.cpus().length;

const fork = () => {
  for (let i = 0; i < numCPUs; i++) cluster.fork();
};

const logResults = (args) => (result) =>
  console.log(`${args.join(" ")} -> /api/add := ${result}`);

const call = () => {
  const transport = new TCP.Client();
  const executor = new Executor(transport);
  executor.call("/api/add", [1, 2]).then(logResults([1, 2]));
  executor.call("/api/add", [2, 3]).then(logResults([2, 3]));
  executor.call("/api/add", [3, 4]).then(logResults([3, 4]));
  executor.call("/api/add", [4, 5]).then(logResults([4, 5]));
};

if (cluster.isMaster) {
  const dispatcher = new Dispatcher();
  const transport = new TCP.Server();
  dispatcher.addTransport(transport);
  transport.tcpServer.on("listening", fork);
  dispatcher.expectWorkers(numCPUs).then(call);
  fork();
} else {
  const transport = new TCP.Client();
  const worker = new Worker(transport);
  worker.register({ path: "/api/add", fn: (a, b) => a + b });
  worker.connect();
}
