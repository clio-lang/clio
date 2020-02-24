const { Rule } = require("../rule");
const arr = require("../arr");

const make = (condition, body) => arr`if (${condition}) { ${body.join(";")} }`;

class ifConditional extends Rule {
  parseCST() {
    const { condition, body } = this.cst;
    const processedBody = body.body.map(item => this.generate(item));
    const processedCondition = this.generate(condition);
    return make(processedCondition, processedBody);
  }
}

module.exports = { ifConditional };
