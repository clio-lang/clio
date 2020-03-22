const { Dispatcher } = require("clio-rpc/dispatcher");
const { Worker } = require("clio-rpc/worker");
const IPC = require("clio-rpc/transports/ipc");
const os = require("os");
const cluster = require("cluster");

const numCPUs = os.cpus().length;

const fork = () => {
  for (let i = 0; i < numCPUs; i++) cluster.fork();
};

const server = scope => {
  // imports will be impossible, we need to find a way to recognize the main file
  if (!scope.$.main) throw new Error("No main function, refusing to run!");
  const dispatcher = new Dispatcher();
  const transport = new IPC.Server();
  dispatcher.addTransport(transport);
  transport.ipcServer.on("listening", fork);
  dispatcher.expectWorkers(numCPUs).then(() => scope.$.main(scope));
};

const client = scope => {
  const transport = new IPC.Client();
  const worker = new Worker(transport);
  Object.entries(scope.scope).forEach(([path, fn]) =>
    worker.register({ path, fn })
  );
  worker.connect();
};

const init = scope => {
  if (cluster.isMaster) server(scope);
  else client(scope);
};

module.exports.init = init;
