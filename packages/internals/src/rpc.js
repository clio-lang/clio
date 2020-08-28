// this should probably be a separate module
const { Dispatcher } = require("clio-rpc/dispatcher");
const { Worker } = require("clio-rpc/worker");
const { Executor } = require("clio-rpc/executor");
const os = require("os");
const { fork } = require("child_process");

const countCPUs = () => {
  if (typeof window !== "undefined" && window.navigator)
    return window.navigator.hardwareConcurrency;
  return os.cpus().length;
};

const cpuCount = countCPUs();

class WorkerThreadHelper {
  startServer(config, dispatcher) {
    const WorkerThread = require("clio-rpc/transports/worker-thread");
    this.transport = new WorkerThread.Server();
    dispatcher.addTransport(this.transport);
  }
  spawnWorkers(config) {
    const workerCount =
      config.workers.count === "cpu" ? cpuCount : config.workers.count;
    for (let i = 0; i < workerCount; i++) this.spawnWorker(config);
  }
  spawnWorker(config) {
    const { Worker } = require("worker_threads");
    const worker = new Worker(config.workers.workerFile);
    this.transport.addWorker(worker);
  }
  static initWorker() {
    const { parentPort } = require("worker_threads");
    const { Worker } = require("clio-rpc/worker");
    const WorkerThread = require("clio-rpc/transports/worker-thread");
    const transport = new WorkerThread.Client({
      postMessage(data) {
        parentPort.postMessage(data);
      },
    });
    const worker = new Worker(transport);
    registerFns(worker);
    parentPort.on("message", (message) => transport.onmessage(message));
    worker.connect();
  }
}

const startServer = (config) => {
  console.log("Starting server process");
  const dispatcher = new Dispatcher();
  const { transports } = config;
  for (const options of transports) {
    const tp = options.transport.toLowerCase();
    const Transport = require(`clio-rpc/transports/${tp}`);
    const transport = new Transport.Server(options);
    dispatcher.addTransport(transport);
  }
  return dispatcher;
};

const registerFns = (worker) => {
  [...fns.values()].forEach((fn) => {
    if (fn.filename && fn.name && fn.path) {
      //console.log("Registering", fn.path);
      worker.register({
        path: fn.path,
        async fn(...args) {
          const call = await fn.withContext(true)(...args);
          const result = await call.valueOf();
          return result;
        },
      });
    }
  });
};

const startWorker = () => {
  // this is a worker process
  const options = Object.keys(process.env)
    .filter((key) => key.startsWith("CLIO_WORKER_"))
    .map((key) => [
      key.replace(/^CLIO_WORKER_/, "").toLowerCase(),
      process.env[key],
    ])
    .reduce(fromEntries, {});
  console.log("Starting worker", options.id);
  const tp = options.transport.toLowerCase();
  const Transport = require(`clio-rpc/transports/${tp}`);
  const transport = new Transport.Client(options);
  const worker = new Worker(transport);
  registerFns(worker);
  const executorTransport = new Transport.Client(options);
  initExecutor(executorTransport);
  worker.connect();
};

const forkWorkers = (config) => {
  const start = process.argv[1];
  const { workers } = config;
  for (const worker of workers) {
    const { count = numCPUs, ...options } = worker;
    const OPTIONS = Object.entries(options)
      .map(([key, value]) => [`CLIO_WORKER_${key.toUpperCase()}`, value])
      .reduce(fromEntries, {});
    for (let i = 0; i < count; i++) {
      fork(start, [], {
        env: { CLIO_PROCESS_TYPE: "WORKER", CLIO_WORKER_ID: i, ...OPTIONS },
      });
    }
  }
};

const runMain = (scope, config) => {
  const { executor: options } = config;
  const tp = options.transport.toLowerCase();
  const Transport = require(`clio-rpc/transports/${tp}`);
  const transport = new Transport.Client(options);
  initExecutor(transport);
  const main = scope.$.main.withContext(true);
  console.log("Running main");
  main(process.argv).valueOf();
};

const startMaster = (scope, config) => {
  if (!scope.$.main) throw new Error("No main function, refusing to run.");
  console.log("Starting master process");
  const dispatcher = startServer(config);
  forkWorkers(config);
  dispatcher
    .expectWorkers(config.executor.expect || numCPUs)
    .then(() => runMain(scope, config));
};

const initExecutor = (transport) => {
  module.exports.executor = new Executor(transport);
};

const init = (scope, config) => {
  const { CLIO_PROCESS_TYPE = "MASTER" } = process.env;
  if (CLIO_PROCESS_TYPE == "MASTER") startMaster(scope, config);
  else if (CLIO_PROCESS_TYPE == "SERVER") startServer(config);
  else if (CLIO_PROCESS_TYPE == "WORKER") startWorker();
};

const fns = new Map();

module.exports.init = init;
module.exports.fns = fns;
module.exports.WorkerThreadHelper = WorkerThreadHelper;
module.exports.initExecutor = initExecutor;
