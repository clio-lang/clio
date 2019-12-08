const shell = require("shelljs");
const packageConfig = require("../package/packageConfig");
const { getDependencies } = require("../internals/deps");

function createPackage(packageName) {
  if (!shell.which("git")) {
    shell.echo("Sorry, this script requires git");
    shell.exit(1);
  }

  shell.mkdir(packageName);
  shell.cd(packageName);

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

  getDependencies();
  console.log("Added Clio dependencies");

  shell.exec(`echo "'Hello World' -> print" > index.clio`);

  shell.exec("git init && git add -A && git commit -m 'Initial Commit'");
  shell.echo("\nInitialization Complete!");
  shell.echo(
    `Run 'cd ${packageName}' to open, then 'clio run index.clio' to run the project!`
  );
}

module.exports = createPackage;
