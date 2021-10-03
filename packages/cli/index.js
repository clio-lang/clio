#!/usr/bin/env node

import build from "./commands/build.js";
import chalk from "chalk";
import deps from "./commands/deps.js";
import docs from "./commands/docs.js";
import { hideBin } from "yargs/helpers";
import highlight from "./commands/highlight.js";
import host from "./commands/host.js";
import { isSupportedNodeVersion } from "clio-utils";
import newc from "./commands/new.js";
import run from "./commands/run.js";
import yargs from "yargs";

const { yellow } = chalk;

if (!isSupportedNodeVersion(process.versions.node)) {
  yellow(
    "Warning: your Node version is outdated. This might cause problems. Please, upgrade Node to version 14.0 or higher."
  );
}

yargs(hideBin(process.argv))
  .command(newc)
  .command(build)
  .command(run)
  .command(host)
  .command(deps)
  .command(docs)
  .command(highlight)
  .help()
  .alias("h", "help")
  .demandCommand(1, "must provide a valid command")
  .completion().argv;
