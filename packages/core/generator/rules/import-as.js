const { Rule } = require("../rule");
const arr = require("../arr");

const make = (path, name) => arr`scope.$.${name} = require(${path})`;

class importAsStatement extends Rule {
  cstToNode() {
    const { path, importAs } = this.cst;
    const processedPath = this.generate(path);
    return make(processedPath, importAs);
  }
}

module.exports = { importAsStatement };
