const { run } = require("../index");
const { Worker } = require("clio-rpc/worker");
const { Executor } = require("clio-rpc/executor");
const IPC = require("clio-rpc/transports/ipc");

const [path, file] = process?.argv?.slice?.(2) || [];

const transport = new IPC.Client({ path });
const worker = new Worker(transport);
const executor = new Executor(transport);

const main = require(file);
run(main, { worker, executor });
