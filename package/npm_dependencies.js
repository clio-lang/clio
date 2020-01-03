const { spawn } = require("child_process");

// FIXME seems unused?
// const { getPackageConfig } = require("./packageConfig");
// function getNpmDependencies() {
//   return getPackageConfig().npm_dependencies;
// }

function fetchNpmDependencies(destination) {
  process.chdir(destination);
  return new Promise((resolve, reject) => {
    const install = spawn("npm", ["install"]);
    install.on("close", resolve);
    install.on("error", reject);
  });
}

module.exports = {
  fetchNpmDependencies
  // getNpmDependencies
};
