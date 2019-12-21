const fs = require("fs");
const treeify = require("treeify");
const lexer = require("../../lexer/lexer");
const parser = require("../../parser/parser");
const { error } = require("../lib/colors");

exports.command = "ast <source>";
exports.desc = "Print ast for a Clio file";
exports.builder = {
  source: { describe: "source file to analyze", type: "string" }
};
exports.handler = function(argv) {
  const ast = printAst(argv.source);
  if (ast) console.log(ast);
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

function printAst(source) {
  try {
    if (!source) {
      throw new Error("The path to the Clio souce file is required.");
    }
    if (!fs.existsSync(source)) {
      throw new Error("The provided Clio source file does not exist.");
    }
    const contents = fs.readFileSync(source, "utf8");
    let tokens = lexer(contents);
    if (tokens[0] == false) {
      return;
    }
    tokens = tokens[1];
    const result = parser(contents, tokens, false, source);
    let ast = result[1];
    removeProps(ast, "index");
    return treeify.asTree(ast, true);
  } catch (err) {
    error(err);
  }
}

exports.printAst = printAst;
