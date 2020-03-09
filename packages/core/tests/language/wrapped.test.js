const { compile } = require("../../compiler");
const fs = require("fs");
const path = require("path");

test("Compile and run wrapped expressions", async () => {
  const file = path.join(__dirname, "./clio/wrapped.clio");
  const input = fs.readFileSync(file, { encoding: "utf8" });
  const output = await compile(input, file);
  const { code } = output.toStringWithSourceMap();
  const module = { exports: {} };
  eval(code);
  const { scope } = module.exports;
  expect(scope.twentySeven.valueOf()).toEqual(27);
  expect(scope.eight.valueOf()).toEqual(8);
  expect(scope.nine.valueOf()).toEqual(9);
  expect(scope.ninety.valueOf()).toEqual(90);
});
