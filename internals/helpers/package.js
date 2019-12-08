const fs = require("fs");
const package_config = require("../../package/package_config");

var packageJson, dependencies;

function getPackage() {
  /**
   * Get user's current working directory
   */
  const cwd = process.cwd();
  try {
    packageJson = require(`${cwd}/package.json`);
  } catch (e) {
    packageJson = { clioDependencies: [] };
  }
  dependencies = packageJson.clioDependencies;
}

/**
 * @method getClioDependencies
 * @returns {string[]}
 * @description Get Clio dependencies listed in the
 *              Packge.json file.
 */

function getClioDependencies() {
  return package_config.getPackageDependencies();
}

/**
 * @method hasClioDependencies
 * @returns {bool}
 * @description Returns true if the project has at least one dependency listed
 *              in the Package.json file.
 */

function hasClioDependencies() {
  const dependencies = package_config.getPackageDependencies();
  console.trace(dependencies);
  return (
    !!dependencies &&
    !!Object.keys(dependencies) &&
    !!Object.keys(dependencies).length
  );
}

/**
 * @method updatePackageJsonDependencies
 * @param {string} dependency
 * @returns {Promise}
 * @description updates Package.json file with the desidered dependency.
 */

function updatePackageJsonDependencies(dependency) {
  return new Promise((resolve, reject) => {
    console.log("Dep:", dependency);
    package_config.addDependency([dependency, "latest"]);
    resolve();
  });
}

module.exports = {
  getClioDependencies,
  hasClioDependencies,
  updatePackageJsonDependencies,
  packageJson
};
