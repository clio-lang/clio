class Fn {
  constructor(fn, outerScope, type) {
    this.id = uuidv4();
    this.fn = fn;
    this.outerScope = outerScope;
    this.type = type;
    this.isLazy = type == Lazy;
  }
  call(...args) {
    const scope = new Scope({}, this.outerScope);
    const result = new this.type(() => this.fn(scope, ...args));
    if (result instanceof IO) {
      return result.valueOf();
    }
    return result;
  }
}

const fn = (fn, outerScope) => new Fn(fn, outerScope);

module.exports.fn = fn;
module.exports.Fn = Fn;

const uuidv4 = require("./uuidv4");
const { Scope } = require("./scope");
const { IO } = require("./io");
const { Lazy } = require("./lazy");
