// this should probably be a separate module

const { Dispatcher } = require("clio-rpc/dispatcher");
const { Worker } = require("clio-rpc/worker");
const { Executor } = require("clio-rpc/executor");
const IPC = require("clio-rpc/transports/ipc");
const os = require("os");
const { fork } = require("child_process");

const numCPUs = os.cpus().length;

const fromKeyValues = (prev, curr) => {
  prev[curr.key] = curr.value;
  return prev;
};

const startServer = () => {
  console.log("Starting server process");
  const dispatcher = new Dispatcher();
  const transport = new IPC.Server();
  dispatcher.addTransport(transport);
  return dispatcher;
};

const startWorker = () => {
  // this is a worker process
  const { CLIO_WORKER_ID } = process.env;
  console.log("Starting worker", CLIO_WORKER_ID);
  const options = Object.keys(process.env)
    .filter(key => key.startsWith("CLIO_WORKER_"))
    .map(key => [key.replace(/^CLIO_WORKER_/, ""), process.env[key]])
    .reduce(fromKeyValues, {});
  console.log({ options });
  const transport = new IPC.Client();
  const worker = new Worker(transport);
  [...fns.values()].forEach(fn => {
    if (fn.filename && fn.name && fn.path) {
      console.log("Registering", fn.path);
      worker.register({
        path: fn.path,
        async fn(...args) {
          const call = await fn.withContext(true)(...args);
          const result = await call.valueOf();
          console.log({ result });
          return result;
        }
      });
    }
  });
  initExecutor();
  worker.connect();
};

const forkWorkers = config => {
  const start = process.argv[1];
  const { workers } = config;
  for (const worker of workers) {
    const { transport, count = numCPUs, ...options } = worker;
    const OPTIONS = Object.entries(options)
      .map(([key, value]) => ({
        key: `CLIO_WORKER_${key.toUpperCase()}`,
        value
      }))
      .reduce(fromKeyValues, {});
    for (let i = 0; i < count; i++) {
      fork(start, [], {
        env: { CLIO_PROCESS_TYPE: "WORKER", CLIO_WORKER_ID: i, ...OPTIONS }
      });
    }
  }
};

const runMain = scope => {
  initExecutor();
  const main = scope.$.main.withContext(true);
  console.log("Running main");
  main(process.argv).valueOf();
};

const startMaster = (scope, config) => {
  if (!scope.$.main) throw new Error("No main function, refusing to run.");
  console.log("Starting master process");
  const dispatcher = startServer();
  const [transport] = dispatcher.transports;
  transport.ipcServer.on("listening", () => forkWorkers(config));
  dispatcher.expectWorkers(numCPUs).then(() => runMain(scope));
};

const initExecutor = () => {
  const transport = new IPC.Client();
  module.exports.executor = new Executor(transport);
};

const init = (scope, config) => {
  const { CLIO_PROCESS_TYPE = "MASTER" } = process.env;
  if (CLIO_PROCESS_TYPE == "MASTER") startMaster(scope, config);
  else if (CLIO_PROCESS_TYPE == "SERVER") startServer();
  else if (CLIO_PROCESS_TYPE == "WORKER") startWorker();
};

const fns = new Map();

module.exports.init = init;
module.exports.fns = fns;
