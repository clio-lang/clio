class LazyMap {
  constructor({ getter, length, fn }) {
    this.length = length;
    this.getter = getter;
    this.fn = fn;
  }
  get(index) {
    return this.fn(this.getter(index));
  }
  valueOf() {
    return this;
  }
  toArray() {
    const items = [];
    for (let i = 0; i < this.length; i++) items.push(this.get(i));
    return new Array(...items);
  }
  map(fn) {
    return this.lazyMap(fn).toArray();
  }
  lazyMap(fn) {
    return new LazyMap({ getter: i => this.get(i), length: this.length, fn });
  }
}

module.exports.LazyMap = LazyMap;

const { Array } = require("./array");
