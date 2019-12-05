const fs = require("fs");
const childProcess = require("child_process");
const path = require("path");

function createPackage(packageName) {
  const cwd = process.cwd();
  const dir = path.join(cwd, packageName);
  fs.mkdir(dir, () => {
    childProcess.execSync(
      `pushd ${packageName}` + ` && npm init -y` + ` && popd`
    );
    console.log("Initialized npm module");

    const pkg = require(path.join(dir, "package.json"));
    if (!pkg.clioDependencies) {
      pkg.clioDependencies = ["stdlib"];
    } else if (!pkg.clioDependencies.includes("stdlib")) {
      pkg.clioDependencies.push("stdlib");
    }
    const stringified = JSON.stringify(pkg, null, 2);
    fs.writeFileSync(path.join(dir, "package.json"), stringified, "utf8");
    console.log("Added Clio dependencies");

    childProcess.execSync(
      `pushd ${packageName}` +
        ` && git init && git add -A && git commit -m "Initial Commit" && popd`
    );
  });
}

module.exports = createPackage;
