const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

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

module.exports = {
  fetchNpmDependencies,
  hasInstalledNpmDependencies
};
