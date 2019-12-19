#!/usr/bin/env node

global.fetch = require("node-fetch"); // fetch is not implemented in node (yet)
global.WebSocket = require("websocket").w3cwebsocket; // same for WebSocket

const nodeFullVersion = process.versions.node.split(".");
const nodeMajorVersion = Number(nodeFullVersion[0]);
const nodeMinorVersion = Number(nodeFullVersion[1]);

if (nodeMajorVersion < 10 && nodeMinorVersion < 4) {
  console.warn(
    "You're using a version of node that Clio does not support. This might cause problems. Please update node to the latest version."
  );
}
require("yargs")
  .commandDir("commands")
  .help()
  .alias("h", "help")
  .demandCommand(1, "must provide a valid command")
  .completion().argv;
