const { Rule } = require("../rule");
const arr = require("../arr");

const make = raw => arr`${raw}`;

class boolean extends Rule {
  parseCST() {
    const { raw } = this.cst;
    return make(raw);
  }
}

module.exports = { boolean };
