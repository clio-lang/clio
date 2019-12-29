const fs = require("fs");
const tmp = require("tmp");
const { init } = require("../");

test("Inits a package", async () => {
  const dir = tmp.dirSync();
  await init(true, "testing", dir.name);
  const files = fs.readdirSync(dir.name);
  expect(files.includes("clio.toml")).toBe(true);
  expect(files.includes("clio_env")).toBe(true);
  dir.removeCallback();
});
