import { Client } from "clio-rpc/transports/tcp";
import { Executor } from "clio-rpc/executor";

export default async function (key, _, addr) {
  const [host, port] = addr.split(":");
  const transport = new Client({ host, port });
  transport.connect();
  await new Promise((resolve) => transport.on("connect", resolve));
  const executor = new Executor(transport);
  this.executors.set(key, executor);
  return executor;
}
