const { Rule } = require("../rule");

class hash extends Rule {
  parseCST() {
    return "{}";
  }
}

module.exports = { hash };
