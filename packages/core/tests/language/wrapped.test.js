const { compile } = require("../../compiler");
const fs = require("fs");
const path = require("path");

/*
  TODO: Find a way to test compiled files with RPC.
  refer to packages/manifest/rpc/index.js#makeStartScript
  for more info.

  Possible solutions:
    - Create a local RPC profile and use that to run tests
    - Find a way to run a full SOCK/TCP cluster without breaking the test
*/
test("Compile and run wrapped expressions", async () => {
  const file = path.join(__dirname, "./clio/wrapped.clio");
  const input = fs.readFileSync(file, { encoding: "utf8" });
  const output = await compile(input, file);
  const { code } = output.toStringWithSourceMap();
  const module = { exports: {} };
  eval(code);
  Object.values(module.exports.scope).forEach((fn) => {
    if (fn.context) fn.context.run = true;
  });
  const { main } = module.exports.scope;
  const lazy = await main();
  const { result } = await lazy.valueOf();
  expect(result.twentySeven.valueOf()).toEqual(27);
  expect(result.eight.valueOf()).toEqual(8);
  expect(result.nine.valueOf()).toEqual(9);
  expect(result.ninety.valueOf()).toEqual(90);
});
