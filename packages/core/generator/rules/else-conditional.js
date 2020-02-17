const { Rule } = require("../rule");
const arr = require("../arr");

const make = body => arr`else { ${body.join(";")} }`;

class elseConditional extends Rule {
  parseCST() {
    const { body } = this.cst;
    const processedBody = body.body.map(item => this.generate(item));
    return make(processedBody);
  }
}

module.exports = { elseConditional };
