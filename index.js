#!/usr/bin/env node

global.fetch = require("node-fetch"); // fetch is not implemented in node (yet)
global.WebSocket = require("websocket").w3cwebsocket; // same for WebSocket

function remove_props(obj, keys) {
  if (obj instanceof Array) {
    obj.forEach(function(item) {
      remove_props(item, keys);
    });
  } else if (typeof obj === "object") {
    Object.getOwnPropertyNames(obj).forEach(function(key) {
      if (keys.indexOf(key) !== -1) {
        delete obj[key];
      } else {
        remove_props(obj[key], keys);
      }
    });
  }
}

function print_ast(ast) {
  const treeify = require("treeify");
  remove_props(ast, "index");
  console.log(treeify.asTree(ast, true));
  //console.dir(x, { depth: null, colors: true });
}

function write_file(source, path) {
  fs.writeFileSync(path, source);
}

async function process_file(argv) {
  process.env.clio_root = __dirname;
  argv.command = argv._[0];

  const { clio_import } = require("./internals/import");

  if (argv.command == "run") {
    return clio_import(argv.source, true).catch(e =>
      e.exit ? e.exit() : console.log(e)
    );
  }

  if (argv.command == "host") {
    const path = require("path");
    const clio_host = require("./host/host");
    try {
      if (!path.isAbsolute(argv.source)) {
        var cwd = process.cwd();
        var file = path.join(cwd, argv.source);
      }
      var file_dir = path.dirname(file);
      global.__basedir = file_dir;

      var _module = clio_import(argv.source);
    } catch (e) {
      return e.exit ? e.exit() : console.log(e);
    }
    return clio_host(_module, file_dir);
  }

  const fs = require("fs");
  const lexer = require("./lexer/lexer");
  const parser = require("./parser/parser");
  const analyzer = require("./evaluator/analyzer");
  const beautify = require("js-beautify").js;
  const highlight = require("./highlight");

  fs.readFile(argv.source, "utf8", function(err, contents) {
    if (argv.command == "highlight") {
      console.log();
      return console.log(highlight(contents));
    }

    var tokens = lexer(contents);
    if (tokens[0] == false) {
      return;
    }
    tokens = tokens[1];
    try {
      var result = parser(contents, tokens, false, argv.source);
    } catch (e) {
      return e.exit ? e.exit() : console.log(e);
    }
    var ast = result[1];
    if (argv.command == "ast") {
      return print_ast(ast);
    }
    ast.pop(); // eof
    var code = beautify(analyzer(ast, contents));

    if (argv.command == "compile") {
      write_file(code, argv.destination);
    }
  });
}

const argv = require("yargs")
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
      process_file(argv);
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
      process_file(argv);
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
      process_file(argv);
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
      process_file(argv);
    }
  )
  .command(
    "init",
    "Generate a package.json and fetch stdlib",
    yargs => {},
    argv => {
      const { initPackage } = require("./internals/helpers/pkginit");
      initPackage();
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
      const { get } = require("./internals/get/clio-get");
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
      const { showDependencies } = require("./internals/deps");
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
      const { getDependencies } = require("./internals/deps");
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
      process_file(argv);
    }
  )
  .demandCommand(1, "must provide a valid command")
  .completion().argv;
