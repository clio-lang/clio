const { hasClioDependencies } = require("../helpers/package");
const package_config = require("../../package/package_config");

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

  const deps = package_config.getPackageDependencies();
  const formattedDeps = deps
    .map(dep => `~> ${dep[name]}: ${dep[version]}`)
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

  for (const dep of package_config.getPackageDependencies()) {
    get({ url: dep.name });
  }
}

module.exports = {
  showDependencies,
  getDependencies
};
