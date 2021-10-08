import * as builtins from "clio-lang-internals";

import { createHook } from "async_hooks";
import { dirname } from "path";
import { fileURLToPath } from "url";
import ipc from "./executors/ipc.js";
import tcp from "./executors/tcp.js";
import ws from "./executors/ws.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const executors = { ws, ipc, tcp };

export class Distributed {
  constructor(isWorker, connection) {
    this.map = new Map();
    this.isWorker = isWorker;
    this.connection = connection;
    this.executors = new Map();
  }
  set(key, fn) {
    this.map.set(key, fn);
    if (this.isWorker) this.connection.register(key, fn);
  }
  get(key) {
    return this.connection.getFunction(key);
  }
  async getExecutor(protocol, host) {
    const key = `${protocol}:${host}`;
    if (this.executors.has(key)) return this.executors.get(key);
    return await executors[protocol].call(this, key, protocol, host);
  }
}

export const workerDist = (executor, worker) =>
  new Distributed(true, {
    register(path, fn) {
      return worker.register({ path, fn });
    },
    getFunction(fn) {
      return executor.getFunction(fn);
    },
    getFunctions(path) {
      return executor.getFunctions(path);
    },
  });

export const mainDist = (executor) =>
  new Distributed(false, {
    getFunction(fn) {
      return executor.getFunction(fn);
    },
    getFunctions(path) {
      return executor.getFunctions(path);
    },
  });

export class Monitor {
  constructor() {
    this.active = new Set();
    this.frozen = new Set();
    const self = this;
    if (!createHook) return;
    this.hook = createHook({
      init(asyncId, type) {
        if (type === "TIMERWRAP" || type === "PROMISE") return;
        self.active.add(asyncId);
      },
      destroy(asyncId) {
        self.active.delete(asyncId);
        self.checkExit();
      },
    });
    this.hook.enable();
  }
  freeze() {
    if (!createHook) return;
    this.frozen = new Set([...this.active]);
  }
  exit() {
    if (!createHook) return;
    this.shouldExit = true;
    this.checkExit();
  }
  checkExit() {
    if (!createHook) return;
    if (!this.shouldExit) return;
    if ([...this.active].every((handle) => this.frozen.has(handle))) {
      process?.exit(0);
    }
  }
}

export const run = async (
  module,
  { worker, executor },
  { noMain = false } = {}
) => {
  const clio = {
    distributed: worker ? workerDist(executor, worker) : mainDist(executor),
    isWorker: !!worker,
    isMain: !worker,
    exports: {},
    ...builtins,
  };
  clio.register = (name, fn) => {
    clio.distributed.set(name, fn);
    fn.parallel = clio.distributed.get(name);
    return fn;
  };
  const { main } = await module.default(clio);
  const argv = process?.argv || [];
  if (!worker && !noMain) {
    const result = await main(argv);
    const awaited = Array.isArray(result)
      ? await Promise.all(result)
      : await result;
    return awaited;
  }
};

export const importClio = async (file) => {
  // This is probably added because of parcel
  const worker_threads = "worker_threads";
  const { Worker } = await import(worker_threads);
  const { Dispatcher } = await import("clio-rpc/dispatcher.js");
  const { Executor } = await import("clio-rpc/executor.js");
  const WorkerThread = await import(
    "clio-rpc/transports/worker-thread/index.js"
  );

  const path = await import("path");
  const os = await import("os");

  const numCPUs = os.cpus().length;
  const main = await import(file);

  const dispatcher = new Dispatcher();
  const serverTransport = new WorkerThread.Server();
  const workerFile = path.resolve(__dirname, "./workers/wt.js");

  for (let i = 0; i < numCPUs; i++) {
    const worker = new Worker(workerFile, { workerData: { file } });
    serverTransport.addWorker(worker);
  }
  dispatcher.addTransport(serverTransport);

  return new Promise((resolve) => {
    dispatcher.expectWorkers(numCPUs).then(async () => {
      const clientTransport = serverTransport.getTransport();
      const executor = new Executor(clientTransport);
      const clio = {
        distributed: mainDist(executor),
        isMain: true,
        isWorker: false,
        exports: {},
        ...builtins,
      };
      const exports = await main.exports(clio);
      resolve({ dispatcher, exports });
    });
  });
};
