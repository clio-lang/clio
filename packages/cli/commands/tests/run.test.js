const tmp = require("tmp");
const path = require("path");
const fs = require("fs");
const { createPackage } = require("../new");
const { run } = require("../run");
const deps = require("../deps_commands/get");
const packageConfig = require("clio-manifest");

test("Runs hello world", async () => {
  const dir = tmp.dirSync();
  await createPackage(dir.name);
  const process = await run(dir.name, { stdio: "pipe" });
  dir.removeCallback();
  const data = await new Promise((resolve) =>
    process.stdout.on("data", resolve)
  );
  expect(data.toString()).toEqual("Hello World\n");
});

test("Runs a project with dependencies", async () => {
  const dir = tmp.dirSync();
  await createPackage(dir.name);
  const config = packageConfig.getPackageConfig(
    path.join(dir.name, "clio.toml")
  );
  config.dependencies.push({ name: "hub:add", version: "latest" });
  packageConfig.writePackageConfig(config, dir.name);
  await deps.handler();
  await run(dir.name);
  expect(
    fs
      .readdirSync(path.join(dir.name, "build", "node", "node_modules"))
      .toString()
  ).toContain("add");
  await dir.removeCallback();
});
