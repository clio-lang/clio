const tmp = require("tmp");
const path = require("path");
const fs = require("fs");
const { createPackage } = require("../new");
const { run } = require("../run");
const deps = require("../deps_commands/get");
const packageConfig = require("clio-manifest");

test("Runs hello world", async () => {
  const dir = tmp.dirSync({ unsafeCleanup: true });
  await createPackage(dir.name);
  const process = await run({ config: path.join(dir.name, "clio.toml") }, [], {
    stdio: "pipe",
  });
  const hello = await new Promise((resolve) => {
    process.stdout.on("data", (data) => {
      const str = data.toString();
      if (str === "Hello World\n") resolve(true);
    });
  });
  dir.removeCallback();
  expect(hello).toBe(true);
});

test("Runs a project with dependencies", async () => {
  const dir = tmp.dirSync({ unsafeCleanup: true });
  await createPackage(dir.name);
  const filePath = path.join(dir.name, "clio.toml");
  const config = packageConfig.getPackageConfig(filePath);
  config.dependencies.push({ name: "hub:fib", version: "latest" });
  packageConfig.writePackageConfig(filePath, config);
  await deps.handler({ config: filePath });
  await run({ config: filePath });
  expect(
    fs.readdirSync(path.join(dir.name, "build", "node_modules")).toString()
  ).toContain("fib-master");
  dir.removeCallback();
});
