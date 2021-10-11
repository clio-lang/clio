import { Dispatcher } from "clio-rpc/dispatcher.js";
import { Executor } from "clio-rpc/executor.js";
import { Server } from "clio-rpc/transports/web-worker/index.js";
import { getCPUCount } from "clio-run/src/lib/web-cpu.js";
import { getModule } from "./common.js";
import { run } from "clio-run/src/index.js";

export default async (src) => {
  const numCPUs = await getCPUCount();
  const main = await getModule(src);
  const encoded = encodeURIComponent(src.replace(/%/g, "~~mod~~"));

  const dispatcher = new Dispatcher();
  const serverTransport = new Server();
  for (let i = 0; i < numCPUs; i++) {
    const worker = new Worker(`./build/worker.js?src=${encoded}`);
    serverTransport.addWorker(worker);
  }
  dispatcher.addTransport(serverTransport);
  return dispatcher.expectWorkers(numCPUs).then(() => {
    const clientTransport = serverTransport.getTransport();
    const executor = new Executor(clientTransport);
    return {
      main: () => run(main, { executor }, { noExit: true }),
      dispatcher,
    };
  });
};
