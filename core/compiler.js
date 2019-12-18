const lexer = require("./lexer");
const parser = require("./parser");
const generator = require("./generator");

exports.compile = source => {
  return lexer(source)
    .then(tokens => {
      return parser.parse(tokens);
    })
    .then(([success, result]) => {
      if (success) {
        const cst = result[0];
        return cst;
      } else {
        // TODO: Somehow import model from bean parser
        const firstUnmatched = result[0].name;
        //const expecting = model
        //  .filter(m => m.left == firstUnmatched)
        //  .map(({ right }) => right);
        const encountered = result[1].name;
        const { index } = result[1];
        // const ParsingError = `At ${index}: Expecting one of ${expecting.join(
        //   ", "
        // )} but encountered ${encountered}`;

        const ParsingError = `At ${index}: Unexpected token ${encountered}`;
        throw new Error(ParsingError);
      }
    })
    .then(cst => generator.generate(cst));
};
