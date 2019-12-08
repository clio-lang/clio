const path = require("path");
const fs = require("fs");
const toml = require("@iarna/toml");

const configFileName = "cliopgk.toml";

/**
 *
 * @param {string} filepath Optional name of file containing the configurations for the clio package in format `foo.toml`.
 */
function get_package_config(
  filepath = path.join(process.cwd(), configFileName)
) {
  const file = fs.readFileSync(filepath);
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
    keywords: packageConfig.keywords,
    git_repository: packageConfig.git_repository,
    documentation: packageConfig.documentation,

    scripts: packageConfig.scripts,
    dependencies: packageConfig.dependencies
  };
}

function write_package_config(
  cfg,
  filePath = path.join(process.cwd(), configFileName)
) {
  const cfgStr = toml.stringify(cfg);
  fs.writeFileSync(filePath, cfgStr);
}

module.exports = {
  get_package_config,
  write_package_config,
  configFileName
};
