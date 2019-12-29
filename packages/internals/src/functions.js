const uuidv4 = require("./uuidv4");
const { Scope } = require("./scope");
const { IO } = require("./io");

class Fn {
  constructor(fn, outerScope, type) {
    this.id = uuidv4();
    this.fn = fn;
    this.outerScope = outerScope;
    this.type = type;
  }
  call(...args) {
    const scope = new Scope({}, this.outerScope);
    const result = new this.type(() => this.fn(scope, ...args));
    if (result instanceof IO) {
      result.valueOf();
    }
    return result;
  }
}

const fn = (fn, outerScope) => new Fn(fn, outerScope);

module.exports = { fn, Fn };
