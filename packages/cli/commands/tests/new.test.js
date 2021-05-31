const tmp = require("tmp");
const fs = require("fs");
const path = require("path");

const { _new } = require("..");
const { CONFIGFILE_NAME, getPackageConfig } = require("clio-manifest");
test("Create a package", async () => {
  const dir = tmp.dirSync({ unsafeCleanup: true });
  await _new(dir.name);
  const files = fs.readdirSync(dir.name);
  expect(files.includes("src")).toBe(true);
  expect(files.includes(CONFIGFILE_NAME)).toBe(true);
  expect(files.includes(".gitignore")).toBe(true);
  expect(files.includes(".git")).toBe(true);

  dir.removeCallback();
});

test("Freshly generated project file includes multiple authors", async () => {
  const dir = tmp.dirSync({ unsafeCleanup: true });
  await _new(dir.name);
  const config = getPackageConfig(path.join(dir.name, CONFIGFILE_NAME));
  expect(Array.isArray(config.authors)).toBe(true);

  dir.removeCallback();
});
