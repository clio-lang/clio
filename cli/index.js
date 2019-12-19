#!/usr/bin/env node

const { isSupportedNodeVersion } = require("../utils/versionUtils");

global.fetch = require("node-fetch"); // fetch is not implemented in node (yet)
global.WebSocket = require("websocket").w3cwebsocket; // same for WebSocket

if (!isSupportedNodeVersion(process.versions.node)) {
  console.warn(
    "Warning: your Node version is outdated. This might cause problems. Please, upgrade Node to version 10.4 or higher."
  );
}

require("yargs")
  .commandDir("commands")
  .help()
  .alias("h", "help")
  .demandCommand(1, "must provide a valid command")
  .completion().argv;
