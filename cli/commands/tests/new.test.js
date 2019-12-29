const tmp = require("tmp");
const fs = require("fs");
const path = require("path");
const { _new } = require("../");
const packageConfig = require("../../../package/packageConfig");

test("Create a package", async () => {
  const dir = tmp.dirSync();
  await _new(dir.name);
  const files = fs.readdirSync(dir.name);
  expect(files.includes("src")).toBe(true);
  expect(files.includes("clio.toml")).toBe(true);
  expect(files.includes(".gitignore")).toBe(true);
  expect(files.includes(".git")).toBe(true);

  dir.removeCallback();
});

test("Freshly generated project file includes multiple authors", async () => {
  const dir = tmp.dirSync();
  await _new(dir.name);
  const config = packageConfig.getPackageConfig(path.join(dir.name, "clio.toml"));
  expect(Array.isArray(config.authors)).toBe(true);

  dir.removeCallback();
});
