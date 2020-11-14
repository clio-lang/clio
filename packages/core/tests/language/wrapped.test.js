const { compile } = require("../..");
const fs = require("fs");
const path = require("path");
const { importClio } = require("clio-run");

test("Compile and run wrapped expressions", async () => {
  const relative = "./clio/wrapped.clio";
  const file = path.join(__dirname, relative);
  const input = fs.readFileSync(file, { encoding: "utf8" });
  const { code } = compile(input, relative);
  const outfile = path.join(__dirname, `${relative}.js`);
  fs.writeFileSync(outfile, code);
  const { dispatcher, exports } = await importClio(outfile);
  const result = await exports.main();
  dispatcher.kill();
  expect(result.twentySeven).toEqual(27);
  expect(result.eight).toEqual(8);
  expect(result.nine).toEqual(9);
  expect(result.ninety).toEqual(90);
});
