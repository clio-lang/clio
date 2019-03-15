const { 
        getClioDependencies
      , hasClioDependencies 
  } = require("../helpers/package");

/**
 * @method showDependencies
 * @returns {void}
 * @description Prints to the stdout the list of
 *              dependencies listed in package.json
 */
function showDependencies() {
  if (hasClioDependencies()) {
    const deps = getClioDependencies();
    const formattedDeps = deps.map((dep) => `~> ${dep}`)
                              .join('\n');
    console.log(formattedDeps);
  } else {
    console.log("No dependencies found in package.json");
  }
}

module.exports = {
  showDependencies
}