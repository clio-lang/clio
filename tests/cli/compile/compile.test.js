const path = require('path');
const fs = require('fs');
const tmp = require("tmp");
const { createPackage } = require('../../../cli/commands/new');
const { compile } = require('../../../cli/commands/compile');

test("Compile source to target", async () => {
  const dir = tmp.dirSync();
  await createPackage(dir.name);
  const source = path.join(dir.name, 'index.clio');
  const destination = path.join(dir.name, 'index.js');
  compile(source, destination);
  const files = fs.readdirSync(dir.name);
  expect(files.includes("index.js")).toBe(true);
});
