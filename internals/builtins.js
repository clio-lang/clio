var { lazy, value, LazyCall, memoize } = require('../internals/lazy');
var { Transform, AtSign, Decimal, Range, Property, EventListener, EventEmitter, autocast } = require('../internals/types');
const {jsonReviver, jsonReplacer} = require('../internals/json');
const {throw_error, exception_handler} = require('../common');

var builtins = {};

builtins.error = throw_error;
builtins.lazy = lazy;
builtins.value = value;

var js_to_clio_type_map = function (type) {
  switch (type) {
    case String:
      return 'str';
    case Object:
      return 'obj';
    case Range:
      return 'range';
    case Decimal:
      return 'num';
    default:

  }
}

builtins.update_vars = async function (scope, keys, val) {
  var parent = scope;
  var key;
  while (keys.length) {
    key = keys.shift();
    if (parent.hasOwnProperty(key)) {
      variable = await value(parent[key]);
      if (keys.length) {
        parent = variable
      }
    }
  }
  return parent[key] = val;
}

builtins.revive = function (str) {
  return JSON.parse(str, jsonReviver);
}

builtins.replace = function (obj) {
  return JSON.stringify(obj, jsonReplacer);
}

builtins.typeof = function (thing) {
  return thing.type || js_to_clio_type_map(thing.constructor) || thing.constructor;
}

builtins.define_function = function(fn, fn_name, scope) {
  scope[fn_name] = fn;
  return fn;
}

builtins.decorate_function = function (decorator, args, fn_name, scope) {
  var AsyncFunction = (async () => {}).constructor;
  if ([Function, AsyncFunction].includes(fn_name.constructor)) {
    // anonymous decoration
    var decorated_fn = decorator(fn_name, ...args);
    decorated_fn.is_clio_fn = fn_name.is_clio_fn;
    return decorated_fn;
  }
  var fn = scope[fn_name];
  var decorated_fn = decorator(fn, ...args);
  decorated_fn.is_clio_fn = fn.is_clio_fn;
  scope[fn_name] = decorated_fn;
  return decorated_fn;
}

builtins.setup_ws = async function (connections, host) {
  connections[host] = {socket: new WebSocket(`${host}/connect`), id: 0, promises: {}, emitters: {}}
  connections[host].socket.onmessage = function (event) {
    var data = builtins.revive(event.data);
    if (data.id) {
      connections[host].promises[data.id.toNumber()](data);
    } else if (data.service) {
      if (data.service == 'update') {
        if (data.emitter) {
          var emitter = connections[host].emitters[data.emitter];
          var event = data.event;
          emitter.emit(event, data.data);
        }
      }
    }
  }
  // TODO: reconnect on close
  await new Promise(function (resolve, reject) {
    connections[host].socket.onopen = resolve;
  })
}

builtins.ws_get = async function (ws, key) {
  var id = ws.id++;
  var data = JSON.stringify({
    key: key,
    id: id,
    method: 'get',
  }, jsonReplacer);
  ws.socket.send(data);
  var response = await new Promise(function(resolve, reject) {
    ws.promises[id] = resolve;
  });
  var type = response.type;
  if (type == 'function') {
    return builtins.lazy(async function (...args) {
      return builtins.ws_call(ws, key, args, {});
    });
  } else if (type == 'emitter') {
    var emitter = new EventEmitter({
      wildcard: true,
      newListener: false,
      maxListeners: 128,
    });
    ws.emitters[key] = emitter;
    return emitter;
  }
}

builtins.ws_call = async function (ws, fn_name, args, kwargs) {
  var id = ws.id++;
  var data = JSON.stringify({
    fn_name: fn_name,
    args: args,
    kwargs: kwargs,
    id: id,
    method: 'execute',
  }, jsonReplacer);
  ws.socket.send(data);
  var response = await new Promise(function(resolve, reject) {
    ws.promises[id] = resolve;
  });

  // ws supports emitters, check
  if (response.result.constructor == EventEmitter) {
    ws.emitters[response.result.uuid] = response.result;
  }

  if (response.stdout) {
    console.log(response.stdout.replace(/\n$/, ''));
  }
  return response.result;
}

