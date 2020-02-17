const { Rule } = require("../rule");
const arr = require("../arr");

const make = (fnName, decName, parsedArgs, parsedFn) =>
  arr`scope.$.${fnName} = ${decName}(${parsedArgs.join(", ")})(${parsedFn})`;

class decoratedFunction extends Rule {
  parseCST() {
    const { fn, decorator } = this.cst;
    const { fn: fnName } = fn;
    const parsedFn = this.generate(fn);
    const {
      fn: { raw: decoratorName },
      args
    } = decorator;
    const parsedArgs = args.map(arg => this.generate(arg));
    return make(fnName, decoratorName, parsedArgs, parsedFn);
  }
}

module.exports = { decoratedFunction };
