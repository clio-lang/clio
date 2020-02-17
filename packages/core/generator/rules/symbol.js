const { Rule } = require("../rule");
const arr = require("../arr");

const make = raw => arr`scope.$.${raw}`;

class symbol extends Rule {
  cstToNode() {
    const { raw } = this.cst;
    return make(raw);
  }
}

module.exports = { symbol };
