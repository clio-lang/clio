const fs = require("fs");
const { spawnSync } = require("child_process");
const packageConfig = require("../../package/packageConfig");
const { getDependencies } = require("../../internals/deps");
const { error, info, success } = require("../lib/colors");

exports.command = "new <project>";
exports.desc = "Create a new Clio project";
exports.builder = {
  project: {
    describe: "name of the project",
    type: "string"
  }
};
exports.handler = function(argv) {
  createPackage(argv.project);
};

async function createPackage(packageName) {
  try {
    if (!packageName) {
      throw new Error("A project name is required.");
    }
    const result = spawnSync("git");
    if (result.error) {
      throw new Error("Git is required to create a new Clio project.");
    }

    if (!fs.existsSync(packageName)) {
      fs.mkdirSync(packageName);
    }
    process.chdir(packageName);

    const defaultConfig = {
      title: packageName,
      description: "",
      version: "0.1.0",
      license: "ISC",
      main: "index.clio",
      keywords: "",
      authors: ["Your Name <you@example.com>"],
      scripts: { test: "No tests specified" },
      dependencies: [{ name: "stdlib", version: "latest" }]
    };

    packageConfig.writePackageConfig(defaultConfig);

    await getDependencies();
    info("Added Clio dependencies");

    fs.writeFileSync("index.clio", "'Hello World' -> print\n");
    fs.writeFileSync(".gitignore", ".clio-cache\nclio_env\n");

    spawnSync("git", ["init"]);
    spawnSync("git", ["add", "-A"]);
    spawnSync("git", ["commit", "-m", "Initial Commit"]);
    info("Initialized new git repository.");

    info("Initialization Complete!");
    success(
      `Run 'cd ${packageName}' to open, then 'clio run index.clio' to run the project!`
    );
  } catch (e) {
    error(e);
    process.exit(1);
  }
}

exports.createPackage = createPackage;
