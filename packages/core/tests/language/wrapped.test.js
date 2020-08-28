const { compile } = require("../../compiler");
const fs = require("fs");
const path = require("path");
const { WorkerThreadHelper, initExecutor } = require("clio-internals/src/rpc");
const { Dispatcher } = require("clio-rpc/dispatcher");

class WTH2 extends WorkerThreadHelper {
  spawnWorker(config) {
    const { Worker } = require("worker_threads");
    const worker = new Worker(config.workers.workerFile, {
      eval: true,
      workerData: { __dirname },
    });
    this.transport.addWorker(worker);
  }
}

const workerFile = async () => {
  const fs = require("fs");
  const path = require("path");
  const { WorkerThreadHelper } = require("clio-internals/src/rpc");
  const { __dirname } = require("worker_threads").workerData;
  const { compile } = require(path.join(__dirname, "../../compiler"));
  const file = path.join(__dirname, "./clio/wrapped.clio");
  const input = fs.readFileSync(file, { encoding: "utf8" });
  const output = await compile(input, file);
  const { code } = output.toStringWithSourceMap();
  const module = { exports: {} };
  eval(code);
  WorkerThreadHelper.initWorker();
};

const run = async (scope) => {
  const dispatcher = new Dispatcher();
  const wth = new WTH2();
  wth.startServer({}, dispatcher);
  wth.spawnWorkers({
    workers: {
      count: "cpu",
      workerFile: `(${workerFile.toString()})()`,
    },
  });
  const transport = wth.transport.getTransport();
  initExecutor(transport);
  const main = scope.main.withContext(true);
  return dispatcher.expectWorkers(16).then(() => main([]).valueOf());
};

const test = (name, fn) => {
  console.log(`Running "${name}"`);
  fn();
};

const getScope = async () => {
  const file = path.join(__dirname, "./clio/wrapped.clio");
  const input = fs.readFileSync(file, { encoding: "utf8" });
  const output = await compile(input, file);
  const { code } = output.toStringWithSourceMap();
  const module = { exports: {} };
  eval(code);
  const { scope } = module.exports;
  return scope;
};

test("Compile and run wrapped expressions", async () => {
  const scope = await getScope();
  const { result } = await run(scope);
  console.log({ result });
  expect(result.twentySeven.valueOf()).toEqual(27);
  expect(result.eight.valueOf()).toEqual(8);
  expect(result.nine.valueOf()).toEqual(9);
  expect(result.ninety.valueOf()).toEqual(90);
});
