#!/usr/bin/env node

const createPackage = require("./init/createpackage");
const fs = require("fs");
const path = require("path");
const printAst = require("./misc/ast");
const lexer = require("../lexer/lexer");
const parser = require("../parser/parser");
const highlight = require("./highlight");
const run = require("./run");
const compile = require("./compile");
const { initPackage } = require("./init/pkginit");
const host = require("./host");
const packageConfig = require("../package/packageConfig");

global.fetch = require("node-fetch"); // fetch is not implemented in node (yet)
global.WebSocket = require("websocket").w3cwebsocket; // same for WebSocket

require("yargs")
  .command(
    "run [source]",
    "Compile and run Clio file",
    yargs => {
      yargs.positional("source", {
        describe: "source file to run",
        type: "string",
        default: packageConfig.getPackageConfig().main
      });
    },
    argv => {
      if (argv.source) {
        run(argv.source);
      }
    }
  )
  .command(
    "host <source>",
    "Host a Clio file",
    yargs => {
      yargs.positional("source", {
        describe: "source file to host",
        type: "string"
      });
    },
    argv => {
      host(argv.source);
    }
  )
  .command(
    "highlight <source>",
    "Highlight a Clio file",
    yargs => {
      yargs.positional("source", {
        describe: "source file to highlight",
        type: "string"
      });
    },
    argv => {
      fs.readFile(argv.source, "utf8", (err, contents) => {
        if (err) console.trace(err);
        console.log(highlight(contents));
      });
    }
  )
  .command(
    "ast <source>",
    "Print ast for a Clio file",
    yargs => {
      yargs.positional("source", {
        describe: "source file to analyze",
        type: "string"
      });
    },
    argv => {
      fs.readFile(argv.source, "utf8", (err, contents) => {
        if (err) console.trace(err);
        let tokens = lexer(contents);
        if (tokens[0] == false) {
          return;
        }
        tokens = tokens[1];
        const result = parser(contents, tokens, false, argv.source);
        let ast = result[1];
        printAst(ast);
      });
    }
  )
  .command(
    "init [args]",
    "Generate a package.json and fetch stdlib",
    yargs => {
      yargs.positional("y", {
        type: "boolean",
        default: "false"
      });
    },
    argv => {
      console.log("cwd:", process.cwd());
      console.log("argv:", argv);
      initPackage(argv.y, path.dirname(process.cwd()));
    }
  )
  .command(
    "new <project>",
    "Create a new Clio project",
    yargs => {
      yargs.positional("project", {
        describe: "name of the project",
        type: "string"
      });
    },
    argv => {
      createPackage(argv.project);
    }
  )
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
  .command(
    "compile <source> <destination>",
    "Compile a Clio file",
    yargs => {
      yargs
        .positional("source", {
          describe: "source file to compile",
          type: "string"
        })
        .positional("destination", {
          describe: "destination file to write to",
          type: "string"
        });
    },
    argv => {
      compile(argv.source, argv.destination);
    }
  )
  .demandCommand(1, "must provide a valid command")
  .completion().argv;
