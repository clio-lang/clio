#!/usr/bin/env node

const chalk = require("chalk");
const { isSupportedNodeVersion } = require("clio-utils");

if (!isSupportedNodeVersion(process.versions.node)) {
  chalk.yellow(
    "Warning: your Node version is outdated. This might cause problems. Please, upgrade Node to version 14.0 or higher."
  );
}

require("yargs")
  .commandDir("commands")
  .help()
  .alias("h", "help")
  .demandCommand(1, "must provide a valid command")
  .completion().argv;
