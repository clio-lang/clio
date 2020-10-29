const { run } = require("../index");
const { Dispatcher } = require("clio-rpc/dispatcher");
const { Executor } = require("clio-rpc/executor");
const WS = require("clio-rpc/transports/ws");

const child_process = require("child_process");
const os = require("os");

const start = file => {
  const numCPUs = os.cpus().length;
  const port = 1337;
  const url = "ws://localhost:1337";
  const main = require(file);

  const dispatcher = new Dispatcher();
  const transport = new WS.Server({ port, url });

  const spawnWorkers = () => {
    for (let i = 0; i < numCPUs; i++) {
      child_process.fork("../workers/ws.js", [url, file]);
    }
  };

  dispatcher.addTransport(transport);
  transport.wsServer.on("listening", spawnWorkers);

  dispatcher.expectWorkers(numCPUs).then(() => {
    const transport = new WS.Client({ url });
    const executor = new Executor(transport);
    run(main, { executor }, { noExit: true, noMain: true });
  });
};

module.exports = start;
