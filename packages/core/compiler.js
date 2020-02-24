const lexer = require("./lexer");
const parser = require("./parser");
const generator = require("./generator");

exports.compile = (source, file) => {
  return lexer(source)
    .then(parser.parse)
    .then(parser.handleParseResult)
    .then(cst => generator.generate(cst, file || "unknown"));
};
