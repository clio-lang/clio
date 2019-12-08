const package_config = require("../../package/package_config");

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
    package_config.addDependency([dependency, "latest"]);
    resolve();
  });
}

module.exports = {
  getClioDependencies,
  hasClioDependencies,
  updatePackageJsonDependencies
};
