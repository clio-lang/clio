#!/usr/bin/env node

const chalk = require("chalk");
const { isSupportedNodeVersion } = require("clio-utils");

if (!isSupportedNodeVersion(process.versions.node)) {
  chalk.yellow(
    "Warning: your Node version is outdated. This might cause problems. Please, upgrade Node to version 14.0 or higher."
  );
}

const command = (cmd) => ({
  include: new RegExp(`${cmd}.js`),
});

require("yargs")
  .commandDir("commands", command("build"))
  .commandDir("commands", command("run"))
  .commandDir("commands", command("host"))
  .commandDir("commands", command("new"))
  .commandDir("commands", command("deps"))
  .commandDir("commands", command("docs"))
  .commandDir("commands", command("highligh"))
  .help()
  .alias("h", "help")
  .demandCommand(1, "must provide a valid command")
  .completion().argv;
