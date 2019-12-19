const fs = require("fs");
const { run } = require("../lib/process");
const packageConfig = require("../../package/packageConfig");
const { getDependencies } = require("../../internals/deps");

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
    const command = process.platform === "win32" ? "where" : "whereis";
    await run(`${command} git`);
  } catch (e) {
    console.error("Git is required to create a new Clio project. Exiting.");
    process.exit(1);
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
    author: {
      name: "",
      email: "",
      website: ""
    },
    scripts: { test: "No tests specified" },
    dependencies: [{ name: "stdlib", version: "latest" }]
  };

  packageConfig.writePackageConfig(defaultConfig);

  await getDependencies();
  console.log("Added Clio dependencies");

  try {
    fs.writeFileSync("index.clio", "'Hello World' -> print\n");
    fs.writeFileSync(".gitignore", ".clio-cache\nclio_env\n");

    await run("git init && git add -A && git commit -m 'Initial Commit'");
    console.log("Initialized new git repository.");
  } catch (e) {
    console.error(e);
    process.exit(1);
  }

  console.log("Initialization Complete!");
  console.log(`Run 'cd ${packageName}' to open, then 'clio run index.clio' to run the project!`);
}

exports.createPackage = createPackage;
