const fs = require("fs");
const path = require("path");
const { getPackageConfig, CONFIGFILE_NAME } = require("../packageConfig");

const fetchNpmDependencies = jest.fn().mockImplementation(async destination => {
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

function getParsedNpmDependencies(source) {
  const dependencies = {};
  const npmDependencies = getPackageConfig(path.join(source, CONFIGFILE_NAME))
    .npm_dependencies;
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
