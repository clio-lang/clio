const tmp = require("tmp");
const path = require("path");
const fs = require("fs");
const { createPackage } = require("../../../cli/commands/new");
const { run } = require("../../../cli/commands/run");
const deps = require("../../../cli/commands/deps_commands/get");
const packageConfig = require("../../../package/packageConfig");

test("Runs hello world", async () => {
  console.log = jest.fn();
  const dir = tmp.dirSync();
  await createPackage(dir.name);
  await run(dir.name);
  dir.removeCallback();
  expect(console.log).toHaveBeenCalledWith("Hello World");
});

test("Runs a project with dependencies", async () => {
  console.log = jest.fn();
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
