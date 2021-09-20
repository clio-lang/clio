import { run } from "clio-run/src/index";
import { Dispatcher } from "clio-rpc/dispatcher";
import { Executor } from "clio-rpc/executor";
import WebWorker from "clio-rpc/transports/web-worker";
import { getModule } from "./common";
import { getCPUCount } from "clio-run/src/lib/web-cpu";

export default async (src) => {
  const numCPUs = await getCPUCount();
  const main = await getModule(src);
  const encoded = encodeURIComponent(src.replace(/%/g, "~~mod~~"));

  const dispatcher = new Dispatcher();
  const serverTransport = new WebWorker.Server();
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
