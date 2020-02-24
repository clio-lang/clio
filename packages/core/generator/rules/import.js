const { Rule } = require("../rule");
const arr = require("../arr");

const make = path => arr`scope.extend(require(${path}, moduleName(${path})`;

class importStatement extends Rule {
  parseCST() {
    const { path } = this.cst;
    const processedPath = this.generate(path);
    return make(processedPath);
  }
}

module.exports = { importStatement };
