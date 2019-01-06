var { lazy, value, lazy_call } = require('../internals/lazy');
var { Transform, AtSign, Decimal, Generator, Property } = require('../internals/types');

var builtins = {};

builtins.lazy = lazy;
builtins.lazy_call = lazy_call;
builtins.value = value;
builtins.Transform = Transform;
builtins.AtSign = AtSign;
builtins.Decimal = Decimal;
builtins.Generator = Generator;
builtins.Property = Property;

function jsonReplacer(key, value) {
  if (value.toNumber) {
    return value.toNumber();
  }
  if (value.constructor == Array) {
    return value.map(function (v, k) {
      return jsonReplacer(k, v); // good job javascript!
    });
  }
  return value;
}

function jsonReviver(key, value) {
  if (value.constructor == Number) {
    return Decimal(value);
  }
  if (value.constructor == Array) {
    return value.map(function (v, k) {
      return jsonReviver(k, v); // good job javascript!
    });
  }
  return value;
}

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
    var overloadfn = (function (...args) {
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
  if (fn_name.constructor == Function) {
    // anonymous decoration
    var overloadfn = (function (...args) {
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

builtins.cloud_call = async function(url, fn_name, args, kwargs) {

  var data = JSON.stringify({
    fn_name: fn_name,
    args: args,
    kwargs: kwargs
  }, jsonReplacer);

  var response = await fetch(`${url}/execute`, {
      method: "POST", // *GET, POST, PUT, DELETE, etc.
      mode: "cors", // no-cors, cors, *same-origin
      cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
      credentials: "include", // include, same-origin, *omit
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

builtins.funcall = async function(data, args, func) {
    if (func.constructor == Property) { // JS compatibility layer?
      var prop = func.prop;
      func = function (data, ...args) {
        return data[prop](...args);
      }
    }
    if (!func.is_lazy) {
        args = Promise.all(args);
        data = Promise.all(data);
        args = await value(args);
        data = await value(data);
    }
    if (!args.length) {
        return await func(...data);
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
    args = await Promise.all(args);
    if (AtSigned) {
        return await func(...args);
    }
    return await func(...data, ...args);
}

builtins.map = async function(a, f, ...args) {
    if (!f.is_lazy) {
        args = await Promise.all(args.map(value));
        a = await Promise.all(a.map(value));
    }
    data = a.shift();
    if (!args.length) {
        if (!f.is_lazy) {
          return await data.map(function (d) {
            return f(d, ...a);
          });
        } else {
          return await data.map(lazy(function (d) {
            return f(d, ...a);
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
    return await data.map(fn);
}

builtins.starmap = function(a, f, args) {
    if (!args.length) {
        return builtins.map(a, f);
    }
    return builtins.map(a, f, ...args);
}

builtins.filter = function(data, func) {
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

builtins.dec = lazy(function(a, b) {
    return a.sub(b);
})

builtins.add = lazy(function(a, b) {
    if ((a.constructor == String) || (b.constructor == String)) {
      return a.toString() + b.toString();
    }
    return a.add(b);
})

builtins.div = lazy(function(a, b) {
    return a.div(b);
})

builtins.mul = lazy(function(a, b) {
    return a.mul(b);
})

builtins.pow = lazy(function(a, b) {
    return a.pow(b);
})

builtins.eq = function(a, b) {
    return a.eq(b);
}

builtins.lt = function(a, b) {
    return a.lt(b);
}

builtins.lte = function(a, b) {
    return a.lte(b);
}

builtins.gt = function(a, b) {
    return a.gt(b);
}

builtins.gte = function(a, b) {
    return a.gte(b);
}

builtins.cat = lazy(function() {
    if (typeof arguments[0] == 'string') {
        return [...arguments].join('');
    }
})

builtins.head = lazy(function(a) {
    return a[0];
})

builtins.tail = lazy(function(a) {
    return a.slice(1);
})

builtins.append = lazy(function(a, b) {
    a.push(b);
    return a;
})

builtins.length = lazy(function(a) {
    return a.length;
})

var colors = require('colors/safe');

var colormap = {
  int: colors.yellow,
  range: colors.cyan,
}

builtins.string = lazy(async function (thing, colorize) {
  var type = await value(builtins.typeof(thing));
  var string;
  if (type == 'gen') {
    if (thing.data.start) {
      type = 'int'
      var start = thing.data.start;
      var end = thing.data.end;
      var step = thing.data.step;
      string = [start, end, step].join(colors.white(':'));
    } else {
      string = await Promise.all((await value(thing.map(i => builtins.string(i, colorize)))).data.map(value));
      string = string.join(' ');
      string = `[${string}]`;
    }
  } else {
    string = thing.toString();
  }
  if (colorize) {
    string = (colormap[type] || colors.white)(string);
  }
  return string;
})

builtins.print = async function(...args) {
    var _args = await Promise.all(args.map(a => builtins.string(a, true)).map(value));
    console.log(..._args);
    return args[0];
}

builtins.flat = lazy(function (a) {
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
      if (index == 1) {
        list = new Generator(
          list.getter,
          [list.get(slicer.toNumber())],
          list.length,
        );
      } else {
        list = list.get(slicer.toNumber());
      }
    } else if (slicer.data.start) {
      // range cut
      // TODO: steps
      var step = slicer.data.step;
      var start = list.data.start.add(slicer.data.start);
      var end;
      if (slicer.data.end == Infinity) {
        end = list.data.end;
      } else {
        end = list.data.end.sub(slicer.data.end);
      }
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
      if (index == 1) {
        list = new Generator(
          list.getter,
          [list.data[slicer.toNumber()]],
          list.length,
        );
      } else {
        list = list.get(slicer.toNumber());
      }
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

builtins.upper = lazy(function(a, b) {
    if (b) {
        return a.toLocaleUpperCase(b);
    }
    return a.toUpperCase();
})

builtins['sentence-case'] = lazy(function(a, b) {
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

module.exports = builtins;
