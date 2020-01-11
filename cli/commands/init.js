const path = require("path");
const fs = require("fs");
const readline = require("readline");

const {
  CONFIGFILE_NAME,
  fetchDependencies,
  writePackageConfig,
  registryId
} = require("../../package/index");

exports.command = "init [args]";
exports.desc = `Generate a ${CONFIGFILE_NAME} file and fetch stdlib`;
exports.builder = {
  y: {
    type: "boolean",
    default: "false"
  }
};
exports.handler = function(argv) {
  initPackage(argv.y, path.dirname(process.cwd()));
};

async function initPackage(
  skipPrompt = false,
  packageName,
  directory = process.cwd()
) {
  const directoryName = path.basename(directory);
  const stdlibId = registryId("stdlib");
  
  if (fs.existsSync(path.join(directory, "package.json"))) {
    const pkg = require(path.join(directory, "package.json"));
    if (!pkg.clioDependencies) {
      pkg.clioDependencies = [stdlibId];
    } else if (!pkg.clioDependencies.includes(stdlibId)) {
      pkg.clioDependencies.push(stdlibId);
    }
    const stringified = JSON.stringify(pkg, null, 2);
    return fs.writeFileSync(
      path.join(directory, "package.json"),
      stringified,
      "utf8",
      fetchDependencies
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
      dependencies: [{ name: stdlibId, version: "latest" }]
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

    pkg.title =
      (await ask(`Package name: (${directoryName}) `)) || directoryName;
    pkg.version = (await ask("Version: (1.0.0) ")) || "1.0.0";
    pkg.description = (await ask("Description: ")) || "";
    pkg.main = (await ask("Entry point: (index.clio) ")) || "index.clio";
    pkg.git = (await ask("Git repository: ")) || "";
    pkg.keywords = (await ask("Keywords: ")) || "";
    pkg.author = {};
    pkg.author.name = (await ask("Author name: ")) || "";
    pkg.author.email = (await ask("Author email: ")) || "";
    pkg.license = (await ask("License: (ISC) ")) || "ISC";
    pkg.dependencies = [{ name: stdlibId, version: "latest" }];
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
    writePackageConfig(pkg, directory);
    process.chdir(directory);
    await fetchDependencies();
  } else {
    await initPackage(false, packageName);
  }
}

exports.initPackage = initPackage;
