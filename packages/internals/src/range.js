class Range {
  constructor({ start, end, step }) {
    this.start = start || 0;
    this.end = end || Infinity;
    this.step = step || (this.end > this.start ? 1 : -1);
  }
  valueOf() {
    return this;
  }
  get length() {
    return Math.floor(Math.abs(this.end - this.start) / Math.abs(this.step));
  }
  map(fn) {
    return this.lazyMap(fn).toArray();
  }
  lazyMap(fn) {
    return new LazyMap({ getter: i => this.get(i), length: this.length, fn });
  }
  toArray() {
    const items = [];
    for (let i = 0; i < this.length; i++) items.push(this.get(i));
    return new Array(...items);
  }
  slice(slicer) {
    console.log("Not implemented yet");
    return this;
  }
  get(index) {
    const value = this.start + this.step * index;
    if (this.step < 0 && value < this.end) throw "Index out of range";
    if (this.step > 0 && value > this.end) throw "Index out of range";
    return value;
  }
}

module.exports.Range = Range;

const { Array } = require("./array");
const { LazyMap } = require("./lazyMap");
