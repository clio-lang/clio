const { SourceNode } = require("source-map");

class Rule {
  constructor(cst, file, generate) {
    this.cst = cst;
    this.file = file;
    this.generate = generate;
    const { location } = this.cst;
    const { line, column } = location;
    this.line = line;
    this.column = column;
  }
  parseCST() {
    // override this
  }
  getNode() {
    return new SourceNode(this.line, this.column, this.file, this.parseCST());
  }
}

const rules = {};

module.exports.rules = rules;
module.exports.Rule = Rule;
