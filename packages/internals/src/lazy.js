class Lazy {
  constructor(fn) {
    this.fn = fn;
  }
  async valueOf(defer) {
    let result = await this.fn();
    if (result instanceof Flow) result = result.data;
    if (defer) return result;
    while (result instanceof Lazy) {
      result = await result.valueOf(true);
      if (result instanceof Flow) result = result.data;
    }
    return result;
  }
  asResult() {
    return this;
  }
}

const lazy = fn => new Lazy(fn);

module.exports.lazy = lazy;
module.exports.Lazy = Lazy;

const { Flow } = require("./flow");
