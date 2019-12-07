const package_config = require("../package_config");

test("Import config file", () => {
  const config = package_config.get_package_config(
    "__tests__/cliopkg.test.toml"
  );
  expect(config.title).toBeDefined();
});
