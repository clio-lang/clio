import { Client } from "clio-rpc/transports/web-worker/index.js";
import { Executor } from "clio-rpc/executor.js";
import { Worker } from "clio-rpc/worker.js";
import { getModule } from "./common.js";
import { run } from "clio-run/src/index.js";

const location = new URL(self.location);
const encoded = location.searchParams.get("src");
const src = decodeURIComponent(encoded).replace(/~~mod~~/g, "%");

const transport = new Client({
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
