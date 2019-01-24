const fs = require('fs');
const path = require('path');
const treeify = require('treeify');
const lexer = require('./lexer/lexer');
const parser = require('./parser/parser');
const analyzer = require('./evaluator/analyzer');
const clio_import = require('./internals/import');
const beautify = require('js-beautify').js;

global.fetch = require("node-fetch"); // fetch is not implemented in node (yet)

/******************************************************************************
  ULTIMATE TODO, IDEA AND BUG LIST
    [ ] Allow only one symbol, or a flow in __conditional__
    [ ] Allow no condition for if, in __inflowcond__
    [ ] Rename else to else_block in grammars
    [ ] Allow whitespace before colon
    [ ] Investigate possible conditional grammars and fix grammar
    [X] Fix string bug
    [ ] Add comments for mortals
 ******************************************************************************/

/******************************************************************************
  CODE FOR TESTING LEXER AND PARSER AND OTHER CRAP
 ******************************************************************************/

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

function process_file(file) {
  fs.readFile(file, 'utf8', function(err, contents) {

    if (process.argv[2] == 'run') {
      /*
        TODO:
          [X] set direct import flag
          [ ] ^ try to remember why I wanted that
          [X] change cwd to input file dir
          [ ] remove all paths from require
          [ ] ^ try to remember that also
      */
      //return clio_import(file).catch(e => console.log(e));
      return clio_import(file).catch(e => e.exit());
    }

    var tokens = lexer(contents);
    if (tokens[0] == false) {
      return;
    }
    tokens = tokens[1];
    var result = parser(contents, tokens);
    var ast = result[1];
    if (process.argv[2] == 'ast') {
      return print_ast(ast);
    }
    ast.pop() // eof
    var code = beautify(analyzer(ast, contents));

    if (process.argv[2] == 'compile') {
      write_file(code, process.argv[4]);
    }
  });
}

if (process.argv.length <= 3) {
    console.log("Usage: " + __filename + " ast|compile|run SOURCE_FILE DEST_FILE?");
    process.exit(-1);
}

if (!['ast', 'compile', 'run'].includes(process.argv[2])) {
  console.log("Usage: " + __filename + " ast|compile|run SOURCE_FILE DEST_FILE?");
  process.exit(-1);
}

if (process.argv[2] == 'compile') {
  if (process.argv.length <= 4) {
      console.log("Usage: " + __filename + " ast|compile|run SOURCE_FILE DEST_FILE?");
      process.exit(-1);
  }
}

var file = process.argv[3];
process.env.clio_root = __dirname;
// ^ we'll remove this when we package clio, ofc
process_file(file);
