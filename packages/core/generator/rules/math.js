const { Rule } = require("../rule");
const arr = require("../arr");

const make = (left, op, right) => arr`(${left} ${op} ${right})`;
const makePow = (left, right) => arr`Math.pow(${left}, ${right})`;

class math extends Rule {
  parseCST() {
    const { lhs, op, rhs } = this.cst;
    const left = this.generate(lhs);
    const right = this.generate(rhs);
    if (op != "^") return make(left, op, right);
    return makePow(left, right);
  }
}

module.exports = { math };
