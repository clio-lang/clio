const fs = require("fs");
const childProcess = require("child_process");
const path = require("path");
function createPackage(packageName) {
  fs.mkdir(path.join(process.cwd(), packageName), () => {
    exec(`pushd ${packageName}` + ` && npm init -y` + ` && popd`);
  });
}

const exec = command => {
  const process = childProcess.exec(command);

  process.stdout.on("data", data => {
    console.log(data.toString());
  });

  process.stderr.on("data", data => {
    console.error(data.toString());
  });

  process.on("exit", code => {
    console.log("Exited with code " + code.toString());
  });
};

module.exports = createPackage;
