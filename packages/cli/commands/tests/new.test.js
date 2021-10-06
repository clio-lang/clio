import { CONFIGFILE_NAME, getPackageConfig } from "clio-manifest";

import { _new } from "../index.js";
import { dirSync } from "tmp";
import { join } from "path";
import { readdirSync } from "fs";

test("Create a package", async () => {
  const dir = dirSync({ unsafeCleanup: true });
  await _new(dir.name);
  const files = readdirSync(dir.name);
  expect(files.includes("src")).toBe(true);
  expect(files.includes(CONFIGFILE_NAME)).toBe(true);
  expect(files.includes(".gitignore")).toBe(true);
  expect(files.includes(".git")).toBe(true);

  dir.removeCallback();
});

test("Freshly generated project file includes multiple authors", async () => {
  const dir = dirSync({ unsafeCleanup: true });
  await _new(dir.name);
  const config = getPackageConfig(join(dir.name, CONFIGFILE_NAME));
  expect(Array.isArray(config.authors)).toBe(true);

  dir.removeCallback();
});
