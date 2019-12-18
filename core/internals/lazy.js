class Lazy {
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

const lazy = fn => new Lazy(fn);

class IO {
  constructor(fn) {
    this.fn = fn;
  }
  valueOf() {
    return this.fn();
  }
}

const io = fn => new IO(fn);

module.exports = {
  io,
  IO,
  lazy,
  Lazy
};
