class ExtensibleFunction extends Function {
  constructor(fn) {
    super();
    return Object.setPrototypeOf(fn, new.target.prototype);
  }
}

class Fn extends ExtensibleFunction {
  constructor(fn, outerScope, type, options = {}) {
    const { arity, args = [], curried = true, scoped = true } = options;
    const { filename, name } = options;
    const { context } = options;
    const { distributed = true } = options;
    const wrapped = (...args) => {
      const newArgs = [...this.args, ...args];
      const paramLength = this.arity - (scoped ? 1 : 0);
      const hasEnoughArgs = newArgs.length >= paramLength;
      const shouldRun = !args.length || !this.curried || hasEnoughArgs;
      if (shouldRun) return this.runWithArgs(newArgs);
      return this.withArgs(newArgs);
    };
    super(wrapped);
    this.options = options;
    this.id = uuidv4();
    this.fn = fn;
    this.outerScope = outerScope;
    this.type = type;
    this.isLazy = type == Lazy;
    this.distributed = distributed;
    this.arity = arity || getArity(fn);
    this.args = args;
    this.curried = curried;
    this.scoped = scoped;
    this.isClioFn = true;
    this.filename = filename;
    this.path = [filename, this.getOuterNames(), name]
      .filter(Boolean)
      .join("/");
    this.context = context || this.getContext(false);
    if (!rpc.fns.has(this.path)) rpc.fns.set(this.path, this);
  }
  getOuterNames() {
    const outerNames = [];
    let outerScope = this.outerScope;
    while (outerScope && outerScope.name) {
      outerNames.push(outerScope.name);
      outerScope = outerScope.outerNames;
    }
    return outerNames.join("/");
  }
  withArgs(args) {
    const { fn, outerScope, type, arity, scoped } = this;
    return new Fn(fn, outerScope, type, { arity, args, scoped });
  }
  runWithArgs(args) {
    if (!this.context.run)
      if (this.name && this.filename && this.path)
        return rpc.executor.call(this.path, args);
    if (this.scoped) {
      const context = this.context || this.getContext(false);
      args.unshift(context);
    }
    console.log(this.fn.toString());

    const typed = new this.type(() => this.fn(...args));
    return typed.asResult();
  }
  unCurry() {
    const { fn, outerScope, type, arity, scoped, args } = this;
    const curried = false;
    return new Fn(fn, outerScope, type, { arity, args, curried, scoped });
  }
  unDistribute() {
    const options = { ...this.options, distributed: false };
    return new Fn(this.fn, this.outerScope, this.type, options);
  }
  getContext(run) {
    const { name } = this;
    const scope = new Scope({}, this.outerScope, { name });
    const meta = {
      path: this.path,
      name: this.name,
      filename: this.filename,
      distributed: this.distributed,
      run,
    };
    return new Context(scope, meta);
  }
  withContext(run) {
    const context = this.getContext(run);
    const options = { ...this.options, context };
    return new Fn(this.fn, this.outerScope, this.type, options);
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
const { Context } = require("./context");
const rpc = require("./rpc");
