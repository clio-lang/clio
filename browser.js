const treeify = require('treeify');
const lexer = require('./lexer/lexer');
const parser = require('./parser/parser');
const analyzer = require('./evaluator/analyzer');

var builtins = require('./internals/builtins');

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

async function clio_process_source(source, out, info, printfn) {
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
      var module = {};
      eval(code);
      builtins.print = async function(...args) {
          var args = await Promise.all(args.map(a => builtins.string(a, true)).map(builtins.value));
          printfn(...args);
          return args[0];
      }
      await module.exports({$: $}, builtins);
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

window.clio_process_source = clio_process_source;

document.addEventListener("DOMContentLoaded", function() {
  document.querySelectorAll('script[type="text/clio"]').forEach(function (el) {
    var source = el.innerHTML;
    clio_process_source(source, 'run', false);
  });
});
