const { Rule } = require("../rule");
const implicit = require("../common/implicit");

class ret extends Rule {
  parseCST() {
    const { expr } = this.cst;
    const { name } = expr;
    if (name == "conditional") {
      expr.ifBlock.body.body = implicit(expr.ifBlock.body.body);
      if (expr.elifBlock) {
        expr.elifBlock.body = expr.elifBlock.body.map(block => {
          block.body.body = implicit(block.body.body);
          return block;
        });
      }
      if (expr.elseBlock) {
        expr.elseBlock.body.body = implicit(expr.elseBlock.body.body);
      }
      return [this.generate(expr)];
    } else {
      const processedExpr = this.generate(expr);
      return ["return", processedExpr];
    }
  }
}

module.exports = {
  return: ret
};
