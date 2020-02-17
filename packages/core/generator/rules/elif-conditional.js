const { Rule } = require("../rule");
const { SourceNode } = require("source-map");
const arr = require("../arr");

const make = (condition, body) =>
  arr`else if (${condition}) { ${body.join(";")} }`;

class elifConditional extends Rule {
  cstToNode() {
    const { body } = this.cst;
    const parts = body.map(({ condition, body, location }) => {
      const elifBody = body.body.map(item => this.generate(item));
      const elifCond = this.generate(condition);
      return new SourceNode(location, this.file, make(elifCond, elifBody));
    });
    return [parts.join("")];
  }
}

module.exports = { elifConditional };
