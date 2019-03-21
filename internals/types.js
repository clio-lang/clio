const { LazyCall, value, lazy } = require('./lazy');
const Decimal = require('decimal.js');
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

// https://stackoverflow.com/a/1482209/2451039
function isObjLiteral(_obj) {
  var _test  = _obj;
  return (  typeof _obj !== 'object' || _obj === null ?
              false :
              (
                (function () {
                  while (!false) {
                    if (  Object.getPrototypeOf( _test = Object.getPrototypeOf(_test)  ) === null) {
                      break;
                    }
                  }
                  return Object.getPrototypeOf(_obj) === _test;
                })()
              )
          );
}
// TODO: we probably need to make a cleaner version of ^

var cast_to_js = function (object) {
  // TODO: add more data types
  if (object.constructor == Array) {
    return object.map(cast_to_js);
  } else if (object.constructor == Decimal) {
    return object.toNumber();
  } else if (isObjLiteral(object)) {
    return Object.keys(object).reduce((out, key) => {
      out[key] = cast_to_js(object[key]);
    })
  } else {
    return object;
  }
}

var cast_to_clio = function (object) {
  // TODO: add more data types
  if (object.constructor == Array) {
    return object.map(cast_to_clio);
  } else if (object.constructor == Number) {
    return Decimal(object);
  } else if (isObjLiteral(object)) {
    return Object.keys(object).reduce((out, key) => {
      out[key] = cast_to_clio(object[key]);
    })
  } else {
    return object;
  }
}

var autocast = function (fn) {
  return function (...args) {
    // cast the args to js safe ones
    args = cast_to_js(args);
    // call the js function
    var results = fn(...args);
    // cast back to clio types
    return cast_to_clio(results);
  };
}

exports.Generator = Generator;
exports.Property = Property;
exports.AtSign = AtSign;
exports.Transform = Transform;
exports.Decimal = Decimal;
exports.EventListener = EventListener;
exports.EventEmitter = EventEmitter;
exports.autocast = autocast;
