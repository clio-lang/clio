const tmp = require("tmp");
const path = require("path");
const fs = require("fs");
const { createPackage } = require("../new");
const { run } = require("../run");
const deps = require("../deps_commands/get");
const addDeps = require("../deps_commands/add");
const packageConfig = require("clio-manifest");

test("Runs hello world", async () => {
  const dir = tmp.dirSync({ unsafeCleanup: true });
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
  const dir = tmp.dirSync({ unsafeCleanup: true });
  await createPackage(dir.name);
  await addDeps.handler({
    project: dir.name,
    source: "https://github.com/clio-lang/math@master",
  });
  const configPath = path.join(dir.name, "clio.toml");
  await packageConfig.installNpmDependency(configPath, "uuid@latest", {});
  await packageConfig.installNpmDependency(configPath, "rimraf", {
    dev: true,
  });
  await deps.handler({ project: dir.name });
  const process = await run({ project: dir.name });
  await new Promise((resolve) => process.on("close", resolve));
  expect(
    fs
      .readdirSync(path.join(dir.name, "build", packageConfig.MODULES_PATH))
      .toString()
  ).toContain("fib@master");
  const nodeModules = fs.readdirSync(
    path.join(dir.name, "build", "node_modules")
  );
  expect(nodeModules).toContain("uuid");
  expect(nodeModules).toContain("rimraf");
  const packageJson = require(path.join(dir.name, "build", "package.json"));
  expect(Object.keys(packageJson.dependencies)).toContain("uuid");
  expect(Object.keys(packageJson.devDependencies)).toContain("rimraf");
  dir.removeCallback();
}, 60000);
