const { Rule } = require("../rule");
const arr = require("../arr");

const make = (fnName, decorator, parsedArgs) =>
  arr`scope.$.${fnName} = ${decorator}(${parsedArgs.join(", ")})`;

class decoratedFunction extends Rule {
  parseCST() {
    const { fn, decorator } = this.cst;
    const { fn: fnName } = fn;
    const parsedFn = this.generate(fn);
    const { fn: decoratorFn, args } = decorator;
    const parsedDecorator = this.generate(decoratorFn);
    const parsedArgs = args.map(arg => this.generate(arg));
    parsedArgs.push(parsedFn);
    return make(fnName, parsedDecorator, parsedArgs);
  }
}

module.exports = { decoratedFunction };
