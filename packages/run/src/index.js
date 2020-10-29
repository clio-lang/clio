const { Executor } = require("clio-rpc/executor");
const { getImport } = require("clio-internals");

class Distributed {
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
    // only ws for now
    const Protocol = require("../../rpc/transports/ws");
    const transport = new Protocol.Client({ url: `${protocol}://${host}` });
    transport.connect();
    await new Promise(resolve => transport.on("connect", resolve));
    const executor = new Executor(transport);
    this.executors.set(key, executor);
    return executor;
  }
}

const workerDist = (executor, worker) =>
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

const mainDist = executor =>
  new Distributed(false, {
    getFunction(fn) {
      return executor.getFunction(fn);
    },
    getFunctions(path) {
      return executor.getFunctions(path);
    },
  });

const run = async (
  module,
  { worker, executor },
  { noExit = false, noMain = false } = {}
) => {
  const clio = {
    distributed: worker ? workerDist(executor, worker) : mainDist(executor),
  };
  getImport(clio);
  const { main } = await module.__clioModule(clio);
  if (!worker) {
    if (!noMain) {
      const result = await main([]);
      if (Array.isArray(result)) {
        await Promise.all(result);
      } else {
        await result;
      }
    }
    if (!noExit) {
      process.exit();
    }
  }
};

module.exports.Distributed = Distributed;
module.exports.run = run;
