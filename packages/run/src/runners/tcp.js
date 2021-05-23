const { run } = require("../index");
const { Executor } = require("clio-rpc/executor");
const TCP = require("clio-rpc/transports/tcp");
const path = require("path");

const child_process = require("child_process");
const os = require("os");

const server = async (dispatcher, { host, port }) => {
  const config = host && port ? { host, port } : TCP.Server.defaultTCPConfig();
  const transport = new TCP.Server(config);
  dispatcher.addTransport(transport);
  return new Promise((resolve) => {
    transport.tcpServer.on("listening", () => resolve(transport));
  });
};

const workers = (file, server, { host, port, server: name, count }) => {
  const workerCount = count === "cpu" ? os.cpus().length : count;
  const config = name ? server.tcpConfig : { host, port };
  for (let i = 0; i < workerCount; i++) {
    child_process.fork(path.resolve(__dirname, "../workers/tcp.js"), [
      config.host,
      config.port,
      file,
    ]);
  }
};

const executor = (file, dispatcher, server, monitor, config, options) => {
  if (options.noMain) return;
  const { host, port, server: name, wait_for } = config;
  const tcpConfig = name ? server.tcpConfig : { host, port };
  if (name && server.tcpConfig.host === "0.0.0.0") tcpConfig.host = "127.0.0.1";
  const workerCount = wait_for === "cpu" ? os.cpus().length : wait_for;
  dispatcher.expectWorkers(workerCount).then(async () => {
    const main = require(file);
    const transport = new TCP.Client(tcpConfig);
    const executor = new Executor(transport);
    if (!options.noExit) monitor.freeze();
    await run(main, { executor }, options);
    if (!options.noExit) monitor.exit();
  });
};

module.exports.server = server;
module.exports.workers = workers;
module.exports.executor = executor;
