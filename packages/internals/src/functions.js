class ExtensibleFunction extends Function {
  constructor(fn) {
    super();
    return Object.setPrototypeOf(fn, new.target.prototype);
  }
}

class Fn extends ExtensibleFunction {
  constructor(fn, outerScope, type, options = {}) {
    const { arity, args = [], curried = true, scoped = true } = options;
    const wrapped = (...args) => {
      const newArgs = [...this.args, ...args];
      const paramLength = this.arity - (scoped ? 1 : 0);
      const hasEnoughArgs = newArgs.length >= paramLength;
      const shouldRun = !args.length || !this.curried || hasEnoughArgs;
      return shouldRun ? this.runWithArgs(newArgs) : this.withArgs(newArgs);
    };
    super(wrapped);
    this.id = uuidv4();
    this.fn = fn;
    this.outerScope = outerScope;
    this.type = type;
    this.isLazy = type == Lazy;
    this.arity = arity || getArity(fn);
    this.args = args;
    this.curried = curried;
    this.scoped = scoped;
    this.isClioFn = true;
  }
  withArgs(args) {
    const { fn, outerScope, type, arity, scoped } = this;
    return new Fn(fn, outerScope, type, { arity, args, scoped });
  }
  runWithArgs(args) {
    if (this.scoped) args.unshift(new Scope({}, this.outerScope));
    const typed = new this.type(() => this.fn(...args));
    return typed.asResult();
  }
  unCurry() {
    const { fn, outerScope, type, arity, scoped, args } = this;
    const curried = false;
    return new Fn(fn, outerScope, type, { arity, args, curried, scoped });
  }
}

const fn = (...args) => new Fn(...args);

module.exports.fn = fn;
module.exports.Fn = Fn;
module.exports.ExtensibleFunction = ExtensibleFunction;

const uuidv4 = require("./uuidv4");
const { Scope } = require("./scope");
const { Lazy } = require("./lazy");
const { getArity } = require("./arity");
