const { compile } = require("../../compiler");
const fs = require("fs");
const path = require("path");
const { rpc } = require("clio-internals");
const os = require("os");
const { run } = require("jest");

const numCPUs = os.cpus().length;

/*
  TODO: Replace fork with makeWorker in clio-internals/rpc
*/

const run = (scope) => {
  const config = {
    transports: [
      {
        transport: "worker-threads",
        expect: numCPUs,
      },
    ],
    workers: [
      {
        transport: "worker-threads",
        count: numCPUs,
      },
    ],
    executor: {
      transport: "worker-threads",
    },
  };
  return rpc.init(scope, config);
};

test("Compile and run wrapped expressions", async () => {
  const file = path.join(__dirname, "./clio/wrapped.clio");
  const input = fs.readFileSync(file, { encoding: "utf8" });
  const output = await compile(input, file);
  const { code } = output.toStringWithSourceMap();
  const module = { exports: {} };
  eval(code);
  const { scope } = module.exports;
  const { result } = await run(scope);
  expect(result.twentySeven.valueOf()).toEqual(27);
  expect(result.eight.valueOf()).toEqual(8);
  expect(result.nine.valueOf()).toEqual(9);
  expect(result.ninety.valueOf()).toEqual(90);
});
