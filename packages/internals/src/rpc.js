const { Dispatcher } = require("clio-rpc/dispatcher");
const { Worker } = require("clio-rpc/worker");
const { Executor } = require("clio-rpc/executor");
const IPC = require("clio-rpc/transports/ipc");
const os = require("os");
const cluster = require("cluster");

const numCPUs = os.cpus().length;

const fork = () => {
  console.log("Forking");
  for (let i = 0; i < numCPUs; i++) cluster.fork();
};

const server = scope => {
  // imports will be impossible, we need to find a way to recognize the main file
  if (!scope.$.main) throw new Error("No main function, refusing to run!");
  module.exports.isServer = true;
  module.exports.isClient = false;
  console.log("Starting server");
  const dispatcher = new Dispatcher();
  const transport = new IPC.Server();
  dispatcher.addTransport(transport);
  transport.ipcServer.on("listening", fork);
  dispatcher.expectWorkers(numCPUs).then(() => {
    initExecutor();
    const main = scope.$.main.withContext(true);
    console.log("Running main");
    main(process.argv).valueOf();
  });
};

const client = () => {
  module.exports.isServer = false;
  module.exports.isClient = true;
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

const init = scope => {
  if (cluster.isMaster) server(scope);
  else client();
};

const initExecutor = () => {
  const transport = new IPC.Client();
  module.exports.executor = new Executor(transport);
};

const fns = new Map();

module.exports.init = init;
module.exports.fns = fns;
