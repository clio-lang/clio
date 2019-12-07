const tmp = require("tmp");
const path = require("path");
const fs = require("fs");
const toml = require("@iarna/toml");
const package_config = require("../package_config");

test("Import config file", () => {
  const config = package_config.get_package_config(
    "__tests__/cliopkg.test.toml"
  );
  expect(config.title).toBeDefined();
});

test("Write config file", () => {
  const config = {
    title: "test",
    dependencies: [{ foo: "1.2.3" }]
  };

  const tmpDir = tmp.dirSync();
  const filePath = path.join(tmpDir.name, package_config.configFileName);

  package_config.write_package_config(config, filePath);

  const file = fs.readFileSync(filePath);
  const contents = toml.parse(file.toString());
  expect(contents.title).toBe("test");
  expect(contents.dependencies).toEqual([{ foo: "1.2.3" }]);
});
