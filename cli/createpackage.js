const fs = require("fs");
const childProcess = require("child_process");
const path = require("path");

function createPackage(packageName) {
  const cwd = process.cwd();
  const dir = path.join(cwd, packageName);
  fs.mkdir(dir, () => {
    exec(`pushd ${packageName}` + ` && npm init -y` + ` && popd`, () => {
      const pkg = require(path.join(dir, "package.json"));
      if (!pkg.clioDependencies) {
        pkg.clioDependencies = ["stdlib"];
      } else if (!pkg.clioDependencies.includes("stdlib")) {
        pkg.clioDependencies.push("stdlib");
      }
      const stringified = JSON.stringify(pkg, null, 2);
      return fs.writeFile(
        path.join(dir, "package.json"),
        stringified,
        "utf8",
        err => {
          if (err) {
            console.error(err);
          }
          console.log("Added Clio dependency");
        }
      );
    });
  });
}

const exec = (command, callback) => {
  const process = childProcess.exec(command);

  process.stdout.on("data", data => {
    console.log(data.toString());
  });

  process.stderr.on("data", data => {
    console.error(data.toString());
  });

  process.on("exit", code => {
    console.log("npm module initialized");
    callback();
  });
};

module.exports = createPackage;
