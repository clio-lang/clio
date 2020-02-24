const { SourceNode } = require("source-map");

/**
 * Class representing a rule.
 */
class Rule {
  /**
   * Create a rule
   * @param {Object} cst CST node returned by parser
   * @param {String} file File name of the source
   * @param {Function} generate generate function (from generator)
   * @returns {Void}
   */
  constructor(cst, file, generate) {
    this.cst = cst;
    this.file = file;
    this.generate = generate;
    const { location } = this.cst;
    const { line, column } = location;
    this.line = line;
    this.column = column;
  }
  /**
   * Override this when extending Rule class
   */
  parseCST() {
    // override this
  }
  /**
   * Wraps the return value of parseCST method in a SourceNode object
   * @returns {SourceNode}
   */
  getNode() {
    return new SourceNode(this.line, this.column, this.file, this.parseCST());
  }
}

const rules = {};

module.exports.rules = rules;
module.exports.Rule = Rule;
