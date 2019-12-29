const fs = require("fs");
const path = require("path");
const tmp = require("tmp");
const { build, _new } = require("../");

test("Compile source to target", async () => {
  const dir = tmp.dirSync();
  await _new(dir.name);
  await build(dir.name);
  const files = fs.readdirSync(path.join(dir.name, ".clio/target/node/src"));
  console.log(files);
  expect(files.includes("main.clio.js")).toBe(true);
  dir.removeCallback();
});
