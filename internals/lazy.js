// laziness for clio

const {exception_handler} = require('../common');
const md5 = require('./md5');

MemoizeID = 0;
// todo: add support for objects, classes and etc...
function stringify(arg) {
  if (arg.constructor == Array) {
    arg = arg.map(stringify);
  }
  if (['Generator'].includes(arg.constructor.name)) {
    arg._memoize_id = arg._memoize_id ? arg._memoize_id : MemoizeID++;
    arg = `_memoize_id: ${arg._memoize_id}`; // FIXME: we're doomed if arg is this string
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

function memoize(fn) {
  var cache = new Map();
  return async function(...args) {
    args = await Promise.all(args);
    //var hash = args.toString();
    //var hash = JSON.stringify(args);
    //var hash = objhash(args);
    var hash = serialize(args);
    var cached = cache.get(hash);
    if (cached != undefined) {
      return cached;
    }
    var result = await fn(...args);
    cache.set(hash, result);
    return result;
  };
}

/*
var objhash = require('object-hash'); // TODO: replace with faster one

function memoize(fn) {
  var cache = new Map();
  return async function(...args) {
    args = await Promise.all(args);
    //var hash = args.toString();
    var hash = JSON.stringify(args);
    //var hash = objhash(args);
    var cached = cache.get(hash);
    if (cached != undefined) {
      return cached;
    }
    var result = await fn(...args);
    cache.set(hash, result);
    return result;
  };
}
*/
function lazy(fn, do_memoize) {
  if (do_memoize) {
    fn = memoize(fn)
  }
  var func = async function (...args) {
    return new lazy_call(fn, ...args);
  };
  func.is_lazy = true;
  return func;
}

class lazy_call {
  constructor(fn, ...args) {
    this.fn = fn;
    this.args = args;
  }
  async call() {
    var self = this;
    this.args = await Promise.all(this.args).catch(e => exception_handler(e, self));
    this.args = await value(this.args).catch(e => exception_handler(e, self));
    var result = await this.fn(...this.args).catch(e => exception_handler(e, self));
    if (result && result.constructor == lazy_call) {
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

async function process_args(lazy) {
  var needs_processing = [];
  if (lazy.constructor == lazy_call) {
    for (var i = 0; i < lazy.args.length; i++) {
      var arg = lazy.args[i];
      if (arg.constructor == Array) {
        // we should remove these recursive calls, probably
        arg = await Promise.all(arg);
        arg = await value(arg);
        lazy.args[i] = arg;
      };
      if (arg.constructor == lazy_call) {
        var result = await arg.call().catch(e => {throw e});
        lazy.args[i] = result;
        if (result.constructor == lazy_call) {
          needs_processing.push(result);
        }
      }
    }
  }
  return needs_processing;
}

async function value_helper(lazy) {
  var needs_processing = [lazy];
  while (needs_processing.length) {
    var current = needs_processing.pop();
    current.args = await Promise.all(current.args);
    var even_more_to_process = process_args(current);
    while (even_more_to_process.length) {
      needs_processing.push(even_more_to_process.pop())
    }
  }
  var parent = null;
  var index;
  var level = lazy;
  while (true) {
    var all_non_lazy = true;
    for (var i = 0; i < level.args.length; i++) {
      if (level.args[i].constructor == lazy_call) {
        parent = level;
        index = i;
        level = level.args[i];
        all_non_lazy = false;
        break;
      }
    }
    if (all_non_lazy) {
      var result = await level.call().catch(e => {throw e});
      if (parent == null) {
        // the issue is here
        // putting this here solves the issue
        // but please ffs solve it
        return await value(result);
      }
      parent.args[index] = result;
      level = lazy;
      parent = null;
    }
  }
}

function has_lazy_args(lazy) {
  for (var i = 0; i < lazy.args.length; i++) {
    if (lazy.args[i].constructor == lazy_call) {
      return i;
    }
  }
  return false;
}

async function value_of(lazy) {
  var parent = null;
  var current = lazy;
  var index = 0;
  var i = 0;
  while (true) {
    if (current == undefined) {
      return current;
    }
    if (current.constructor != lazy_call) {
      return current;
    }
    current.args = await Promise.all(current.args);
    var lazy_index = has_lazy_args(current);
    if (lazy_index !== false) {
      parent = current;
      current = current.args[lazy_index];
      index = lazy_index;
    } else {
      var result = await value_helper(current);
      if (parent != null) {
        parent.args[index] = result;
        current = lazy;
        parent = null;
        index = 0;
      } else {
        current = result;
      }
    }
  }
}

async function value(lazy) {
  // we should remove these recursive calls, probably
  if (lazy == undefined) {
    return lazy;
  }
  if (lazy.constructor == Array) {
    return await Promise.all(lazy.map(value));
  }
  var result = await value_of(lazy);
  if (result == undefined) {
    return result;
  }
  if (result.constructor == Array) {
    return await Promise.all(result.map(value));
  }
  if (result.constructor == lazy_call) {
    return await value(result);
  }
  if (result.constructor == lazy_call) {
    return await value(result);
  }
  /*if (result.is_lazy) {
    return await value(result.call().catch(e => {throw e}));
  }*/
  return result;
}

exports.lazy = lazy;
exports.lazy_call = lazy_call;
exports.value = value;
