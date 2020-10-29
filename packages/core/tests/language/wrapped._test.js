/* const { compile } = require("../../compiler");
const fs = require("fs");
const path = require("path");

const { curry, thunk, valueOf, chain } = require("clio-internals/src/utils");
const { add, mul } = require("clio-internals/src/math");

const getMain = async () => {
  const file = path.join(__dirname, "./clio/wrapped.clio");
  const input = fs.readFileSync(file, { encoding: "utf8" });
  const output = await compile(input, file);
  const { code } = output.toStringWithSourceMap();
  const module = { exports: {} };
  eval(code);
  const clio = await module.exports({
    core: {
      curry,
      add,
      mul,
      thunk,
      chain,
      sub: curry(async (a, b) => {
        return thunk(async () => (await valueOf(a)) - (await valueOf(b)));
      }),
    },
    exports: {},
  });
  return clio.exports.main;
};

test("Compile and run wrapped expressions", async () => {
  const main = await getMain();
  const result = await valueOf(main());
  expect(await valueOf(result.twentySeven)).toEqual(27);
  expect(await valueOf(result.eight)).toEqual(8);
  expect(await valueOf(result.nine)).toEqual(9);
  expect(await valueOf(result.ninety)).toEqual(90);
});
 */
