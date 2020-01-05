const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { getPackageConfig, CONFIGFILE_NAME } = require('./packageConfig');

function fetchNpmDependencies(destination) {
  process.chdir(destination);
  return new Promise((resolve, reject) => {
    const install = spawn("npm", ["install"]);
    install.on("close", resolve);
    install.on("error", reject);
  });
}

function hasInstalledNpmDependencies(destination) {
  return fs.existsSync(path.join(destination, "package-lock.json"));
}

function getParsedNpmDependencies(source) {
  const dependencies = {};
  const npmDependencies = getPackageConfig(path.join(source, CONFIGFILE_NAME)).npm_dependencies;
  if (npmDependencies) {
    npmDependencies.forEach(dep => {
      dependencies[dep.name] = dep.version;
    });
  }
  return dependencies;
}

module.exports = {
  fetchNpmDependencies,
  hasInstalledNpmDependencies,
  getParsedNpmDependencies
};
