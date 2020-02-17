const { Rule } = require("../rule");
const { SourceNode } = require("source-map");
const arr = require("../arr");

class hashmap extends Rule {
  cstToNode() {
    const { values } = this.cst;
    return this.makeHash(values);
  }
  makeHash(map) {
    const processed = [];
    for (const keyValues of map) {
      const { key, value, values } = keyValues;
      const processedValue = values
        ? this.makeHash(values)
        : this.generate(value);
      const { line, column } = key;
      const keyValue = arr`${key.raw}: (${processedValue})`;
      processed.push(new SourceNode(line, column, this.file, keyValue));
      processed.push(",");
    }
    processed.pop();
    return ["{", ...processed, "}"];
  }
}

module.exports = { hashmap };
