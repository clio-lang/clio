const { run } = require("../index");
const { Worker } = require("clio-rpc/worker");
const { Executor } = require("clio-rpc/executor");
const TCP = require("clio-rpc/transports/tcp");

const [host, port, file] = process.argv.slice(2);

const config = {
  host: host === "0.0.0.0" ? "127.0.0.1" : host,
  port: parseInt(port),
};

const transport = new TCP.Client(config);
const worker = new Worker(transport);
const executor = new Executor(transport);

const main = require(file);
run(main, { worker, executor });
