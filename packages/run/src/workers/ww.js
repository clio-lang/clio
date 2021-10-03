import { Client } from "clio-rpc/transports/web-worker";
import { Executor } from "clio-rpc/executor";
import { Worker } from "clio-rpc/worker";
// To be worked out by the bundler
import main from "main.clio.js";
import { run } from "../index.js";

const transport = new Client({
  postMessage(data) {
    postMessage(data);
  },
});

const worker = new Worker(transport);
const executor = new Executor(transport);

onmessage = (message) => transport.onmessage(message);

run(main, { worker, executor }, { noMain: true }).then(() => worker.connect());
