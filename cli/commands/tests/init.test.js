const fs = require("fs");
const tmp = require("tmp");

const { CONFIGFILE_NAME, ENV_NAME } = require("../../../package/config");
const { init } = require("../");

test("Inits a package", async () => {
  const dir = tmp.dirSync();
  await init(true, "testing", dir.name);
  const files = fs.readdirSync(dir.name);
  expect(files.includes(CONFIGFILE_NAME)).toBe(true);
  expect(files.includes(ENV_NAME)).toBe(true);
  dir.removeCallback();
});
