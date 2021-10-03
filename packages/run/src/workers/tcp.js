import { Client } from "clio-rpc/transports/tcp";
import { Executor } from "clio-rpc/executor";
import { Worker } from "clio-rpc/worker";
import { run } from "../index.js";

const [host, port, file] = process?.argv?.slice?.(2) || [];

const config = {
  host: host === "0.0.0.0" ? "127.0.0.1" : host,
  port: parseInt(port),
};

const transport = new Client(config);
const worker = new Worker(transport);
const executor = new Executor(transport);

const main = import(file).then((main) => run(main, { worker, executor }));
