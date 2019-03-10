const { lazy_call, value, lazy } = require('./lazy');
const DecimalJS = require('decimal.js');
const EventEmitter = require('eventemitter2').EventEmitter2;

class Decimal extends Number {
  constructor(number, decimal) {
    super(number);
    this.decimal = decimal || number.decimal || new DecimalJS(number);
    return new Proxy(this, {
      get: function(target, key) {
        const bypass = ['toString']
        if (typeof target[key] === "function" && !bypass.includes(key)) {
          return function(...args) {
            return target[key].call(target, args);
          }
        } else if (typeof target.decimal[key] === "function") {
          return function(...args) {
            args = args.map(arg => arg.decimal || arg);
            const result = target.decimal[key].call(target.decimal, ...args);
            if (result.constructor === Number) {
              return new Decimal(result);
            } else if (result.constructor === DecimalJS) {
              return new Decimal(Number(result), result)
            }
            return result
          }
        }
        return target[key] || target.decimal[key];
      }
    })
  }
}

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
    transform(data) {
      data = data[this.index];
      if (this.star) {
        return data.map(this.func);
      }
      return this.func(data);
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
exports.EventEmitter = EventEmitter;
