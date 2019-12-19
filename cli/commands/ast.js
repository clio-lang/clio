const fs = require("fs");
const treeify = require("treeify");
const { parser } = require("../../core/parser");

const readFile = async (...args) => fs.readFileSync(...args);
const log = (...args) => console.log(...args) || args;

const printAst = source =>
  readFile(source, "utf8")
    .then(parser)
    .then(cst => treeify.asTree(cst, true))
    .then(log)
    .catch(console.trace);

const command = "ast <source>";
const desc = "Print ast for a Clio file";
const builder = {
  source: { describe: "source file to analyze", type: "string" }
};
const handler = argv => printAst(argv.source);

module.exports = {
  command,
  desc,
  builder,
  handler,
  printAst
};
