const { Rule } = require("../rule");
const arr = require("../arr");

const make = (fn) => arr`scope.$.${fn}.withScope(scope)`;

class scopedFn extends Rule {
  parseCST() {
    const { fn } = this.cst;
    return make(fn);
  }
}

module.exports = { scopedFn };
