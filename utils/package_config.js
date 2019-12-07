const path = require("path");
const fs = require("fs");
const toml = require("@iarna/toml");

const configFileName = "cliopgk.toml";

/**
 *
 * @param {string} filename Optional name of file containing the configurations for the clio package in format `foo.toml`.
 */
function get_package_config(filename = configFileName) {
  const file = fs.readFileSync(path.join(__dirname, filename));
  const packageConfig = toml.parse(file);

  return {
    title: packageConfig.title,
    description: packageConfig.description,
    version: packageConfig.version,
    license: packageConfig.license,
    main: packageConfig.main,
    author: {
      name: packageConfig.author.name,
      email: packageConfig.author.email,
      website: packageConfig.author.website
    },
    scripts: packageConfig.scripts,
    dependencies: packageConfig.dependencies
  };
}

function write_package_config(cfg, filePath = configFileName) {
  const cfgStr = toml.stringify(cfg);
  fs.writeFileSync(filePath, cfgStr);
}

module.exports = {
  get_package_config,
  write_package_config,
  configFileName
};
