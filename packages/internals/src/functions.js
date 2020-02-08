class Fn {
  constructor(fn, outerScope, type, arity, args = [], curried = true) {
    this.id = uuidv4();
    this.fn = fn;
    this.outerScope = outerScope;
    this.type = type;
    this.isLazy = type == Lazy;
    this.arity = arity || fn.length - 1;
    this.args = args;
    this.curried = curried;
  }
  call(...args) {
    const newArgs = [...this.args, ...args];
    if (this.curried && newArgs.length < this.arity) {
      return new Fn(this.fn, this.outerScope, this.type, this.arity, newArgs);
    }
    const scope = new Scope({}, this.outerScope);
    const result = new this.type(() => this.fn(scope, ...newArgs));
    if (result instanceof IO) {
      return result.valueOf();
    }
    return result;
  }
  unCurry() {
    return new Fn(
      this.fn,
      this.outerScope,
      this.type,
      this.arity,
      this.args,
      false
    );
  }
}

class JSFn {
  constructor(fn) {
    this.fn = fn instanceof Curry ? fn : new Curry(fn);
  }
  call(...args) {
    const result = this.fn(...args);
    return result instanceof Curry ? new JSFn(result) : result;
  }
}

const fn = (fn, outerScope) => new Fn(fn, outerScope);
const jsfn = fn => new JSFn(fn);

module.exports.fn = fn;
module.exports.Fn = Fn;
module.exports.jsfn = jsfn;
module.exports.JSFn = JSFn;

const uuidv4 = require("./uuidv4");
const { Scope } = require("./scope");
const { IO } = require("./io");
const { Lazy } = require("./lazy");
const { Curry } = require("jscurry");
