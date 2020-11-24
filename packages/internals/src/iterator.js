class it {
  constructor(fn, firstIndex = 0, lastIndex = Infinity) {
    this.firstIndex = firstIndex;
    this.lastIndex = lastIndex;
    this.index = 0;
    this.fn = fn;
  }
  next() {
    const value = this.fn(this.firstIndex + this.index++);
    const done = this.lastIndex < this.firstIndex + this.index;
    if (done) this.index = this.firstIndex;
    return { value, done };
  }
  map(fn) {
    const currFn = this.fn;
    this.fn = (index) => fn(currFn(this.firstIndex + index), index, this);
    return this;
  }
  take(n) {
    return new it(this.fn, this.firstIndex, this.firstIndex + n);
  }
  skip(n) {
    return new it(this.fn, this.firstIndex + n, this.lastIndex);
  }
  slice(start, end) {
    return this.skip(this.firstIndex + start).take(end - start);
  }
  toArray() {
    return [...this];
  }
  [Symbol.iterator]() {
    return this;
  }
}

module.exports = it;
