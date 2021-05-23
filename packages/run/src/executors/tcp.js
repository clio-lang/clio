const { Executor } = require("clio-rpc/executor");
const TCP = require("clio-rpc/transports/tcp");

module.exports = async function (key, _, addr) {
  const [host, port] = addr.split(":");
  const transport = new TCP.Client({ host, port });
  transport.connect();
  await new Promise((resolve) => transport.on("connect", resolve));
  const executor = new Executor(transport);
  this.executors.set(key, executor);
  return executor;
};
