const lexer = require("./lexer");
const parser = require("./parser");
const generator = require("./generator");

exports.compile = (source, file = "unknown") => {
  return lexer(source)
    .then(parser.parse)
    .then(parser.getCST(source))
    .then((cst) => generator.generate(cst, file));
};
