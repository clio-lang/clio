const fs = require("fs");
const lexer = require("../../lexer/lexer");
const parser = require("../../parser/parser");

exports.command = "ast <source>";
exports.desc = "Print ast for a Clio file";
exports.builder = {
  source: { describe: "source file to analyze", type: "string" }
};
exports.handler = function(argv) {
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
};

function removeProps(obj, keys) {
  if (obj instanceof Array) {
    obj.forEach(function(item) {
      removeProps(item, keys);
    });
  } else if (typeof obj === "object") {
    Object.getOwnPropertyNames(obj).forEach(function(key) {
      if (keys.indexOf(key) !== -1) {
        delete obj[key];
      } else {
        removeProps(obj[key], keys);
      }
    });
  }
}

function printAst(ast) {
  const treeify = require("treeify");
  removeProps(ast, "index");
  console.log(treeify.asTree(ast, true));
}
