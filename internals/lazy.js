// laziness for clio

const lazy = require("clio-lazy");
const md5 = require("./md5");

MemoizeID = 0;
// todo: add support for objects, classes and etc...
function stringify(arg) {
  if (arg.constructor == Array) {
    arg = arg.map(stringify);
  }
  if (arg.constructor == Object) {
    var stringified = "";
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

exports.lazy = lazy;
