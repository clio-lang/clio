#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const treeify = require('treeify');
const lexer = require('./lexer/lexer');
const parser = require('./parser/parser');
const analyzer = require('./evaluator/analyzer');
const clio_host = require('./host/host');
const {clio_import} = require('./internals/import');
const beautify = require('js-beautify').js;
const highlight = require('./highlight');
const decompress = require('decompress');
const tmp = require('tmp');

global.fetch = require("node-fetch"); // fetch is not implemented in node (yet)
global.WebSocket = require('websocket').w3cwebsocket; // same for WebSocket

function remove_props(obj,keys){
 if(obj instanceof Array){
   obj.forEach(function(item){
     remove_props(item, keys)
   });
 }
 else if(typeof obj === 'object'){
   Object.getOwnPropertyNames(obj).forEach(function(key){
     if(keys.indexOf(key) !== -1) {
       delete obj[key];
     } else {
       remove_props(obj[key], keys)
     };
   });
 }
}

function print_ast(ast) {
  remove_props(ast, 'index')
  console.log(treeify.asTree(ast, true));
  //console.dir(x, { depth: null, colors: true });
}

function write_file(source, path) {
  fs.writeFileSync(path, source);
}

async function process_file(argv) {

  process.env.clio_root = __dirname;
  argv.command = argv._[0];

  if (argv.command == 'run') {
    try {
      return clio_import(argv.source, true);
    } catch (e) {
      return e.exit ? e.exit() : console.log(e);
    }
  }

  if (argv.command == 'host') {
    try {
      var _module = clio_import(argv.source);
    } catch (e) {
      return e.exit ? e.exit() : console.log(e);
    }
    return clio_host(_module);
  }

  fs.readFile(argv.source, 'utf8', function(err, contents) {

    if (argv.command == 'highlight') {
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
    if (argv.command == 'ast') {
      return print_ast(ast);
    }
    ast.pop() // eof
    var code = beautify(analyzer(ast, contents));

    if (argv.command == 'compile') {
      write_file(code, argv.destination);
    }
  });
}

const argv = require('yargs')
  .command('run <source>', 'Compile and run Clio file', (yargs) => {
    yargs.positional('source', {
      describe: 'source file to run',
      type: 'string'
    })
  },
  (argv) => {
    process_file(argv)
  })
  .command('host <source>', 'Host a Clio file', (yargs) => {
    yargs.positional('source', {
      describe: 'source file to host',
      type: 'string'
    })
  },
  (argv) => {
    process_file(argv)
  })
  .command('highlight <source>', 'Highlight a Clio file', (yargs) => {
    yargs.positional('source', {
      describe: 'source file to highlight',
      type: 'string'
    })
  },
  (argv) => {
    process_file(argv)
  })
  .command('ast <source>', 'Print ast for a Clio file', (yargs) => {
    yargs.positional('source', {
      describe: 'source file to analyze',
      type: 'string'
    })
  },
  (argv) => {
    process_file(argv)
  })
  .command('get <url>', 'Download and install a Clio module', (yargs) => {
    yargs.positional('source', {
      describe: 'source file to analyze',
      type: 'string'
    })
  },
  (argv) => {
    (async () => {
      var url = argv.url;
      var file = await fetch(url);
      var array_buffer = await file.arrayBuffer();
      var buffer = Buffer.from(array_buffer);
      var tmpobj = tmp.fileSync();
      fs.writeFileSync(tmpobj.name, buffer, 'binary');
      await decompress(tmpobj.name, 'clio_env')
      tmpobj.removeCallback();
    })();
  })
  .command('compile <source> <destination>', 'Compile a Clio file', (yargs) => {
    yargs.positional('source', {
      describe: 'source file to compile',
      type: 'string'
    }).positional('destination', {
      describe: 'destination file to write to',
      type: 'string'
    })
  },
  (argv) => {
    process_file(argv)
  })
  .demandCommand(1, 'must provide a valid command')
  .completion()
  .argv
