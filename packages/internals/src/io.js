class IO {
  constructor(fn) {
    this.fn = fn;
  }
  async valueOf() {
    let result = await this.fn();
    while (result instanceof Lazy) {
      result = await result.valueOf();
    }
    return result;
  }
  asResult() {
    return this.valueOf();
  }
}

const io = fn => new IO(fn);

module.exports.io = io;
module.exports.IO = IO;

const { Lazy } = require("./lazy");
