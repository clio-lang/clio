const fs = require("fs");
const path = require("path");
const shell = require("shelljs");
const packageConfig = require("../utils/package_config");
const { getDependencies } = require("../internals/deps");

function createPackage(packageName) {
  if (!shell.which("git")) {
    shell.echo("Sorry, this script requires git");
    shell.exit(1);
  }

  shell.mkdir(packageName);
  shell.cd(packageName);

  const config = {
    title: packageName,
    description: "Package Title",
    version: "0.1.0",
    license: "ISC",
    main: "index.clio",
    author: {
      name: "Your Name Here",
      email: "Your Email Here",
      website: "Your Website Here"
    },
    scripts: [{ test: "No tests specified" }],
    dependencies: [{ stdlib: "latest" }]
  };

  packageConfig.write_package_config(config);

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
