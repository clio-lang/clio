const fs = require("fs");

/**
 * Get user's current working directory
 */
const cwd = process.cwd();
const packageJson = require(`${cwd}/package.json`);
const dependencies = packageJson.clioDependencies;

/**
 * @method getClioDependencies
 * @returns {string[]}
 * @description Get Clio dependencies listed in the
 *              Packge.json file.
 */

function getClioDependencies() {
  return hasClioDependencies() 
         ? dependencies 
         : []
}

/**
 * @method hasClioDependencies
 * @returns {bool}
 * @description Returns true if the project has at least one dependency listed
 *              in the Package.json file.
 */

function hasClioDependencies() {
  return !!dependencies 
      && !!Object.keys(dependencies)
      && !!Object.keys(dependencies).length 
}

/**
 * @method addDependency
 * @param {string} dependency
 * @returns {string[]|object}
 * @description Adds a dependency to the list of dependencies (if any).
 *              If no dependencies are listed, it will create the "clioDependencies"
 *              object and adds the first dependency. 
 */

function addDependency(dependency) {
  return hasClioDependencies()
         ? [...dependencies, dependency]
         : new Object({
           clioDependencies: [dependency]
         })
}

/**
 * @method updatePackageJsonDependencies
 * @param {string} dependency
 * @returns {Promise}
 * @description updates Package.json file with the desidered dependency.
 */

function updatePackageJsonDependencies(dependency) {
  return new Promise((resolve, reject) => {
    
    // Ugly way to clone object by values and not by reference
    const oldPackage = JSON.parse(JSON.stringify(packageJson));
    const newPackage = Object.assign(oldPackage, addDependency(dependency));
    const formatJson = JSON.stringify(newPackage, null, 2);

    fs.writeFile(`${cwd}/package.json`, formatJson, (err) => {
      return err 
           ? reject(err)
           : resolve()
    })

  })
}

module.exports = {
  addDependency,
  getClioDependencies,
  hasClioDependencies,
  updatePackageJsonDependencies,
  packageJson
}