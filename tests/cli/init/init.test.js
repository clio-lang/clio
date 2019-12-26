const fs = require("fs");
const tmp = require("tmp");
const { initPackage } = require("../../../cli/commands/init");

test("Inits a package", async () => {
  const dir = tmp.dirSync();
  await initPackage(true, "testing", dir.name);
  const files = fs.readdirSync(dir.name);
  expect(files.includes("clio.toml")).toBe(true);
  expect(files.includes("clio_env")).toBe(true);
  dir.removeCallback();
});
