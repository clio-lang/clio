const { Rule } = require("../rule");
const arr = require("../arr");

const make = (method, fn, args) => arr`${method}(${fn}, ${args.join(", ")})`;

class functionCall extends Rule {
  parseCST() {
    const { fn, args, map } = this.cst;
    const processedFn = this.generate(fn);
    const processedArgs = args.map(arg => this.generate(arg));
    const method = map ? ".map" : ".pipe";
    return make(method, processedFn, processedArgs);
  }
}

module.exports = { functionCall };
