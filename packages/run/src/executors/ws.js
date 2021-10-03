import { Client } from "clio-rpc/transports/ws";
import { Executor } from "clio-rpc/executor";

export default async function (key, protocol, host) {
  const transport = new Client({ url: `${protocol}://${host}` });
  transport.connect();
  await new Promise((resolve) => transport.on("connect", resolve));
  const executor = new Executor(transport);
  this.executors.set(key, executor);
  return executor;
}
