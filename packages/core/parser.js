const { bean } = require("bean-parser");
const lexer = require("./lexer.js.js");
const model = require("./model.js.js");

const parse = tokens => bean(model, tokens);

const parser = source =>
  lexer(source)
    .then(parse)
    .then(([success, result]) => {
      if (success) {
        const cst = result[0];
        return cst;
      } else {
        const firstUnmatched = result[0].name;
        const expecting = model
          .filter(m => m.left == firstUnmatched)
          .map(({ right }) => right);
        const encountered = result[1].name;
        const { index } = result[1];
        const ParsingError = `At ${index}: Expecting one of ${expecting.join(
          ", "
        )} but encountered ${encountered}`;
        throw ParsingError;
      }
    });

module.exports = { parser, parse };
