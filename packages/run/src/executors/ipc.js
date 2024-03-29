import { Client } from "clio-rpc/transports/ipc/index.js";
import { Executor } from "clio-rpc/executor.js";

export default async function (key, _, path) {
  const transport = new Client({ path });
  transport.connect();
  await new Promise((resolve) => transport.on("connect", resolve));
  const executor = new Executor(transport);
  this.executors.set(key, executor);
  return executor;
}
