const { Rule } = require("../rule");

class conditional extends Rule {
  cstToNode() {
    const { ifBlock, elifBlock, elseBlock } = this.cst;
    const processedIf = this.generate(ifBlock);
    const processedElif = elifBlock ? this.generate(elifBlock) : "";
    const processedElse = elseBlock ? this.generate(elseBlock) : "";
    return [processedIf, processedElif, processedElse].filter(Boolean);
  }
}

module.exports = { conditional };
