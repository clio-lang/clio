const { Monitor } = require("../index");
const { Dispatcher } = require("clio-rpc/dispatcher");

const ws = require("./ws");
const wt = require("./wt");
const ww = require("./ww");
const tcp = require("./tcp");
const ipc = require("./ipc");

const runners = { ws, wt, ww, tcp, ipc };

const start = async (file, options, isHost = false) => {
  const monitor = new Monitor();
  const dispatcher = new Dispatcher();

  const serverFromConfig = async (config, index) => {
    const { server } = runners[config.proto];
    return [config.name || index, await server(dispatcher, config)];
  };

  const servers = Object.fromEntries(
    await Promise.all(options.servers.map(serverFromConfig))
  );

  options.workers.forEach((config, i) => {
    const { workers } = runners[config.proto];
    workers(file, servers[config.server || i], config);
  });

  const execOptions = {};

  if (isHost) Object.assign(execOptions, { noExit: true, noMain: true });
  if (!options.executor) return;

  const { executor } = runners[options.executor.proto];
  return executor(
    file,
    dispatcher,
    servers[options.executor.server || 0],
    monitor,
    options.executor,
    execOptions
  );
};

module.exports = start;
