const fs = require('fs');
const path = require('path');
const tmp = require("tmp");
const { createPackage } = require('../../../cli/commands/new');
const { compile } = require('../../../cli/commands/build');

test("Compile source to target", async () => {
  const dir = tmp.dirSync();
  await createPackage(dir.name);
  await compile(dir.name);
  const files = fs.readdirSync(path.join(dir.name, '.clio/target/node'));
  expect(files.includes("index.clio.js")).toBe(true);
});
