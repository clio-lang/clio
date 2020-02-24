const { Rule } = require("../rule");
const arr = require("../arr");

const make = items => arr`new Array(${items.join(", ")})`;

class array extends Rule {
  parseCST() {
    const { items } = this.cst;
    const processedItems = items.map(item => this.generate(item));
    return make(processedItems);
  }
}

module.exports = { array };
