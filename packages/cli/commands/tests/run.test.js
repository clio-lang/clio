import { MODULES_PATH, installNpmDependency } from "clio-manifest";
import { readFileSync, readdirSync, writeFileSync } from "fs";

import { handler as addHandler } from "../deps_commands/add.js";
import { createPackage } from "../new.js";
import { dirSync } from "tmp";
import { handler as getHandler } from "../deps_commands/get.js";
import { jest } from "@jest/globals";
import { join } from "path";
import { run } from "../run.js";

jest.useFakeTimers();

test("Runs hello world", async () => {
  const dir = dirSync({ unsafeCleanup: true });
  await createPackage(dir.name);
  const process = await run({ project: dir.name }, [], {
    stdio: "pipe",
  });
  const hello = await new Promise((resolve) => {
    process.stdout.on("data", (data) => {
      const str = data.toString();
      if (str === "Hello World\n") resolve(true);
    });
  });
  await new Promise((resolve) => process.on("close", resolve));
  dir.removeCallback();
  expect(hello).toBe(true);
});

test("Runs a project with dependencies", async () => {
  const dir = dirSync({ unsafeCleanup: true });
  await createPackage(dir.name);
  await addHandler({
    project: dir.name,
    source: "https://github.com/clio-lang/math@master",
  });
  const configPath = join(dir.name, "clio.toml");
  await installNpmDependency(configPath, "uuid@latest", {});
  await installNpmDependency(configPath, "rimraf", {
    dev: true,
  });
  await getHandler({ project: dir.name });
  const main = join(dir.name, "src", "main.clio");
  writeFileSync(
    main,
    `from "math@master" import fib\n\nexport fn main:\n  fib 10 -> console.log`
  );
  const process = await run({ project: dir.name });
  await new Promise((resolve) => process.on("close", resolve));
  expect(
    readdirSync(join(dir.name, "build", MODULES_PATH)).toString()
  ).toContain("fib@master");
  const nodeModules = readdirSync(join(dir.name, "build", "node_modules"));
  expect(nodeModules).toContain("uuid");
  expect(nodeModules).toContain("rimraf");
  const packageJson = JSON.parse(
    readFileSync(join(dir.name, "build", "package.json")).toString()
  );
  expect(Object.keys(packageJson.dependencies)).toContain("uuid");
  expect(Object.keys(packageJson.devDependencies)).toContain("rimraf");
  dir.removeCallback();
}, 60000);
