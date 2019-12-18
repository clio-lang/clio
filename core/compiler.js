const lexer = require("./lexer");
const parser = require("./parser");
const generator = require("./generator");

exports.compile = source => {
  return lexer(source).then(tokens => {
    const [result, cst] = parser.parse(tokens);

    return generator.generate(cst[0]);
  });
};
