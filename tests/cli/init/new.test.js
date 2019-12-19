const tmp = require("tmp");
const fs = require('fs');
const { createPackage } = require('../../../cli/commands/new');

test("Create a package", async () => {
  const dir = tmp.dirSync();
  await createPackage(dir.name);
  const files = fs.readdirSync(dir.name);
  expect(files.includes("index.clio")).toBe(true);
  expect(files.includes("cliopkg.toml")).toBe(true);
  expect(files.includes("clio_env")).toBe(true);
  expect(files.includes(".gitignore")).toBe(true);
  expect(files.includes(".git")).toBe(true);
});
