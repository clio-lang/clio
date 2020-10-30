const { compile } = require("../..");
const fs = require("fs");
const path = require("path");
const { importClio } = require("clio-run");

test("Compile and run maths", async () => {
  const relative = "./clio/math.clio";
  const file = path.join(__dirname, relative);
  const input = fs.readFileSync(file, { encoding: "utf8" });
  const { code } = compile(input, relative);
  const outfile = path.join(__dirname, `${relative}.js`);
  fs.writeFileSync(outfile, code);
  const { dispatcher, exports } = await importClio(outfile);
  const result = await exports.main();
  dispatcher.kill();
  expect(result.one.valueOf()).toEqual(1);
  expect(result.two.valueOf()).toEqual(2);
  expect(result.three.valueOf()).toEqual(3);
  expect(result.four.valueOf()).toEqual(4);
  expect(result.five.valueOf()).toEqual(5);
  expect(result.six.valueOf()).toEqual(6);
  expect(result.ten.valueOf()).toEqual(10);
  expect(result.twentyEight.valueOf()).toEqual(28);
});