builtins.http_call = async function(url, fn_name, args, kwargs) {

  var data = JSON.stringify({
    fn_name: fn_name,
    args: args,
    kwargs: kwargs
  }, jsonReplacer);

  var response = await fetch(`${url}/execute`, {
      method: "POST", // *GET, POST, PUT, DELETE, etc.
      mode: "cors", // no-cors, cors, *same-origin
      cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
      credentials: "omit", // include, same-origin, *omit
      headers: {
          "Content-Type": "application/clio-cloud-call",
          // "Content-Type": "application/x-www-form-urlencoded",
      },
      redirect: "follow", // manual, *follow, error
      referrer: "no-referrer", // no-referrer, *client
      body: data, // body data type must match "Content-Type" header
    });

  response = JSON.parse(await response.text(), jsonReviver);

  if (response.stdout) {
    console.log(response.stdout.replace(/\n$/, ''));
  }
  return response.result;
}

builtins.get_symbol = function(key, scope) {
  if (scope.hasOwnProperty(key)) {
    return scope[key]
  }
  if (builtins.hasOwnProperty(key)) {
    return builtins[key];
  }
  return new builtins.Property(key);
}

const AsyncFunction = (async () => {}).constructor;

builtins.assure_async = async function (fn) {
  fn = await fn;
  if (fn.constructor === AsyncFunction) {
    return fn;
  }
  return async function (...args) {
    return fn(...args);
  };
}

builtins.get_property = async function (obj, prop) {
  obj = await value(obj);
  prop = await obj[prop];
  if ([Function, AsyncFunction].includes(prop.constructor)) {
    prop = prop.bind(obj)
  }
  return prop;
}

builtins.funcall = async function(data, args, func, file, trace) {
    if (func.constructor == LazyCall) {
      func = await value(func);
      // ^ in case it is property access
    }
    if (func.constructor == Property) { // JS compatibility layer?
      var prop = func.prop;
      func = function (data, ...args) {
        return data[prop].call(data, ...args);
      }
    }
    if (!func.is_clio_fn) {
      func = autocast(func);
    }
    func = await builtins.assure_async(func);
    var current_stack = [{file: file, trace: trace}];
    var func_call;
    var handler = e => {exception_handler(e, {clio_stack: current_stack})};
    if (!func.is_lazy) {
        args = await Promise.all(args.map(value)).catch(handler);
        data = await Promise.all(data.map(value)).catch(handler);
    }
    if (!args.length) {
      func_call = func(...data).catch(handler);
      if (func_call.constructor == builtins.LazyCall) {
        func_call.clio_stack = current_stack;
      }
      return await func_call;
    }
    var AtSigned = false;
    args = args.map(function(arg) {
        if (arg.constructor == Transform) {
            AtSigned = true;
            if (!func.is_lazy) {
              return value(arg.transform(data));
            }
            return arg.transform(data);
        } else if (arg.constructor == AtSign) {
            AtSigned = true;
            return data[arg.index];
        }
        return arg;
    })
    args = await Promise.all(args).catch(handler);
    if (AtSigned) {
        func_call = func(...args).catch(handler);
        if (func_call.constructor == builtins.LazyCall) {
          func_call.clio_stack = current_stack;
        }
        return await func_call;
    };
    func_call = func(...data, ...args);
    if (func_call.constructor == Promise) {
      func_call = await func_call.catch(handler);
    }
    if (func_call && func_call.constructor == builtins.LazyCall) {
      func_call.clio_stack = current_stack;
    }
    return func_call;
}

Object.defineProperty(Array.prototype, 'async_map', {
    value: async function(...args) { return this.map(...args) }
});

