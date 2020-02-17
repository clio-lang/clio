const { Rule } = require("../rule");
const arr = require("../arr");

const make = (left, cmp, right) => arr`(${left} ${cmp} ${right})`;

class comparison extends Rule {
  cstToNode() {
    const { lhs, cmp, rhs } = this.cst;
    const left = this.generate(lhs);
    const right = this.generate(rhs);
    return make(left, cmp, right);
  }
}

module.exports = { comparison };
