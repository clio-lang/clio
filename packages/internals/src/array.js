class Array {
  constructor(...items) {
    this.items = items;
  }
  valueOf() {
    return this.items.map(item => item.valueOf());
  }
  map(...args) {
    const items = this.items
      .map(...args)
      .map(item => (item instanceof IO ? item.valueOf() : item));
    return new Array(...items);
  }
  lazyMap(fn) {
    return new LazyMap({ getter: this.get, length: this.length, fn });
  }
  get(index) {
    return this.items[index];
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
        const items = [];
        let index = 0;
        while (index < first.length) {
          const item = this.get(first.get(index++));
          items.push(item);
        }
        return new Array(...items);
      }
    }
    if (slicer.length > 1) {
      const current = slicer.get(0);
      const rest = slicer.slice(new Range({ start: 1 }));
      return this.slice(new Array(current)).map(item => item.slice(rest));
    }
    return this;
  }
  get length() {
    return this.items.length;
  }
}

module.exports.Array = Array;

const { IO } = require("./io");
const { LazyMap } = require("./lazyMap");
const { Range } = require("./range");
