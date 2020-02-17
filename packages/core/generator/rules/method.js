const { Rule } = require("../rule");
const arr = require("../arr");

const make = parts => arr`new Method([${parts}])`;

class method extends Rule {
  cstToNode() {
    const { parts } = this.cst;
    const processedParts = parts.map(({ raw }) => `"${raw}"`).join(",");
    return make(processedParts);
  }
}

module.exports = { method };
