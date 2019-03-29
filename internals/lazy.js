// laziness for clio

const {exception_handler} = require('../common');
const md5 = require('./md5');

MemoizeID = 0;
// todo: add support for objects, classes and etc...
function stringify(arg) {
  if (arg.constructor == Array) {
    arg = arg.map(stringify);
  }
  if (arg.constructor == Object) {
    var stringified = ''
    for (var variable in arg) {
      if (arg.hasOwnProperty(variable)) {
        stringified += `[${variable}: ${stringify(arg[variable])}]`;
      }
    }
  }
  return arg.toString();
}

function serialize(arg) {
  return md5(stringify(arg));
}

function memoize(fn, max) {
  var cache = new Map();
  var cache_keys = [];
  fn.mmax = max;
  return async function(...args) {
    args = await Promise.all(args);
    if (!fn.mmax || (fn.mmax && fn.mmax.gt(0))) {
      var hash = serialize(args);
      var cached = cache.get(hash);
      if (cached != undefined) {
        return cached;
      }
    }
    var result = await fn(...args);
    if (!fn.mmax || fn.mmax.gt(0)) {
      cache.set(hash, result);
      cache_keys.push(hash);
      if (fn.mmax && fn.mmax.lt(cache_keys.length)) {
        var key = cache_keys.shift();
        cache.delete(key);
      }
    }
    return result;
  };
}

function lazy(fn) {
  var func = async function (...args) {
    return new LazyCall(fn, ...args);
  };
  func.is_lazy = true;
  return func;
}

class LazyCall {
  constructor(fn, ...args) {
    this.fn = fn;
    this.args = args;
  }
  async call() {
    var self = this;
    // this is needed, but has negative impact on performance
    this.args = await Promise.all(this.args.map(value));
    var result = await this.fn.apply(null, this.args).catch(e => {exception_handler(e, self)});
    if (result && result.constructor == LazyCall) {
      if (result.clio_stack) {
        result.prev = this
      } else {
        result.clio_stack = this.clio_stack;
        result.prev = this.prev
      }
    } // how to put this in non-lazy calls?
    return result;
  }
  async map(fn) {
    var self = this;
    if (!fn.is_lazy) {
      return (await value(self).catch(e => {throw e})).map(fn);
    } else {
      return lazy(async function () {
        return (await value(self).catch(e => {throw e})).map(fn);
      });
    }
  }
}

async function value(lazy) {
  lazy = await lazy;
  while (lazy && lazy.constructor == LazyCall) {
    lazy = await lazy.call();
  }
  return lazy;
}

exports.lazy = lazy;
exports.LazyCall = LazyCall;
exports.value = value;