builtins.map = async function(a, f, stack, ...args) {
    // TODO: fix the arguments names!
    if (f.constructor == LazyCall) {
      f = await value(f);
      // ^ in case it is property access
    }
    if (f.constructor == Property) { // JS compatibility layer?
      var prop = f.prop;
      f = function (data, ...args) {
        return data[prop].call(data, ...args);
      }
    }
    if (!f.is_clio_fn) {
      f = autocast(func);
    }
    f = await builtins.assure_async(f);
    if (!f.is_lazy) {
        args = await Promise.all(args.map(value)).catch(e => {throw e});
        a = await Promise.all(a.map(value)).catch(e => {throw e});
    }
    data = a.shift();
    if (!args.length) {
        if (!f.is_lazy) {
          return await data.map(function (d) {
            return f(d, ...a).catch(e => {throw e});
          });
        } else {
          return await data.map(lazy(function (d) {
            return f(d, ...a).catch(e => {throw e});
          }));
        }
    }
    var fn = async function(d) {
        var AtSigned = false;
        _args = args.map(async function(arg) {
            if (arg.constructor == Transform) {
                AtSigned = true;
                if (!f.is_lazy) {
                  return value(arg.transform([d, ...a]));
                }
                return arg.transform([d, ...a]);
            } else if (arg.constructor == AtSign) {
                AtSigned = true;
                return [d, ...a][arg.index];
            }
            return arg;
        });
        _args = await Promise.all(_args);
        if (AtSigned) {
            return await f(..._args);
        }
        return await f(d, ..._args);
    };
    if (f.is_lazy) {
      fn = lazy(fn);
    }
    if (data.async_map) {
      return await data.async_map(fn, stack).catch(e => {throw e});
    }
    return await data.map(fn, stack).catch(e => {throw e});
}

builtins.starmap = function(a, f, args, file, trace) {
    var current_stack = [{file: file, trace: trace}];
    if (!args.length) {
        return builtins.map(a, f, current_stack).catch(e => {exception_handler(e, {clio_stack: current_stack})});
    }
    return builtins.map(a, f, current_stack, ...args).catch(e => {exception_handler(e, {clio_stack: current_stack})});
}

builtins.dec = lazy(async function(a, b) {
    if (a.constructor == Array) {
      return a.map(el => builtins.dec(el, b));
    }
    return a.sub(b);
})

builtins.add = lazy(async function(a, b) {
    if ((a.constructor == String) || (b.constructor == String)) {
      return a.toString() + b.toString();
    }
    if (a.constructor == Array) {
      return a.map(el => builtins.add(el, b));
    }
    return a.add(b);
})

builtins.div = lazy(async function(a, b) {
    if (a.constructor == Array) {
      return a.map(el => builtins.div(el, b));
    }
    return a.div(b);
})

builtins.mul = lazy(async function(a, b) {
    if (a.constructor == Array) {
      return await a.map(el => builtins.mul(el, b));
    }
    return a.mul(b);
})

builtins.mod = lazy(async function(a, b) {
    if (a.constructor == Array) {
      return a.map(el => builtins.mod(el, b));
    }
    return a.mod(b);
})

builtins.pow = lazy(async function(a, b) {
    if (a.constructor == Array) {
      return a.map(el => builtins.pow(el, b));
    }
    return a.pow(b);
})

builtins.bool = async function (a) {
  if (!a) {
    return false;
  }
  if (a.constructor == Array) {
    return a.length > 0;
  }
  if (a.constructor == builtins.Decimal) {
    return !a.eq(0);
  }
  return a;
}

builtins.not = async function (a) {
  return !a;
}

builtins.eq = async function(a, b) {
    if (a.eq) {
      return a.eq(b);
    }
    return a == b;
}

builtins.lt = async function(a, b) {
    return a.lt(b);
}

builtins.lte = async function(a, b) {
    return a.lte(b);
}

builtins.gt = async function(a, b) {
    return a.gt(b);
}

builtins.gte = async function(a, b) {
    return a.gte(b);
}

builtins.cat = lazy(async function() {
    if (typeof arguments[0] == 'string') {
        return [...arguments].join('');
    }
})

builtins.head = lazy(async function(a) {
    return a[0];
})

builtins.tail = lazy(async function(a) {
    return a.slice(1);
})

builtins.append = lazy(async function(a, b) {
    a.push(b);
    return a;
})

builtins.length = lazy(async function(a) {
    return a.length;
})

var chalk = require('chalk');

var colormap = {
  Decimal: chalk.yellow,
  Range: chalk.cyan,
  Array: chalk.cyan
}

builtins.string = lazy(async function (object, colorize) {
  if (object.constructor == Array) {
    var inner = await Promise.all(object.map(builtins.string));
    inner = await Promise.all(inner.map(builtins.value));
    return colormap.Array('[' + inner.join(' ') + ']');
  } else if (object.constructor == Decimal) {
    return colormap.Decimal(object.toString());
  }
  return object.toString();
})

