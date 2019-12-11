#!/usr/bin/env node

global.fetch = require("node-fetch"); // fetch is not implemented in node (yet)
global.WebSocket = require("websocket").w3cwebsocket; // same for WebSocket

require("yargs")
  .commandDir("commands")
  .demandCommand(1, "must provide a valid command")
  .completion().argv;
