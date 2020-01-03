const { spawn } = require("child_process");

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
};
