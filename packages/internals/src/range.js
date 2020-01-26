class Range {
  constructor({ start = 0, end = Infinity, step }) {
    this.start = start;
    this.end = end;
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
    if (slicer instanceof Range) {
      let slicerIndex = 0;
      let index = slicer.get(slicerIndex);
      const items = [];
      const { step } = slicer;
      if (step > 0) {
        while (index < this.length && slicerIndex < slicer.length) {
          items.push(this.get(index));
          index = slicer.get(++slicerIndex);
        }
      } else {
        while (index > 0 && slicerIndex < slicer.length) {
          if (index < this.length) items.push(this.get(index));
          index = slicer.get(++slicerIndex);
        }
      }
      return new Array(...items);
    }
    if (slicer.length == 1) {
      const first = slicer.get(0);
      if (typeof first == "number") return this.get(slicer.get(0));
      if (first instanceof Array) {
        const items = [];
        let index = 0;
        while (index < first.length) {
          const item = this.get(first.get(index++));
          items.push(item);
        }
        return new Array(...items);
      }
      if (first instanceof Range) {
        return this.slice(first);
      }
    }
    if (slicer.length > 1) {
      const current = slicer.get(0);
      const rest = slicer.slice(new Range({ start: 1 }));
      return this.slice(current).map(item => item.slice(rest));
    }
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
