const { compile } = require("../../compiler");
const fs = require("fs");
const path = require("path");

test("Compile and run maths", async () => {
  const file = path.join(__dirname, "./clio/math.clio");
  const input = fs.readFileSync(file, { encoding: "utf8" });
  const output = await compile(input, file);
  const { code } = output.toStringWithSourceMap();
  const module = { exports: {} };
  eval(code);
  const { scope } = module.exports;
  expect(scope.one.valueOf()).toEqual(1);
  expect(scope.two.valueOf()).toEqual(2);
  expect(scope.three.valueOf()).toEqual(3);
  expect(scope.four.valueOf()).toEqual(4);
  expect(scope.five.valueOf()).toEqual(5);
  expect(scope.six.valueOf()).toEqual(6);
  expect(scope.ten.valueOf()).toEqual(10);
  expect(scope.twentyEight.valueOf()).toEqual(28);
});
