const path = require("path");
const fs = require("fs");
const toml = require("@iarna/toml");
const { get } = require("../internals/get/clio-get");

const configFileName = "clio.toml";

/**
 *
 * @param {string} filepath Optional name of file containing the configurations for the clio package in format `foo.toml`.
 */
function getPackageConfig(filepath = path.join(process.cwd(), configFileName)) {
  const file = fs.readFileSync(filepath);
  const config = toml.parse(file);

  return {
    title: config.title,
    description: config.description,
    version: config.version,
    license: config.license,
    main: config.main,
    authors: config.authors,
    keywords: config.keywords,
    // eslint-disable-next-line camelcase
    git_repository: config.git_repository,
    documentation: config.documentation,

    scripts: config.scripts,
    dependencies: Object.entries(config.dependencies).map(dep => {
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
async function addDependency(dep) {
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

/**
 * @method hasClioDependencies
 * @returns {bool}
 * @description Returns true if the project has at least one dependency listed
 *              in the Package.json file.
 */

function hasClioDependencies() {
  const dependencies = getPackageDependencies();
  return !!dependencies && !!Object.keys(dependencies).length;
}

/**
 * @method fetchDependencies
 * @returns {void}
 * @description Installs every dependency listed in
 *              package.json
 */

function fetchDependencies() {
  if (!hasClioDependencies()) {
    console.log("No dependencies found in package.json");
    return;
  }

  return Promise.all(
    getPackageDependencies().map(dep => get({ url: dep.name }))
  );
}

module.exports = {
  getPackageConfig,
  writePackageConfig: writePackageConfig,
  addDependency,
  getPackageDependencies: getPackageDependencies,
  configFileName,
  hasClioDependencies,
  fetchDependencies
};
