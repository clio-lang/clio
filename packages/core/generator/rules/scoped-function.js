const { Rule } = require("../rule");
const arr = require("../arr");

const make = (fn, originalFn) =>
  arr`scope.$.${originalFn} = scope.$.${fn}.withOuterScope(scope)`;

const makeReturn = (fn) => arr`scope.$.${fn}.withOuterScope(scope)`;

class scopedFn extends Rule {
  parseCST() {
    const { fn, originalFn, inReturn = false } = this.cst;
    return inReturn ? makeReturn(fn) : make(fn, originalFn);
  }
}

module.exports = { scopedFn };
