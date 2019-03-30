const { LazyCall, value, lazy } = require('./lazy');
const EventEmitter = require('eventemitter2').EventEmitter2;

class AtSign {
  constructor(index) {
    this.index = index;
  }
}

class Property {
  constructor(prop) {
    this.prop = prop;
  }
}

class EventListener {
  constructor(ee, ev) {
    this.ee = ee;
    this.ev = ev;
    this.is_reactive = true;
  }
  set_listener(fn) {
    return this.ee.on(this.ev, fn);
  }
}

class Transform {
    constructor(func, index, star) {
        this.func = func;
        this.star = star;
        this.index = index;
    }
    async transform(data) {
      data = data[this.index];
      data = await value(data);
      if (this.star) {
        return data.map(this.func);
      }
      return await value(this.func(data));
    }
}

class Range {
  constructor(start, end, step, getter) {
    this.start = start || 0;
    this.end = end || Infinity;
    this.step = step || 1;
    this.getter = getter || ((i, r) => r.step * (i + r.start))
  }
  get(i) {
    return this.getter(i, this);
  }
  len() {
    return Math.floor((this.end - this.start) / this.step) + 1;
  }
  get length() {
    return this.len();
  }
  async map(fn, stack) {
    return new Range(
      this.start,
      this.end,
      this.step,
      (i, r) => fn(this.getter(i, r))
    );
  }
  slice(slicers) {
    return this.slicer(this, slicers);
  }
  asArray() {
    var array = [];
    var i = 0;
    while (i < this.length) {
      array.push(this.get(i));
      i++;
    }
    return array;
  }
}

exports.Range = Range;
exports.Property = Property;
exports.AtSign = AtSign;
exports.Transform = Transform;
exports.EventListener = EventListener;
exports.EventEmitter = EventEmitter;
