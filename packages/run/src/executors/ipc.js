const { Executor } = require("clio-rpc/executor");
const IPC = require("clio-rpc/transports/ipc");

module.exports = async function (key, _, path) {
  const transport = new IPC.Client({ path });
  transport.connect();
  await new Promise((resolve) => transport.on("connect", resolve));
  const executor = new Executor(transport);
  this.executors.set(key, executor);
  return executor;
};
