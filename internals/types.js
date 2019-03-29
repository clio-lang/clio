const { LazyCall, value, lazy } = require('./lazy');
//const Decimal = require('decimal.js'); <- too slow
const Decimal = require('clio-decimal');
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
    this.start = start || new Decimal(0);
    this.end = end || new Decimal('Inf');
    this.step = step || new Decimal(1);
    this.getter = getter || ((i, r) => r.step.mul(new Decimal(i)).add(r.start))
  }
  get(i) {
    return this.getter(i, this);
  }
  len() {
    return this.end.sub(this.start).div(this.step).floor();
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
    var i = new Decimal(0);
    while (i.lte(new Decimal(this.length))) {
      array.push(this.get(i.toNumber()));
      i = i.add(new Decimal(1));
    }
    return array;
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
    return new Decimal(object);
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

exports.Range = Range;
exports.Property = Property;
exports.AtSign = AtSign;
exports.Transform = Transform;
exports.Decimal = Decimal;
exports.EventListener = EventListener;
exports.EventEmitter = EventEmitter;
exports.autocast = autocast;
