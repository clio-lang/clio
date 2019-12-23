const { Lazy } = require("./lazy");

class IO {
  constructor(fn) {
    this.fn = fn;
  }
  valueOf() {
    let result = this.fn();
    while (result instanceof Lazy) {
      result = result.valueOf();
    }
    return result;
  }
}

const io = fn => new IO(fn);

module.exports = {
  io,
  IO
};
