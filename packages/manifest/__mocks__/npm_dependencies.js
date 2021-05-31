const fs = require("fs");
const path = require("path");
const { getPackageConfig } = require("../packageConfig");

const fetchNpmDependencies = jest
  .fn()
  .mockImplementation(async (destination) => {
    console.log("Getting mock NPM dependencies...");
    const fakeModulePath = path.join(destination, "node_modules", "rickroll");
    await fs.promises.mkdir(fakeModulePath, { recursive: true });
    return fs.promises.writeFile(
      path.join(fakeModulePath, "rickroll.js"),
      "console.log()",
      {}
    );
  });

function hasInstalledNpmDependencies(destination) {
  return fs.existsSync(path.join(destination, "package-lock.json"));
}

function getParsedNpmDependencies(configPath) {
  const dependencies = {};
  const npmDependencies = getPackageConfig(configPath).npm.dependencies;
  if (npmDependencies) {
    npmDependencies.forEach((dep) => {
      dependencies[dep.name] = dep.version;
    });
  }
  return dependencies;
}

function getParsedNpmDevDependencies(configPath) {
  const dependencies = {};
  const npmDevDependencies = getPackageConfig(configPath).npm.devDependencies;
  if (npmDevDependencies) {
    npmDevDependencies.forEach((dep) => {
      dependencies[dep.name] = dep.version;
    });
  }
  return dependencies;
}

module.exports = {
  fetchNpmDependencies,
  hasInstalledNpmDependencies,
  getParsedNpmDependencies,
  getParsedNpmDevDependencies,
};
