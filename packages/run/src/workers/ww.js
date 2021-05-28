const { run } = require("../index");
const { Worker } = require("clio-rpc/worker");
const { Executor } = require("clio-rpc/executor");
const WebWorker = require("clio-rpc/transports/web-worker");

const location = new URL(self.location);
const file = location.searchParams.get("file");

const transport = new WebWorker.Client({
  postMessage(data) {
    postMessage(data);
  },
});

const worker = new Worker(transport);
const executor = new Executor(transport);

onmessage = (message) => transport.onmessage(message);

// TODO: this locks us to parcel
const main = require("main.clio");
run(main, { worker, executor }, { noMain: true }).then(() => worker.connect());
