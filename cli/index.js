#!/usr/bin/env node

const chalk = require("chalk");

// TODO: How to link lerna with unpublished package?
const { isSupportedNodeVersion } = require("../packages/utils");

if (!isSupportedNodeVersion(process.versions.node)) {
  chalk.yellow(
    "Warning: your Node version is outdated. This might cause problems. Please, upgrade Node to version 10.4 or higher."
  );
}

require("yargs")
  .commandDir("commands")
  .help()
  .alias("h", "help")
  .demandCommand(1, "must provide a valid command")
  .completion().argv;
