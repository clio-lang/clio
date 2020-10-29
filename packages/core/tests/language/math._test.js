/* const { compile } = require("../../compiler");
const fs = require("fs");
const path = require("path");

test("Compile and run maths", async () => {
  const file = path.join(__dirname, "./clio/math.clio");
  const input = fs.readFileSync(file, { encoding: "utf8" });
  const output = await compile(input, file);
  const { code } = output.toStringWithSourceMap();
  const module = { exports: {} };
  console.log(code);

  eval(code);
  const { scope } = module.exports;
  const result = scope.test();
  expect(result.one.valueOf()).toEqual(1);
  expect(result.two.valueOf()).toEqual(2);
  expect(result.three.valueOf()).toEqual(3);
  expect(result.four.valueOf()).toEqual(4);
  expect(result.five.valueOf()).toEqual(5);
  expect(result.six.valueOf()).toEqual(6);
  expect(result.ten.valueOf()).toEqual(10);
  expect(result.twentyEight.valueOf()).toEqual(28);
});
 */
