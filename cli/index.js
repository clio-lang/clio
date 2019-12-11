#!/usr/bin/env node

global.fetch = require("node-fetch"); // fetch is not implemented in node (yet)
global.WebSocket = require("websocket").w3cwebsocket; // same for WebSocket

require("yargs")
  .commandDir("commands")
  .command(
    "get <url>",
    "Download and install a Clio module",
    yargs => {
      yargs.positional("source", {
        describe: "source file to analyze",
        type: "string"
      });
    },
    argv => {
      const { get } = require("../internals/get/clio-get");
      get(argv);
    }
  )
  .command(
    "deps.show",
    "Shows the list of dependencies listed in Package.json",
    yargs => {
      yargs.positional("source", {
        describe: "Shows the list of dependencies listed in Package.json",
        type: "string"
      });
    },
    () => {
      const { showDependencies } = require("../internals/deps");
      showDependencies();
    }
  )
  .command(
    "deps.get",
    "Download every dependency listed in Package.json",
    yargs => {
      yargs.positional("source", {
        describe: "Download every dependency listed in Package.json",
        type: "string"
      });
    },
    () => {
      const { getDependencies } = require("../internals/deps");
      getDependencies();
    }
  )
  .demandCommand(1, "must provide a valid command")
  .completion().argv;
