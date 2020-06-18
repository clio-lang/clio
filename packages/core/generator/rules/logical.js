const { Rule } = require("../rule");
const arr = require("../arr");

class logical extends Rule {
  parseCST() {
    const { lhs, op, rhs } = this.cst;
    if (op.name === "not") return arr`(!${this.generate(rhs)})`;
    if (op.name === "and")
      return arr`(${this.generate(lhs)} && ${this.generate(rhs)})`;
    if (op.name === "or")
      return arr`(${this.generate(lhs)} || ${this.generate(rhs)})`;
  }
}

module.exports = { logical };
