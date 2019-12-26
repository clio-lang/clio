const packageConfig = require("../../package/packageConfig");

/**
 * @method hasClioDependencies
 * @returns {bool}
 * @description Returns true if the project has at least one dependency listed
 *              in the Package.json file.
 */

function hasClioDependencies() {
  const dependencies = packageConfig.getPackageDependencies();
  return (
    !!dependencies &&
    !!Object.keys(dependencies) &&
    !!Object.keys(dependencies).length
  );
}

module.exports = {
  hasClioDependencies
};
