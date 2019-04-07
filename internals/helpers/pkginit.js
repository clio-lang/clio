const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { getDependencies } = require("../deps");

/**
 * @method initPackage
 * @param void
 * @returns {Promise}
 * @description creates new Package.json file and installs it.
 */

async function initPackage() {
  const cwd = process.cwd();
  const dir = path.basename(cwd);

  if (fs.existsSync(path.join(cwd, "package.json"))) {
    var pkg = require(path.join(cwd, "package.json"));
    if (!pkg.clioDependencies) {
      pkg.clioDependencies = ["stdlib"];
    } else if (!pkg.clioDependencies.includes("stdlib")) {
      pkg.clioDependencies.push("stdlib");
    }
    const stringified = JSON.stringify(pkg, null, 2);
    return fs.writeFile(
      path.join(cwd, "package.json"),
      stringified,
      "utf8",
      getDependencies
    );
  }

  const r_interface = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  async function ask(message) {
    return new Promise(function(resolve, reject) {
      r_interface.question(message, resolve);
    });
  }

  var pkg = {};
  pkg.name = (await ask(`Package name: (${dir}) `)) || dir;
  pkg.version = (await ask("Version: (1.0.0) ")) || "1.0.0";
  pkg.description = (await ask("Description: ")) || "";
  pkg.entry = (await ask("Entry point: (index.clio) ")) || "index.clio";
  pkg.test =
    (await ask("Test command: ")) ||
    'echo "Error: no test specified" && exit 1';
  pkg.git = (await ask("Git repository: ")) || "";
  pkg.keywords = (await ask("Keywords: ")) || "";
  pkg.author = (await ask("Author: ")) || "";
  pkg.license = (await ask("License: (ISC) ")) || "ISC";
  pkg.clioDependencies = ["stdlib"];

  const stringified = JSON.stringify(pkg, null, 2);
  console.log(`\n${stringified}\n`);
  const ok =
    ((await ask("Is this ok? (yes) ")) || "yes") == "yes" ? true : false;
  process.stdin.destroy();
  if (ok) {
    return fs.writeFile(
      path.join(cwd, "package.json"),
      stringified,
      "utf8",
      getDependencies
    );
  } else {
    return initPackage();
  }
}

module.exports = {
  initPackage
};
