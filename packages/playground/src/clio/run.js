import { run } from "clio-run/src/index";
import { Dispatcher } from "clio-rpc/dispatcher";
import { Executor } from "clio-rpc/executor";
import WebWorker from "clio-rpc/transports/web-worker";
import { getModule } from "./common";

export default async (src) => {
  const numCPUs = navigator.hardwareConcurrency;
  const main = await getModule(src);
  const src64 = btoa(src);

  const dispatcher = new Dispatcher();
  const serverTransport = new WebWorker.Server();
  for (let i = 0; i < numCPUs; i++) {
    const worker = new Worker(`./build/worker.js?src=${src64}`);
    serverTransport.addWorker(worker);
  }
  dispatcher.addTransport(serverTransport);
  dispatcher.expectWorkers(numCPUs).then(() => {
    const clientTransport = serverTransport.getTransport();
    const executor = new Executor(clientTransport);
    run(main, { executor }, { noExit: true });
  });
};
