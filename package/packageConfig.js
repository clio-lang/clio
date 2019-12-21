const path = require("path");
const fs = require("fs");
const toml = require("@iarna/toml");

const configFileName = "clio.toml";

/**
 *
 * @param {string} filepath Optional name of file containing the configurations for the clio package in format `foo.toml`.
 */
function getPackageConfig(filepath = path.join(process.cwd(), configFileName)) {
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
    // eslint-disable-next-line camelcase
    git_repository: packageConfig.git_repository,
    documentation: packageConfig.documentation,

    scripts: packageConfig.scripts,
    dependencies: Object.entries(packageConfig.dependencies).map(dep => {
      return { name: dep[0], version: dep[1] };
    })
  };
}

function writePackageConfig(cfg, directory = process.cwd()) {
  const deps = {};
  cfg.dependencies.forEach(dep => (deps[dep.name] = dep.version));
  const cfgStr = toml.stringify({ ...cfg, dependencies: deps });
  const filePath = path.join(directory, configFileName);
  fs.writeFileSync(filePath, cfgStr);
}

/**
 *
 * @param {string[]} dep
 */
function addDependency(dep) {
  const config = getPackageConfig();
  const depName = dep[0];
  const depVersion = dep[1];
  config.dependencies.push({ name: depName, version: depVersion });
  writePackageConfig(config);
}

/**
 * @returns {{name, version}}
 */
function getPackageDependencies() {
  const config = getPackageConfig();
  return config.dependencies;
}

module.exports = {
  getPackageConfig,
  writePackageConfig: writePackageConfig,
  addDependency,
  getPackageDependencies,
  configFileName
};
