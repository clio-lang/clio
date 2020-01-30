const tmp = require("tmp");
const path = require("path");
const fs = require("fs");
const toml = require("@iarna/toml");

const {
  CONFIGFILE_NAME,
  getPackageConfig,
  writePackageConfig
} = require("../index");

test("Import config file", () => {
  const config = getPackageConfig(path.join(__dirname, "clio.test.toml"));
  expect(config.title).toBeDefined();
});

test("Write config file", () => {
  const config = {
    title: "test",
    dependencies: [{ name: "Foo", version: "1.2.3" }]
  };

  const tmpDir = tmp.dirSync();
  const filePath = tmpDir.name;

  writePackageConfig(config, filePath);

  const file = fs.readFileSync(path.join(filePath, CONFIGFILE_NAME));
  const contents = toml.parse(file.toString());
  expect(contents.title).toBe("test");
  expect(contents.dependencies).toEqual({ Foo: "1.2.3" });
  tmpDir.removeCallback();
});

test("Toml contains npm_dependencies", () => {
  const config = getPackageConfig(path.join(__dirname, "clio.test.toml"));

  expect(config.npm_dependencies).toContainEqual({
    name: "rickroll",
    version: "latest"
  });
});

test("Toml contains builds and targets", () => {
  const config = getPackageConfig(path.join(__dirname, "clio.test.toml"));
  expect(config.build).toBeDefined();
  expect(config.build.target).toBeDefined();
  expect(config.build.directory).toBeDefined();

  expect(config.target).toBeDefined();
  expect(config.target.node).toBeDefined();
  expect(config.target.node.directory).toBeDefined();

  expect(config.target.node).toBeDefined();
  expect(config.target["browser"].directory).toBeDefined();
});
