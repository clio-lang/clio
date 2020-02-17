const { Rule } = require("../rule");
const arr = require("../arr");

const make = (slicee, slicer) => arr`${slicee}.slice(${slicer})`;

class slice extends Rule {
  cstToNode() {
    const { slicee, slicer } = this.cst;
    const processedSlicee = this.generate(slicee);
    const processedSlicer = this.generate(slicer);
    return make(processedSlicee, processedSlicer);
  }
}

module.exports = { slice };
