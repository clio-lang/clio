const { parser } = require("./parser");
const rules = require("./generator/rules");

const generate = (cst, file) =>
  new rules[cst.name](cst, file, generate).getNode();

const generator = (src, file) => parser(src).then(cst => generate(cst, file));

module.exports = { generate, generator };
