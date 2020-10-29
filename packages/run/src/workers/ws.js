const { run } = require("../index");
const { Worker } = require("clio-rpc/worker");
const { Executor } = require("clio-rpc/executor");
const WS = require("clio-rpc/transports/ws");

const [url, file] = process.argv.slice(2);

const transport = new WS.Client({ url });
const worker = new Worker(transport);
const executor = new Executor(transport);

const main = require(file);
run(main, { worker, executor });
