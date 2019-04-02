const treeify = require('treeify');
const lexer = require('./lexer/lexer');
const parser = require('./parser/parser');
const analyzer = require('./evaluator/analyzer');
const {clio_require_browser} = require('./internals/import');

var builtins = require('./internals/builtins');
// setup builtins for browser usage
builtins.clio_require = clio_require_browser;

builtins.get_symbol = function(key, scope) {
  if (scope.hasOwnProperty(key)) {
    return scope[key]
  }
  if (window.clio.builtins.hasOwnProperty(key)) {
    return window.clio.builtins[key];
  }
  if (window.hasOwnProperty(key)) {
    return window[key];
  }
  return new window.clio.builtins.Property(key);
}

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

function print_ast(ast, printfn) {
  remove_props(ast, 'index');
  printfn(treeify.asTree(ast, true));
  //console.dir(x, { depth: null, colors: true });
}

function compile(source) {
  var tokens = lexer(source)[1];
  var ast = parser(source, tokens)[1];
  if (ast[ast.length-1].name == 'eof') {
    ast.pop()
  }
  var code = analyzer(ast, source);
  return code;
}

async function clio_process_source(source, out, info, printfn, __dirname) {
  if (!__dirname) {
    __dirname = window.location.href
                  .replace(/\?[^/#]*/, '')  // remove ?query=whatever
                  .replace(/#.*/, '') // remove #id
                  .replace(/[^/]+\.[^/]+$/, '') //remove filename
  }
  var tokens = lexer(source);
  if (tokens[0] == false) {
    return;
  }
  tokens = tokens[1];
  var t1 = (new Date).getTime();
  var result = parser(source, tokens);
  var t2 = (new Date).getTime();
  var ast = result[1];
  if(out == 'ast') {
    if (info) { printfn(`Ast time: ${(t2-t1)/1000}s`) };
    print_ast(ast, printfn);
  } else {
    ast.pop() // eof
    var code = analyzer(ast, source);
    var t3 = (new Date).getTime();
    if (out == 'run') {
      builtins.print = async function(...args) {
          var args = await Promise.all(args.map(a => window.clio.builtins.string(a, true)));
          printfn(...args);
          return args[0];
      }
      var module = {};
      eval(code);
      // TODO: fix file arg for browser
      await module.exports({}, window.clio.builtins);
    }
    var t4 = (new Date).getTime();
    if (info) {
      setTimeout(function () {
        printfn();
        printfn('-----------------------------------------');
        printfn(`Ast time:\t${(t2-t1)/1000}s`);
        printfn(`Compile time:\t${(t3-t2)/1000}s`);
        printfn(`Eval time:\t${(t4-t3)/1000}s`);
      }, 1);
    };
  }
}

function process_scripts(options) {
  if (!options) {
    options = {};
  }
  document.addEventListener("DOMContentLoaded", function() {
    document.querySelectorAll('script[type="text/clio"]').forEach(function (el) {
      var source = el.innerHTML;
      clio_process_source(source, 'run', false, console.log, options.__dirname);
    });
  });
}

window.clio_process_source = clio_process_source;
window.clio = {
  process: clio_process_source,
  builtins: builtins,
  process_scripts: process_scripts,
  is_browser: true,
  compile: compile
}
