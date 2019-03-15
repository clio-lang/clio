const { 
        getClioDependencies
      , hasClioDependencies 
  } = require("../helpers/package");

const { get } = require('../get/clio-get')

/**
 * @method showDependencies
 * @returns {void}
 * @description Prints to the stdout the list of
 *              dependencies listed in package.json
 */

function showDependencies() {
  if (!hasClioDependencies()) { 
    console.log("No dependencies found in package.json");
    return
  }

  const deps = getClioDependencies();
  const formattedDeps = deps
                          .map((dep) => `~> ${dep}`)
                          .join('\n');
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
    return
  }

  for (const dep of getClioDependencies()) {
    get({ url: dep })
  }
}

module.exports = {
  showDependencies,
  getDependencies
}