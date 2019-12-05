const fs = require("fs");
const childProcess = require("child_process");
const path = require("path");
const shell = require("shelljs");
const { getDependencies } = require("../internals/deps");

function createPackage(packageName) {
  if (!shell.which("git")) {
    shell.echo("Sorry, this script requires git");
    shell.exit(1);
  }
  const cwd = process.cwd();
  const dir = path.join(cwd, packageName);

  shell.mkdir(packageName);
  shell.cd(packageName);
  shell.exec("npm init -y");

  const pkg = require(path.join(dir, "package.json"));
  if (!pkg.clioDependencies) {
    pkg.clioDependencies = ["stdlib"];
    delete pkg.main;
    pkg.entry = "index.clio";
    pkg.version = "0.1.0";
    delete pkg.scripts;
  } else if (!pkg.clioDependencies.includes("stdlib")) {
    pkg.clioDependencies.push("stdlib");
  }
  const stringified = JSON.stringify(pkg, null, 2);
  fs.writeFileSync(path.join(dir, "package.json"), stringified, "utf8");
  console.log("Added Clio dependencies");

  getDependencies();

  shell.exec("git init && git add -A && git commit -m 'Initial Commit'");
}

module.exports = createPackage;
