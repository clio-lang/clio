const { bean, beef } = require("bean-parser");
const fs = require("fs");
const path = require("path");
const lexer = require("./lexer.js");

const clioModel = fs.readFileSync(path.join(__dirname, "clio.beef"), {
  encoding: "utf8"
});

const model = beef(clioModel);
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
