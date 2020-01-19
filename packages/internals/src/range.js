const { IO } = require("./io");
const { Array } = require("./array");

const defaultGetter = ({ start, end, step, index }) => {
  const value = start + step * index;
  if (step < 0 && value < end) throw "Index out of range";
  if (step > 0 && value > end) throw "Index out of range";
  return value;
};

class Range {
  constructor({ start, end, step, getter }) {
    this.start = start || 0;
    this.end = end || Infinity;
    this.step = step || (this.end > this.start ? 1 : -1);
    this.getter = getter || defaultGetter;
  }
  valueOf() {
    const array = new [].constructor(this.length)
      .fill(null)
      .map((_, i) => this.get(i).valueOf());
    return new Array(...array);
  }
  get length() {
    return Math.floor(Math.abs(this.end - this.start) / Math.abs(this.step));
  }
  map(fn) {
    const range = new Range({
      ...this,
      getter: ({ index }) => fn(this.get(index))
    });
    if (fn.type && fn.type instanceof IO) return new Array(...range.valueOf());
    return range;
  }
  get(index) {
    return this.getter({ ...this, index });
  }
}

module.exports = {
  Range
};
