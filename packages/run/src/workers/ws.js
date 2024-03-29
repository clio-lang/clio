import { Client } from "clio-rpc/transports/ws/index.js";
import { Executor } from "clio-rpc/executor.js";
import { Worker } from "clio-rpc/worker.js";
import { run } from "../index.js";

const [url, file] = process?.argv?.slice?.(2) || [];

const transport = new Client({ url });
const worker = new Worker(transport);
const executor = new Executor(transport);

import(file).then((main) => run(main, { worker, executor }));
