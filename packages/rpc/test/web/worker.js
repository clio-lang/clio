const { Worker } = require("../../worker");
const WebWorker = require("../../transports/web-worker");
const transport = new WebWorker.Client({
  postMessage(data) {
    postMessage(data);
  },
});
const worker = new Worker(transport);
worker.register({ path: "/api/add", fn: (a, b) => a + b });
onmessage = (message) => transport.onmessage(message);
worker.connect();
