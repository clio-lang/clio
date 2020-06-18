const { Rule } = require("../rule");
const arr = require("../arr");

const make = (parameter, body) =>
  arr`new Fn(function (scope, ${parameter}) { ${body} })`;

class anonymousFunction extends Rule {
  parseCST() {
    const { parameter, body: expr } = this.cst;
    const processedBody =
      expr.name === "block"
        ? expr.body.map(item => this.generate(item)).join(";")
        : this.generate(expr);
    return make(parameter, processedBody);
  }
}

module.exports = { anonymousFunction };
