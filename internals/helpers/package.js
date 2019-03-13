const fs = require("fs");
const package = require("../../package.json");
const dependencies = package.clioDependencies;

/**
 * Check if user has already installed some dependencies
 */

function hasClioDependencies() {
  return !!dependencies 
      && !!Object.keys(dependencies)
      && !!Object.keys(dependencies).length 
}

function addDependency(dependency) {
  return hasClioDependencies()
         ? [...dependencies, dependency]
         : new Object({
           clioDependencies: [dependency]
         })
}

function updatePackageJsonDependencies(dependency) {
  return new Promise((resolve, reject) => {
    
    // Ugly way to clone object by values and not by reference
    const oldPackage = JSON.parse(JSON.stringify(package));
    const newPackage = Object.assign(oldPackage, addDependency(dependency));
    const formatJson = JSON.stringify(newPackage, null, 2);

    fs.writeFile("../../package.json", formatJson, (err) => {
      return err 
           ? reject(err)
           : resolve()
    })

  })
}

module.exports = {
  hasClioDependencies,
  addDependency,
  updatePackageJsonDependencies
}