class Range {
  constructor(start = 0, end = Infinity, step, mapfn) {
    this.start = start;
    this.end = end;
    this.step = step || (end > start ? 1 : -1);
    this.mapfn = mapfn;
    this.index = 0;
  }
  map(fn) {
    const mapfn = this.mapfn
      ? (item, index, range) => fn(this.mapfn(item, index, range), index, range)
      : fn;
    return new Range(this.start, this.end, this.step, mapfn);
  }
  get(index) {
    const value = this.start + this.step * index;
    if (value > this.end) return undefined; // JS arrays do the same
    return this.mapfn ? this.mapfn(value, index, this) : value;
  }
  take(n) {
    return new Range(
      this.start,
      this.start + n * this.step - this.step,
      this.step,
      this.mapfn
    );
  }
  skip(n) {
    return new Range(
      this.start + n * this.step,
      this.end,
      this.step,
      this.mapfn
    );
  }
  slice(start, end) {
    return this.skip(start).take(end - start);
  }
  toArray() {
    return [...this];
  }
  toString() {
    return `[${this.start}:${this.end}:${this.step}]`;
  }
  next() {
    const value = this.start + this.step * this.index;
    const done = value >= this.end;
    const mapped = this.mapfn ? this.mapfn(value, this.index, this) : value;
    if (done) this.index = 0;
    else this.index++;
    return { value: mapped, done };
  }
  [Symbol.iterator]() {
    return this;
  }
}

const range = (start, end, step) => new Range(start, end, step);

module.exports.range = range;
module.exports.Range = Range;
