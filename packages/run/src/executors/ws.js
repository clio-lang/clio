const { Executor } = require("clio-rpc/executor");
const WS = require("clio-rpc/transports/ws");

module.exports = async function (key, protocol, host) {
  const transport = new WS.Client({ url: `${protocol}://${host}` });
  transport.connect();
  await new Promise((resolve) => transport.on("connect", resolve));
  const executor = new Executor(transport);
  this.executors.set(key, executor);
  return executor;
};
