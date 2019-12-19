const { hasClioDependencies } = require("../helpers/package");
const packageConfig = require("../../package/packageConfig");

const { get } = require("../get/clio-get");

/**
 * @method showDependencies
 * @returns {void}
 * @description Prints to the stdout the list of
 *              dependencies listed in package.json
 */

function showDependencies() {
  if (!hasClioDependencies()) {
    console.log("No dependencies found in package.json");
    return;
  }

  const deps = packageConfig.getPackageDependencies();
  const formattedDeps = deps
    .map(dep => `~> ${dep["name"]}: ${dep["version"]}`)
    .join("\n");
  console.log(formattedDeps);
}

/**
 * @method getDependencies
 * @returns {void}
 * @description Installs every dependency listed in
 *              package.json
 */

function getDependencies() {
  if (!hasClioDependencies()) {
    console.log("No dependencies found in package.json");
    return;
  }

  return Promise.all(packageConfig.getPackageDependencies().map(dep => get({ url: dep.name })));
}

module.exports = {
  showDependencies,
  getDependencies
};
