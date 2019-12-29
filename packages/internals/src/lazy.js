const { Flow } = require("./flow");

class Lazy {
  constructor(fn) {
    this.fn = fn;
  }
  valueOf(defer) {
    let result = this.fn();
    if (result instanceof Flow) result = result.data;
    if (defer) return result;
    while (result instanceof Lazy) {
      result = result.valueOf(true);
      if (result instanceof Flow) result = result.data;
    }
    return result;
  }
}

const lazy = fn => new Lazy(fn);

module.exports = {
  lazy,
  Lazy
};
