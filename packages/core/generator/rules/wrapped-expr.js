const { Rule } = require("../rule");
const arr = require("../arr");

const make = compiled => arr`(${compiled})`;

class wrappedExpr extends Rule {
  parseCST() {
    const { expression } = this.cst;
    const compiled = this.generate(expression);
    return make(compiled);
  }
}

module.exports = { wrappedExpr };
