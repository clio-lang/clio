import { parentPort, workerData } from "worker_threads";

import { Client } from "clio-rpc/transports/worker-thread";
import { Executor } from "clio-rpc/executor";
import { Worker } from "clio-rpc/worker";
import { run } from "../index.js";

const transport = new Client({ parentPort });

// worker and executor shouldn't share the same socket
const worker = new Worker(transport);
const executor = new Executor(transport);

import(workerData.file)
  .then((main) => run(main, { worker, executor }))
  .then(() => worker.connect());
