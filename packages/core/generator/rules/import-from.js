const { Rule } = require("../rule");
const arr = require("../arr");

const make = (path, names) =>
  arr`scope.extend(require(${path}), [${names.join(",")}])`;

class importFromStatement extends Rule {
  parseCST() {
    const { path, names } = this.cst;
    const processedPath = this.generate(path);
    const processedNames = names.map(name => `"${name.raw}"`);
    return make(processedPath, processedNames);
  }
}

module.exports = { importFromStatement };
