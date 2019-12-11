const path = require("path");
const fs = require("fs");
const readline = require("readline");
const { getDependencies } = require("../../internals/deps");
const { writePackageConfig } = require("../../package/packageConfig");

exports.command = "init [args]";
exports.desc = "Generate a cliopkg.toml file and fetch stdlib";
exports.builder = {
  y: {
    type: "boolean",
    default: "false"
  }
};
exports.handler = function(argv) {
  initPackage(argv.y, path.dirname(process.cwd()));
};

async function initPackage(skipPrompt = false, packageName) {
  const cwd = process.cwd();
  const dir = path.basename(cwd);

  if (fs.existsSync(path.join(cwd, "package.json"))) {
    const pkg = require(path.join(cwd, "package.json"));
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

  let pkg = {};
  let ok = false;

  if (skipPrompt) {
    ok = true;
    pkg = {
      title: packageName,
      description: "",
      version: "0.1.0",
      license: "ISC",
      main: "index.clio",
      keywords: "",
      author: {
        name: "",
        email: "",
        website: ""
      },
      scripts: { test: "No tests specified" },
      dependencies: [{ name: "stdlib", version: "latest" }]
    };
  } else {
    const rInterface = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const ask = async message => {
      return new Promise(function(resolve) {
        rInterface.question(message, resolve);
      });
    };

    pkg.title = (await ask(`Package name: (${dir}) `)) || dir;
    pkg.version = (await ask("Version: (1.0.0) ")) || "1.0.0";
    pkg.description = (await ask("Description: ")) || "";
    pkg.main = (await ask("Entry point: (index.clio) ")) || "index.clio";
    pkg.git = (await ask("Git repository: ")) || "";
    pkg.keywords = (await ask("Keywords: ")) || "";
    pkg.author = {};
    pkg.author.name = (await ask("Author name: ")) || "";
    pkg.author.email = (await ask("Author email: ")) || "";
    pkg.license = (await ask("License: (ISC) ")) || "ISC";
    pkg.dependencies = [{ name: "stdlib", version: "latest" }];
    pkg.scripts = {
      test:
        (await ask("Test command: ")) ||
        'echo "Error: no test specified" && exit 1'
    };
    const stringified = JSON.stringify(pkg, null, 2);
    console.log(`\n${stringified}\n`);
    ok = ((await ask("Is this ok? (yes) ")) || "yes") == "yes" ? true : false;
  }

  process.stdin.destroy();
  if (ok) {
    writePackageConfig(pkg);
    getDependencies();
  } else {
    return initPackage(false, packageName);
  }
}
