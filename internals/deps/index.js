const packageConfig = require("../../package/packageConfig");

const { get } = require("../get/clio-get");

/**
 * @method getDependencies
 * @returns {void}
 * @description Installs every dependency listed in
 *              package.json
 */

function getDependencies() {
  if (!packageConfig.hasClioDependencies()) {
    console.log("No dependencies found in package.json");
    return;
  }

  return Promise.all(
    packageConfig.getPackageDependencies().map(dep => get({ url: dep.name }))
  );
}

module.exports = {
  showDependencies,
  getDependencies
};
