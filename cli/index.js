#!/usr/bin/env node

const createPackage = require("./init/createpackage");
const fs = require("fs");
const printAst = require("./misc/ast");
const lexer = require("../lexer/lexer");
const parser = require("../parser/parser");
const analyzer = require("../evaluator/analyzer");
const beautify = require("js-beautify").js;
const highlight = require("../highlight");

global.fetch = require("node-fetch"); // fetch is not implemented in node (yet)
global.WebSocket = require("websocket").w3cwebsocket; // same for WebSocket

function writeFile(source, path) {
  fs.writeFileSync(path, source);
}

async function processFile(argv) {
  // eslint-disable-next-line camelcase
  process.env.clio_root = __dirname;
  argv.command = argv._[0];

  const { clioImport } = require("../internals/import");

  if (argv.command == "run") {
    return clioImport(argv.source, true).catch(e =>
      e.exit ? e.exit() : console.log(e)
    );
  }

  if (argv.command == "host") {
    const path = require("path");
    const clio_host = require("../host/host");
    try {
      if (!path.isAbsolute(argv.source)) {
        let cwd = process.cwd();
        var file = path.join(cwd, argv.source);
      }
      var file_dir = path.dirname(file);
      global.__basedir = file_dir;

      var _module = clioImport(argv.source);
    } catch (e) {
      return e.exit ? e.exit() : console.log(e);
    }
    return clio_host(_module, file_dir);
  }

  fs.readFile(argv.source, "utf8", function(err, contents) {
    if (argv.command == "highlight") {
      console.log();
      return console.log(highlight(contents));
    }

    let tokens = lexer(contents);
    if (tokens[0] == false) {
      return;
    }
    tokens = tokens[1];
    try {
      var result = parser(contents, tokens, false, argv.source);
    } catch (e) {
      return e.exit ? e.exit() : console.log(e);
    }
    let ast = result[1];
    if (argv.command == "ast") {
      return print_ast(ast);
    }
    ast.pop(); // eof
    let code = beautify(analyzer(ast, contents));

    if (argv.command == "compile") {
      writeFile(code, argv.destination);
    }
  });
}

require("yargs")
  .command(
    "run <source>",
    "Compile and run Clio file",
    yargs => {
      yargs.positional("source", {
        describe: "source file to run",
        type: "string"
      });
    },
    argv => {
      processFile(argv);
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
      processFile(argv);
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
      processFile(argv);
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
    "init",
    "Generate a package.json and fetch stdlib",
    () => {},
    () => {
      const { initPackage } = require("../internals/helpers/pkginit");
      initPackage();
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
    _ => {
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
    _ => {
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
      processFile(argv);
    }
  )
  .demandCommand(1, "must provide a valid command")
  .completion().argv;