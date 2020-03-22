const { Rule } = require("../rule");
const arr = require("../arr");

const make = (method, fn, args) => arr`${method}(${fn}, ${args.join(", ")})`;

class functionCall extends Rule {
  parseCST() {
    const { fn, args, map } = this.cst;
    const generatedFn = this.generate(fn);
    const processedArgs = args.map(arg => this.generate(arg));
    const method = map ? ".map" : ".pipe";
    const processedFn = generatedFn.startsWith("scope.$")
      ? `rpc.fn("${generatedFn}")`
      : generatedFn;
    return make(method, processedFn, processedArgs);
  }
}

module.exports = { functionCall };
