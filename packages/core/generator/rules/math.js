const { Rule } = require("../rule");
const arr = require("../arr");

const make = (op, left, right) => arr`builtins.${op}(${left}, ${right})`;

const opMap = {
  "+": "add",
  "-": "sub",
  "*": "mul",
  "/": "div",
  "^": "pow"
};

class math extends Rule {
  parseCST() {
    const { lhs, op, rhs } = this.cst;
    const left = this.generate(lhs);
    const right = this.generate(rhs);
    return make(opMap[op], left, right);
  }
}

module.exports = { math };