builtins.print = async function(...args) {
    var _args = await Promise.all(args.map(a => builtins.string(a, true)).map(value));
    console.log(..._args);
    return args[0];
}

builtins.log = async function (...args) {
  console.log(...args);
  return args[0];
}

builtins.flat = lazy(async function (a) {
  var res = [];
  a.forEach(function (_a) {
    _a.forEach(function (__a) {
      res.push(__a)
    })
  })
  return res;
})

builtins.take = lazy(function(list, n) {
  // redo
})

builtins.slice = lazy(async function (list, slicers) {
  if (list.constructor == Array) {
    var slicer = slicers.shift();
    if (slicer.constructor == builtins.Decimal) {
      list = list[slicer.toNumber()];
    } else if (slicer.constructor == Array) {
      var wanted = slicer.map(d => d.toNumber());
      list = wanted.map(w => list[w]);
    } else if (slicer.constructor == builtins.Range) {
      var wanted = [];
      var curr = slicer.start;
      while (curr.lte(list.length) && curr.lte(slicer.end)) {
        wanted.push(curr.toNumber());
        curr = curr.add(slicer.step);
      }
      list = wanted.map(w => list[w]);
    }
    if (!slicers.length) {
      return list;
    }
    list = list.map(item => builtins.slice(item, slicers.slice(0)));
    list = list.map(builtins.value);
    return await Promise.all(list);
  } else {
    // it's a range
    var slicer = slicers.shift();
    if (slicer.constructor == builtins.Decimal) {
      list = list.get(slicer.toNumber())
    } else if (slicer.constructor == Array) {
      var wanted = slicer.map(d => d.toNumber());
      list = wanted.map(w => list.get(w));
    } else if (slicer.constructor == builtins.Range) {
      var wanted = [];
      var curr = slicer.start;
      while (curr.lte(list.length) && curr.lte(slicer.end)) {
        wanted.push(curr.toNumber());
        curr = curr.add(slicer.step);
      }
      list = wanted.map(w => list.get(w));
    }
    if (!slicers.length) {
      return list;
    }
    throw new Error(`Can't slice a range any further.`);
  }
})

builtins.upper = lazy(async function(a, b) {
    if (b) {
        return a.toLocaleUpperCase(b);
    }
    return a.toUpperCase();
})

builtins['sentence-case'] = lazy(async function(a, b) {
  if (b) {
      return a[0].toLocaleUpperCase(b) + a.slice(1);
  }
  return a[0].toUpperCase(b) + a.slice(1);
})

builtins.eval = expr => expr;

builtins.filter = lazy(async function (array, fn) {
  var result = [];
  for (var i = 0; i < array.length; i++) {
    if (await value(fn(array[i]))) {
      result.push(array[i])
    }
  }
  return result;
})

builtins.includes = lazy(autocast(async function (array, item) {
  return array.includes(item);
}))

builtins.eager = function (fn) {
  var eager_fn = async function (...args) {
    return await value(await fn(...args));
  }
  eager_fn.mmax = new builtins.Decimal(0);
  return eager_fn;
}

builtins.mmax = function (fn, max) {
  fn.mmax = max;
  return fn;
}

builtins.memoize = function (fn, max) {
  return memoize(fn, max || 1000);
}

builtins.timeout = function(fn, time) {
  return setTimeout(fn, time.toNumber())
}

builtins.interval = function(time, fn, ...args) {
  var i = 0;
  return setInterval(function () {
    fn(new builtins.Decimal(i++), ...args)
  }, time.toNumber())
}

builtins.emitter = async function(name, maxListeners) {
  var ee = new EventEmitter({
    wildcard: true,
    newListener: false,
    maxListeners: maxListeners || 128,
  });
  ee.name = name;
  return ee;
}

builtins.emit = async function(ee, ev, ...args) {
  ee.emit(ev, ...args)
}

Object.keys(builtins).forEach(k => {
  builtins[k].is_clio_fn = true;
});

builtins.LazyCall = LazyCall;
builtins.Transform = Transform;
builtins.AtSign = AtSign;
builtins.Decimal = Decimal;
builtins.Range = Range;
builtins.Property = Property;
builtins.EventListener = EventListener;

module.exports = builtins;
