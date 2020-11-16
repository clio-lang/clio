import { run } from "clio-run/src/index";
import { Worker } from "clio-rpc/worker";
import { Executor } from "clio-rpc/executor";
import WebWorker from "clio-rpc/transports/web-worker";
import { getModule } from "./common";

const location = new URL(self.location);
const encoded = location.searchParams.get("src");
const src = decodeURIComponent(encoded).replace(/~~mod~~/g, "%");

const transport = new WebWorker.Client({
  postMessage(data) {
    postMessage(data);
  },
});

const worker = new Worker(transport);
const executor = new Executor(transport);

onmessage = (message) => transport.onmessage(message);

getModule(src)
  .then((main) => {
    run(main, { worker, executor });
  })
  .then(() => worker.connect());
