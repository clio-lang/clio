const { Rule } = require("../rule");
const arr = require("../arr");

const make = (start, end, step) =>
  arr`new Range({ start: ${start}, end: ${end}, step: ${step} })`;

class range extends Rule {
  cstToNode() {
    const { start, end, step } = this.cst;
    const rangeStart = start ? this.generate(start) : "null";
    const rangeEnd = end ? this.generate(end) : "null";
    const rangeStep = step ? this.generate(step) : "null";
    return make(rangeStart, rangeEnd, rangeStep);
  }
}

module.exports = { range };
