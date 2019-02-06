const { lazy_call, value, lazy } = require('./lazy');
const EventEmitter = require('events');
const Decimal = require('decimal.js');

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

class Broadcast {
  constructor(data) {
    this.emitter = new EventEmitter();
    this._data = data;
  }
  set data(data) {
    this.emitter.emit('data', data);
    this._data = data;
  }
  on(ev, fn) {
    return this.emitter.on(ev, fn);
  }
  off(ev, fn) {
    return this.emitter.off(ev, fn);
  }
}

class Transform {
    constructor(func, index, star) {
        this.func = func;
        this.star = star;
        this.index = index;
    }
    transform(data) {
      data = data[this.index];
      if (this.star) {
        return data.map(this.func);
      }
      return this.func(data);
    }
}

class LazyRange {
  constructor(start, end, step, functor) {
    this.start = start;
    this.end = end;
    this.step = step;
    this.functor = functor || this.default_functor;
  }
  async get(index) {
    var val = await this.functor(index, this);
    return val;
  }
  length() {
    return ((this.end.sub(this.start)).div(this.step)).floor().abs().add(1);
  }
  default_functor(index, obj) {
    return obj.start.add(obj.step.mul(index));
  }
  async map(fn) {
    if (!fn.is_lazy) {
      var result = [];
      for (var i = 0; i < this.length(); i++) {
        result.push(await fn(await value(await this.get(i))));
      }
    } else {
      var functor = this.functor;
      var result = new LazyRange(
        this.start,
        this.end,
        this.step,
        function (index, obj) {
          return fn(functor(index, obj));
        }
      )
    }
    return result;
  }
}

class Generator {
  constructor(getter, data, length) {
    this.getter = getter;
    this.data = data;
    this.length = length;
  }
  get(i) {
    return this.getter(i, this);
  }
  len() {
    return this.length.constructor == Function ? this.length(this) : this.length;
  }
  async map(func, stack) {
    if (!func.is_lazy) {
      var result = [];
      for (var i = 0; i < this.len(); i++) {
        result.push(await func(await value(this.get(i)).catch(e => {throw e})).catch(e => {throw e}));
      }
      return new Generator(
        (i, self) => self.data[i],
        result,
        self => self.data.length,
      );
    } else {
      var _this = this;
      return lazy(async function () {
        var result = [];
        for (var i = 0; i < _this.len(); i++) {
          var val = await value(_this.get(i)).catch(e => {throw e});
          var r = await func(val).catch(e => {throw e});
          r.clio_stack = stack;
          result.push(r);
        }
        return new Generator(
          (i, self) => self.data[i],
          result,
          self => self.data.length,
        );
      })();
    }
  }
  slice(slicers) {
    return this.slicer(this, slicers);
  }
}

exports.Generator = Generator;
exports.Property = Property;
exports.AtSign = AtSign;
exports.Transform = Transform;
exports.Decimal = Decimal;
exports.EventListener = EventListener;
exports.Broadcast = Broadcast;
