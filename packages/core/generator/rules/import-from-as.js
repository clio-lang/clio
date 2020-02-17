const { Rule } = require("../rule");
const arr = require("../arr");

const make = (path, names) =>
  arr`scope.extend(require(${path}), {${names.join(",")}})`;

class importFromAsStatement extends Rule {
  cstToNode() {
    const { path, names } = this.cst;
    const processedPath = this.generate(path);
    const processedNames = names.map(name => {
      const { src, dest } = name;
      return `${src}: "${dest}"`;
    });
    return make(processedPath, processedNames);
  }
}

module.exports = { importFromAsStatement };
