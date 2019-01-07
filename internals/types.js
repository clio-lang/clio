const { lazy_call, value } = require('./lazy');

var Decimal = require('decimal.js');

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
  async map(func) {
    if (!func.is_lazy) {
      var result = [];
      for (var i = 0; i < this.len(); i++) {
        result.push(await func(await value(this.get(i))));
      }
      return new Generator(
        (i, self) => self.data[i],
        result,
        self => self.data.length,
      );
    } else {
      var getter = this.getter;
      var data = this.data;
      var length = this.length;
      return new Generator(
        (i, self) => func(getter(i, self)),
        data,
        length,
      );
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
