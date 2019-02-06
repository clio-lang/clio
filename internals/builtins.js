var { lazy, value, lazy_call } = require('../internals/lazy');
var { Transform, AtSign, Decimal, Generator, Property, EventListener, Broadcast } = require('../internals/types');
const {jsonReviver, jsonReplacer} = require('../internals/json');
const {throw_error, exception_handler} = require('../common');

const EventEmitter = require('events');

var builtins = {};

builtins.error = throw_error;
builtins.lazy = lazy;
builtins.lazy_call = lazy_call;
builtins.value = value;
builtins.Transform = Transform;
builtins.AtSign = AtSign;
builtins.Decimal = Decimal;
builtins.Generator = Generator;
builtins.Property = Property;

var js_to_clio_type_map = function (type) {
  switch (type) {
    case String:
      return 'str';
    case Object:
      return 'obj';
    case Generator:
      return 'gen';
    case Decimal:
      return 'num';
    default:

  }
}

builtins.broadcast = async function (data) {
  return new Broadcast(data);
}

builtins.update_vars = async function (scope, key, val) {
  key = key[0];
  if (scope[key]) {
    var variable = await value(scope[key]);
    if (variable.constructor == Broadcast) {
      return variable.data = val;
    }
  }
  return scope[key] = val;
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

var get_proper_function = function (args, funcs) {
  var types = args.map(builtins.typeof);
  for (var i = 0; i < funcs.length; i++) {
    var func = funcs[i];
    if (!func.overload) {
      return func;
    }
    var sliced_types = types.slice(0, func.overload.length);
    if (sliced_types.every( e => func.overload.includes(e) )) {
      return func;
    }
  }
}

builtins.define_function = function(fn, fn_name, scope) {
  if (scope[fn_name]) {
    var overloadfn = scope[fn_name];
    var overloads = overloadfn.overloads;
  } else {
    var overloadfn = (async function (...args) {
      var func = get_proper_function(args, overloadfn.overloads);
      return func(...args);
    });
    if (fn.is_lazy) {
      overloadfn = lazy(overloadfn);
    };
    var overloads = [];
  }
  overloads.push(fn);
  overloadfn.overloads = overloads.sort(function (a, b) {
    if (a.overload) {
     a = a.overload.length;
    } else {
     a = 0;
    }
    if (b.overload) {
     b = b.overload.length;
    } else {
     b = 0;
    }
    return a < b;
  });
  scope[fn_name] = overloadfn;
  return overloadfn;
}

builtins.decorate_function = function (decorator, args, fn_name, overload, scope) {
  var AsyncFunction = (async () => {}).constructor;
  if ([Function, AsyncFunction].includes(fn_name.constructor)) {
    // anonymous decoration
    var overloadfn = (async function (...args) {
      var func = get_proper_function(args, overloadfn.overloads);
      return func(...args);
    });
    if (fn_name.is_lazy) {
      overloadfn = lazy(overloadfn);
    };
    var overloads = [];
    overloads.push(fn_name);
    overloadfn.overloads = overloads;
    return decorator(overloadfn, overload, ...args);
  }
  var overload_fn = scope[fn_name];
  var decorated_fn = decorator(overload_fn, overload, ...args);
  scope[fn_name] = decorated_fn;
  return decorated_fn;
}

builtins.setup_ws = async function (connections, host) {
  connections[host] = {socket: new WebSocket(`${host}/connect`), id: 0, promises: {}, broadcasts: {}}
  connections[host].socket.onmessage = function (event) {
    var data = builtins.revive(event.data);
    if (data.id) {
      connections[host].promises[data.id.toNumber()](data);
    } else if (data.service) {
      if (data.service == 'update') {
        if (data.broadcast) {
          var broadcast = connections[host].broadcasts[data.broadcast];
          broadcast.data = data.data;
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
    }, true);
  } else if (type == 'broadcast') {
    var broadcast = new Broadcast();
    ws.broadcasts[key] = broadcast;
    return broadcast;
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

  // ws supports broadcasts, check
  if (response.result.constructor == Broadcast) {
    ws.broadcasts[response.result.uuid] = response.result;
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

builtins.funcall = async function(data, args, func, file, trace) {
    var current_stack = [{file: file, trace: trace}];
    var func_call;
    if (func.constructor == Property) { // JS compatibility layer?
      var prop = func.prop;
      func = function (data, ...args) {
        return data[prop](...args);
      }
    }
    var handler = e => {exception_handler(e, {clio_stack: current_stack})};
    if (!func.is_lazy) {
        args = Promise.all(args).catch(handler);
        data = Promise.all(data).catch(handler);
        args = await value(args).catch(handler);
        data = await value(data).catch(handler);
    }
    if (!args.length) {
      func_call = func(...data).catch(handler);
      if (func_call.constructor == builtins.lazy_call) {
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
        if (func_call.constructor == builtins.lazy_call) {
          func_call.clio_stack = current_stack;
        }
        return await func_call;
    };
    func_call = func(...data, ...args);
    if (func_call.constructor == Promise) {
      func_call = await func_call.catch(handler);
    }
    if (func_call && func_call.constructor == builtins.lazy_call) {
      func_call.clio_stack = current_stack;
    }
    return func_call;
}

builtins.map = async function(a, f, stack, ...args) {
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
    return await data.map(fn, stack).catch(e => {throw e});
}

builtins.starmap = function(a, f, args, file, trace) {
    var current_stack = [{file: file, trace: trace}];
    if (!args.length) {
        return builtins.map(a, f, current_stack).catch(e => {exception_handler(e, {clio_stack: current_stack})});
    }
    return builtins.map(a, f, current_stack, ...args).catch(e => {exception_handler(e, {clio_stack: current_stack})});
}

builtins.filter = async function(data, func) {
    if (func.constructor == Generator) {
        var filter_data = func;
        func = function(n, i) {
            return filter_data.get(i);
        }
    }
    if (data.constructor !== Array) {
        return [data].filter(func);
    }
    return data.filter(func);
}

builtins.dec = lazy(async function(a, b) {
    if (a.constructor == builtins.Generator) {
      return a.map(el => builtins.dec(el, b));
    }
    return a.sub(b);
})

builtins.add = lazy(async function(a, b) {
    if ((a.constructor == String) || (b.constructor == String)) {
      return a.toString() + b.toString();
    }
    if (a.constructor == builtins.Generator) {
      return a.map(el => builtins.add(el, b));
    }
    return a.add(b);
})

builtins.div = lazy(async function(a, b) {
    if (a.constructor == builtins.Generator) {
      return a.map(el => builtins.div(el, b));
    }
    return a.div(b);
})

builtins.mul = lazy(async function(a, b) {
    if (a.constructor == builtins.Generator) {
      return await a.map(el => builtins.mul(el, b));
    }
    return a.mul(b);
})

builtins.mod = lazy(async function(a, b) {
    if (a.constructor == builtins.Generator) {
      return a.map(el => builtins.mod(el, b));
    }
    return a.mod(b);
})

builtins.pow = lazy(async function(a, b) {
    if (a.constructor == builtins.Generator) {
      return a.map(el => builtins.pow(el, b));
    }
    return a.pow(b);
})

builtins.bool = async function (a) {
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
  num: chalk.yellow,
  range: chalk.cyan,
}

builtins.string = lazy(async function (thing, colorize) {
  var type = await value(builtins.typeof(thing));
  var string;
  if (type == 'gen') {
    if (thing.data.start) {
      type = 'num'
      var start = thing.data.start;
      var end = thing.data.end;
      var step = thing.data.step;
      string = [start, end, step].join(chalk.white(':'));
    } else {
      string = await Promise.all((await value(thing.map(i => builtins.string(i, colorize)))).data.map(value));
      string = string.join(' ');
      string = `[${string}]`;
    }
  } else {  // TODO: better support for objects
    string = thing.toString();
  }
  if (colorize) {
    string = (colormap[type] || chalk.white)(string);
  }
  return string;
})

builtins.print = async function(...args) {
    var _args = await Promise.all(args.map(a => builtins.string(a, true)).map(value));
    console.log(..._args);
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

builtins.slice = lazy(async function (list, slicers, index) {
  var slicer = slicers[index++];
  if (list.data.start) {
    // it's a range
    if (slicer.constructor == Decimal) {
      // a regular index
      if (slicer.toNumber() >= list.len()) {
        throw new Error(`Index ${slicer.toString()} is bigger than array length.`);
      }
      list = new Generator(
        list.getter,
        [list.get(slicer.toNumber())],
        list.length,
      );
      /*if (index != 1) {
        list = new Generator(
          list.getter,
          [list.get(slicer.toNumber())],
          list.length,
        );
      } else {
        list = list.get(slicer.toNumber());
      }*/
    } else if (slicer.data.start) {
      // range cut
      var start;
      if (list.data.start.gte(slicer.data.start)) {
        start = list.data.start;
      } else {
        start = slicer.data.start;
      }
      var end;
      if (slicer.data.end == Infinity) {
        end = list.data.end;
      } else {
        if (list.data.end.lte(slicer.data.end)) {
          end = list.data.end;
        } else {
          end = slicer.data.end;
        }
      }
      var step = slicer.data.step.mul(list.data.step);
      list = new Generator(
        list.getter,
        {start: start, end: end, step: step},
        list.length,
      );
    } else {
      // multiple cut
      var indices = slicer.data.map(d => d.toNumber())
      list = new Generator(
        list.getter,
        indices.map(i => list.get(i)),
        list.length,
      );
    }
  } else {
    // it's a normal list
    if (slicer.constructor == Decimal) {
      // a regular index
      if (slicer.toNumber() >= list.len()) {
        throw new Error(`Index ${slicer.toString()} is bigger than array length.`);
      }
      list = new Generator(
        list.getter,
        [list.data[slicer.toNumber()]],
        list.length,
      );
      /*if (index != 1) {
        list = new Generator(
          list.getter,
          [list.data[slicer.toNumber()]],
          list.length,
        );
      } else {
        list = list.get(slicer.toNumber());
      }*/
    } else if (slicer.data.start) {
      // range cut
      list = new Generator(
        list.getter,
        list.data.filter(function(_, i) {
          return slicer.data.start.lte(i) &&
                 slicer.data.end.gt(i) &&
                 new builtins.Decimal(i).sub(slicer.data.start).mod(slicer.data.step).eq(0);
        }),
        list.length,
      );
    } else {
      // multiple cut
      var indices = slicer.data.map(d => d.toNumber())
      list = new Generator(
        list.getter,
        list.data.filter((l, i) => indices.includes(i)),
        list.length,
      );
    }
  }
  if (index == slicers.length) {
    return list;
  }
  return list.map(l => builtins.slice(l, slicers, index));
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

builtins.eager = function (oldoverload) {
  var newoverload = async function (...args) {
    var func = await get_proper_function(args, newoverload.overloads);
    return await value(await func(...args));
  }
  newoverload.overloads = oldoverload.overloads;
  return newoverload;
}

builtins.timeout = function(fn, time) {
  return setTimeout(fn, time.toNumber())
}

builtins.interval = function(time, fn, ...args) {
  var i = 0;
  return setInterval(function () {
    fn(new Decimal(i++), ...args)
  }, time.toNumber())
}

builtins.emitter = async function(name) {
  var ee = new EventEmitter();
  ee.name = name;
  return ee;
}

builtins.emit = async function(ee, ev, ...args) {
  ee.emit(ev, ...args)
}

builtins.EventListener = EventListener;

module.exports = builtins;
