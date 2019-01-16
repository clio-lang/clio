const unescapeJs = require('unescape-js');
const cast_to_bool = require('../common').cast_to_bool;
var Decimal = require('decimal.js');

function analyzer(tree, source) {

  /*
      TODO:

    [ ] ranges
    [ ] remove vars we have our own scoping now

  */

  // OPTIMIZE: this function needs to be optimized af

  function make_return(expr) {
    if (expr.name == 'conditional') { // special cases like if/else
      // replace last node with return
      var tokens = expr.tokens.map(make_return);
      expr.tokens = tokens;
      return expr;
    } else if (['if_statement', 'elif_statement', 'else_statement'].includes(expr.name)) {
      var block = expr.tokens[expr.tokens.length-1];

      if (block.name != 'block') {
        block = {
          name: 'block',
          tokens: [block]
        }
      }

      var last_expr = block.tokens[block.tokens.length-1];
      var redefined = make_return(last_expr);
      block.tokens[block.tokens.length-1] = redefined;
      expr.tokens[expr.tokens.length-1] = block;
      return expr;
    }
    return {
      name: 'return',
      tokens: [expr]
    };
  }

  const analyzers = {
    return: function (node) {
      var code = analyze(node.tokens[0]).code;
      return {
        code: `return ${code}`
      };
    },
    number: function (node) {
      node.raw = node.raw.replace(/'/g, '');
      return {
        code: `builtins.Decimal('${node.raw}')`
      };
    },
    bool: function (node) {
      return {
        code: node.raw
      };
    },
    symbol: function (node) {
      return {
        code: `await builtins.funcall(['${node.raw}'], [scope], builtins.get_symbol)`
      };
    },
    /*dotted_symbol: function (node) {
      var first = node.tokens.shift()
      var code = `(new builtins.lazy_call(async () => (await builtins.value(scope['${first.raw}'] || builtins['${first.raw}']))))`
      node.tokens.forEach(function (t) {
        code = `(new builtins.lazy_call(async () => (await builtins.value(${code}))['${t.raw}']))`
      })
      return {
        code: code
      };
    },
    self_dotted_symbol: function (node) {
      node.tokens.unshift({raw: 'instance'});
      var tree = node.tokens.map(t => `['${t.raw}']`).join('');
      return {
        code: `(await scope${tree} || await builtins${tree})`
      };
    },*/
    property_access: function (node) {
      node.tokens = node.tokens.map(token => {
        token.raw = token.raw.replace(/'s?$/, '');
        if (token.raw == 'my') {
          token.raw = 'self'
        }
        return token.raw;
      });
      var first = node.tokens.shift()
      var code = `(new builtins.lazy_call(async () => (await builtins.value(scope['${first}'] || builtins['${first}']))))`
      node.tokens.forEach(function (token) {
        code = `(new builtins.lazy_call(async () => (await builtins.value(${code}))['${token}']))`
      })
      return {
        code: code
      };
    },
    string: function (node) {
      return {
        code: `\`${unescapeJs(node.raw).slice(1,-1)}\``
      };
    },
    word: function (node) {
      return {
        code: `'${node.raw.slice(1)}'`
      };
    },
    atsign: function (node) {
      return {code: '(new builtins.AtSign(0))'};
    },
    atnumber: function (node) {
      return {code: `(new builtins.AtSign(${node.tokens[1].raw}))`};
    },
    notexpr: function (node) {
      var right = analyze(node.tokens[0]).code;
      return {
        code: `(builtins.funcall([${right}], [], builtins.not))`
      };
    },
    and_or_expr: function (node) {
      var tokens = analyze(node.tokens);
      var left = tokens[0].code;
      var right = tokens[2].code;
      var cmp = tokens[1];
      return {
        code: `((${left}) ${cmp} (${right}))`
      };
    },
    wrapped_not: function (node) {
      return analyze(node.tokens[0]);
    },
    wrapped_and_or: function (node) {
      return analyze(node.tokens[0]);
    },
    or: function (node) {
      return '||';
    },
    and: function (node) {
      return '&&';
    },
    not: function (node) {
      return '!';
    },
    list: function (node) {
      var inner = node.tokens.map(function (token) {
        return analyze(token).code;
      }).join(', ')
      var list = `[${inner}]`;
      return {
        code: `new builtins.Generator(
          (i, self) => self.data[i],
          ${list},
          self => self.data.length,
        )`
      };
    },
    range: function (node) {
      var start = node.tokens[0].tokens.length ? node.tokens[0].tokens[0] : {name: 'number', raw: '0'};
      var end = node.tokens.length > 1 ? node.tokens[1] : {name: 'number', raw: 'Infinity'};

      var start = analyze(start).code;
      var end = analyze(end).code;
      var step = `builtins.Decimal(builtins.Decimal(${start}).lt(builtins.Decimal(${end}))?1:-1)`

      return {
        code: `new builtins.Generator(
          (i, self) => self.data.start.add(self.data.step.mul(i)),
          {start:${start}, end:${end}, step:${step}},
          self => self.data.start.sub(self.data.end).div(self.data.step).abs().add(1),
        )`
      };
    },
    stepped_range: function (node) {
      var range = node.tokens[0];
      var start = range.tokens[0].tokens.length ? range.tokens[0].tokens[0] : {name: 'number', raw: '0'};
      var end = range.tokens.length > 1 ? range.tokens[1] : {name: 'number', raw: 'Inf'};
      var step = node.tokens[1];
      var start = analyze(start).code;
      var end = analyze(end).code;
      var step = analyze(step).code;
      return {
        code: `new builtins.Generator(
          (i, self) => self.data.start.add(self.data.step.mul(i)),
          {start:${start}, end:${end}, step:${step}},
          self => self.data.start.sub(self.data.end).div(self.data.step).abs().add(1),
        )`
      };
    },
    slice: function (node) {
      var list = analyze(node.tokens.shift());
      var slicers = node.tokens.pop().tokens;
      var slicers = analyze(slicers).map(s => s.code).join(', ');
      return {
        code: `builtins.funcall([${list.code}], [[${slicers}], 0], builtins.slice)`
      };
    },
    comparison: function (node) {
      return node.raw;
    },
    cmpexpr: function (node) {
      var tokens = analyze(node.tokens);
      var left = tokens[0];
      var right = tokens[2];
      var cmp = tokens[1];
      const funcs = {
        '=': 'builtins.eq',
        '>': 'builtins.gt',
        '>=': 'builtins.gte',
        '<': 'builtins.lt',
        '<=': 'builtins.lte'
      };
      var func = funcs[cmp];
      return {
        code: `await builtins.funcall([${left.code}], [${right.code}], ${func})`
      }
    },
    import_st: function (node) {
      var names_to_import = node.tokens.slice(0,-1).map(t => t.raw);
      var from = node.tokens[node.tokens.length - 1].tokens[0];
      if (from.name == 'url') {
        var code = names_to_import.map(function (symbol) {
          return `scope['${symbol}'] = builtins.lazy(function (...args) {
            return builtins.cloud_call('${from.raw}', '${symbol}', args, {});
          }, true);
          scope['${symbol}.is_cloud'] = true`
        }).join(';\n');
      } else {
        var stringified_names_to_import = names_to_import.map(a => `'${a}'`).join(', ');
        var code = `await builtins.clio_require('${from.raw}', [${stringified_names_to_import}], __dirname, scope)`;
      }
      return {code: code};
    },
    import_nk: function (node) {
      var imports = node.tokens.map(function (mod) {
        return `await builtins.clio_require('${mod.raw}', [], __dirname, scope)`
      })
      return {
        code: imports.join(';\n')
      };
    },
    wrapped_quickfundef: function (node) {
      return analyze(node.tokens[0]);
    },
    quickfundef: function (node) {
      node.tokens.unshift({name: 'symbol', raw: ''})
      node.name = 'fundef';
      node.tokens[2] = {
        name: 'block',
        tokens: [node.tokens[2]]
      }
      var func_code = analyze(node).code;
      return {
        code: func_code
      }
    },
    /*starquickfundef: function (node) {
      node.tokens.unshift({name: 'symbol', raw: ''})
      node.name = 'fundef';
      node.tokens[2] = {
        name: 'block',
        tokens: [node.tokens[2]]
      }
      var func_code = analyze(node).code;
      return {
        code: [func_code, '[]'],
        type: 'map'
      }
    },*/
    inflowfundef: function (node) {
      node.tokens.unshift({name: 'symbol', raw: ''})
      node.name = 'fundef';
      var func_code = analyze(node).code;
      return {
        type: 'inflowfundef',
        code: func_code
      }
    },
    decorated_inflowfundef: function (node) {
      var block = node.tokens.pop();
      var arg = node.tokens.pop();
      var func = analyze({
        name: 'inflowfundef',
        tokens: [arg, block]
      });
      var code = func.code;
      while (node.tokens.length) {
        token = node.tokens.pop().tokens.pop().tokens;
        token.shift(); // shift @
        var name = analyze(token.shift()).code;
        var args = analyze(token).map(t => t.code);
        args = args.join(', ');
        code = `builtins.decorate_function(${name}, [${args}], ${code}, '', scope)`;
      }
      return {
        code: code,
        type: func.type
      };
    },
    starinflowfundef: function (node) {
      node.tokens.unshift({name: 'symbol', raw: ''})
      node.name = 'fundef';
      var func_code = analyze(node).code;
      return {
        type: 'starinflowfundef',
        code: func_code
      }
    },
    decorated_starinflowfundef: function (node) {
      var block = node.tokens.pop();
      var arg = node.tokens.pop();
      var func = analyze({
        name: 'starinflowfundef',
        tokens: [arg, block]
      });
      var code = func.code;
      while (node.tokens.length) {
        token = node.tokens.pop().tokens.pop().tokens;
        token.shift(); // shift @
        var name = analyze(token.shift()).code;
        var args = analyze(token).map(t => t.code);
        args = args.join(', ');
        code = `builtins.decorate_function(${name}, [${args}], ${code}, '', scope)`;
      }
      return {
        code: code,
        type: func.type
      };
    },
    startransform: function (node) {
      var transform = node.tokens[0].tokens[1];
      transform.tokens[0] = {name: 'symbol', raw: ''};
      transform.name = 'fundef';
      if (transform.tokens[1].name == 'atnum_as') {
        var index = transform.tokens[1].tokens[0].tokens[1].raw;
        transform.tokens[1] = {name: 'symbol', raw: transform.tokens[1].tokens[1].raw};
      } else {
        var index = '0';
      }
      transform.tokens[2] = {
        name: 'block',
        tokens: [transform.tokens[2]]
      }
      var func_code = analyze(transform).code;
      return {
        code: `(new builtins.Transform(${func_code}, ${index}, true))`
      }
    },
    transform: function (node) {
      var transform = node.tokens[0];
      transform.tokens[0] = {name: 'symbol', raw: ''};
      transform.name = 'fundef';
      if (transform.tokens[1].name == 'atnum_as') {
        var index = transform.tokens[1].tokens[0].tokens[1].raw;
        transform.tokens[1] = {name: 'symbol', raw: transform.tokens[1].tokens[1].raw};
      } else {
        var index = '0';
      }
      if (transform.tokens[2].name == 'symbol') {
        // convert to flow
        var data = transform.tokens[1];
        var fn = transform.tokens[2];
        var flow = {
          name: 'flow',
          tokens: [
            data,
            {name: 'naked_mapper', tokens: [fn]}
          ]
        }
        transform.tokens[2] = flow;
      }
      transform.tokens[2] = {
        name: 'block',
        tokens: [transform.tokens[2]]
      }
      var func_code = analyze(transform).code;
      return {
        code: `(new builtins.Transform(${func_code}, ${index}, false))`
      }
    },
    flow: function (node) {
      var tokens = analyze(node.tokens);
      var data = [];
      var function_calls = ['setter', 'mapper', 'starmapper', 'naked_mapper', 'naked_star_mapper',
        'filter', 'starinflowfundef', 'inflowfundef', 'starinflowprocdef', 'inflowprocdef', 'condmapper', 'decorated_starinflowfundef',
        'starcondmapper', 'quickfundef', 'starquickfundef', 'return_mapper', 'fundef', 'decorated_inflowfundef']; // fix this list
      var i = 0;
      while (!function_calls.includes(node.tokens[i++].name)) {
        data.push(tokens.shift());
      }
      data = data.map(d => d.code).join(', ');
      var code = `${data}`;
      var variables = [];
      tokens.forEach(function (token) {
        if (token.type == 'setter') {
          code = `(scope${token.code} = ${code})`;
          variables.push(token.code);
        } else if (token.type == 'filter') {
          code = `await builtins.filter([${code}], ${token.code})`;
        } else if (token.type == 'return') {
          code = `return await ${code};`;
        } else if (token.type == 'map') {
          code = `await builtins.starmap([${code}], ${token.code[0]}, ${token.code[1]})`;
        } else if (['inflowfundef', 'inflowprocdef'].includes(token.type)) {
          code = `await builtins.funcall([${code}], [], ${token.code})`;
        } else if (['starinflowfundef', 'starinflowprocdef'].includes(token.type)) {
          code = `await builtins.starmap([${code}], ${token.code}, [])`;
        } else if (token.type == 'condmapper') {
          code = `await builtins.funcall([${code}], [], ${token.code})`
        } else if (token.type == 'starcondmapper') {
          code = `await builtins.starmap([${code}], ${token.code}, [])`
        } else {
          code = `await builtins.funcall([${code}], ${token.code[1]}, ${token.code[0]})`;
        }
      })
      return {
        code: code,
        vars: variables
      };
    },
    wrapped_flow: function (node) {
      var res = analyze(node.tokens[0]);
      return {
        code: res.code,
        vars: res.vars
      };
    },
    setter: function (node) {
      if (node.tokens[0].name == 'symbol') {
        var variable = `['${node.tokens[0].raw}']`;
      } else if (node.tokens[0].name == 'property_access') {
        var tokens = node.tokens[0].tokens.map(token => {
          token.raw = token.raw.replace(/'s?$/, '');
          if (token.raw == 'my') {
            token.raw = 'self'
          }
          return token.raw;
        });
        var first = tokens.shift()
        var code = `['${first}']`
        tokens.forEach(function (token) {
          variable = `${code}['${token}']`
        })
      }
      return {
        type: 'setter',
        code: variable
      };
    },
    mapper: function (node) {
      var func = node.tokens[0];
      func = analyze(func).code;
      var args = analyze(node.tokens.slice(1)).map(t => t.code);
      var args = `[${args.join(', ')}]`
      return {
        code: [func, args]
      };
    },
    naked_mapper: function (node) {
      var func = node.tokens[0];
      func = analyze(func).code;
      var args = '[]';
      return {
        code: [func, args]
      };
    },
    starmapper: function (node) {
      var func = node.tokens[0];
      func = analyze(func).code;
      var args = analyze(node.tokens.slice(1)).map(t => t.code);
      var args = `[${args.join(', ')}]`;
      return {
        code: [func, args],
        type: 'map'
      };
    },
    naked_star_mapper: function (node) {
      var func = node.tokens[0];
      func = analyze(func).code;
      var args = '[]';
      return {
        code: [func, args],
        type: 'map'
      };
    },
    return_mapper: function (node) {
      var func = node.tokens[0].raw;
      return {
        type: 'return'
      };
    },
    filter: function (node) {
      var arg = node.tokens[0].raw;
      var body = node.tokens[1];
      var block = {
        name: 'block',
        tokens: [body]
      }
      var func = {
        name: 'fundef',
        tokens: [
          {name: 'symbol', raw: ''}, // anonymous
          {name: 'symbol', raw: arg},
          block
        ]
      }
      funcode = analyze(func).code;
      return {
        code: funcode,
        type: 'filter'
      };
    },
    wrapped_math: function (node) {
      return analyze(node.tokens[0])
    },
    math: function (node) {
      const ops = {
        '*': 'builtins.mul', '^': 'builtins.pow', '/': 'builtins.div', '+': 'builtins.add', '-': 'builtins.dec', '%': 'builtins.mod'
      }
      var left = analyze(node.tokens[0].tokens[0]);
      var op = ops[node.tokens[0].tokens[1].raw];
      var right = analyze(node.tokens[0].tokens[2]);
      return {
        code: `builtins.funcall([${left.code}], [${right.code}], ${op})`,
        vars: (left.vars || []).concat(right.vars || [])
      };
    },
    decorated_fundef: function (node) {
      var func = analyze(node.tokens.pop());
      var code = [];
      while (node.tokens.length) {
        token = node.tokens.pop().tokens;
        token.shift(); // shift @
        var name = analyze(token.shift()).code;
        var args = analyze(token).map(t => t.code);
        args = args.join(', ')
        code.push(`builtins.decorate_function(${name}, [${args}], '${func.name}', ${func.overload}, scope)`);
      }
      code.unshift(func.code);
      code = code.join(';\n');
      return {
        code: code
      };
    },
    decorated_fundefif: function (node) {
      var func = analyze(node.tokens.pop());
      var code = [];
      while (node.tokens.length) {
        token = node.tokens.pop().tokens;
        token.shift(); // shift @
        var name = analyze(token.shift()).code;
        var args = analyze(token).map(t => t.code);
        args = args.join(', ')
        code.push(`builtins.decorate_function(${name}, [${args}], '${func.name}', ${func.overload}, scope)`);
      }
      code.unshift(func.code);
      code = code.join(';\n');
      return {
        code: code
      };
    },
    decorated_fundefof: function (node) {
      var func = analyze(node.tokens.pop());
      var code = [];
      while (node.tokens.length) {
        token = node.tokens.pop().tokens;
        token.shift(); // shift @
        var name = analyze(token.shift()).code;
        var args = analyze(token).map(t => t.code);
        args = args.join(', ')
        code.push(`builtins.decorate_function(${name}, [${args}], '${func.name}', ${func.overload}, scope)`);
      }
      code.unshift(func.code);
      code = code.join(';\n');
      return {
        code: code
      };
    },
    decorated_fundefifof: function (node) {
      var func = analyze(node.tokens.pop());
      var code = [];
      while (node.tokens.length) {
        token = node.tokens.pop().tokens;
        token.shift(); // shift @
        var name = analyze(token.shift()).code;
        var args = analyze(token).map(t => t.code);
        args = args.join(', ')
        code.push(`builtins.decorate_function(${name}, [${args}], '${func.name}', ${func.overload}, scope)`);
      }
      code.unshift(func.code);
      code = code.join(';\n');
      return {
        code: code
      };
    },
    typedef: function (node) {
      var type_name = node.tokens[0].raw;
      node.name = 'fundef';
      node.tokens[0].raw = 'init';
      var block = node.tokens.pop();
      var type_setter = {
        name: 'flow',
        tokens: [
          {name: 'string', raw: `'${type_name}'`},
          {name: 'setter', tokens: [
            {name: 'property_access', tokens: [
              {name: 'possesive', raw: 'my'},
              {name: 'symbol', raw: 'type'},
            ]}
          ]}
        ]
      }
      block.tokens.push(type_setter);
      block.tokens.push({name: 'symbol', raw: 'self'});
      node.tokens.push({name: 'symbol', raw: 'self'});
      node.tokens.push(block);
      var func = analyze(node);
      var code = `scope['${type_name}'] = (function(scope) {
        scope = Object.assign({}, scope);
        var init = ${func.code};
        return function (...args) {
          return init(...args, {});
        }
      })(scope)`
      return {
        code: code
      };
    },
    fundef: function (node) {
      var block = node.tokens.pop().tokens;
      var implicit_return = make_return(block.pop());
      block.push(implicit_return);
      var block_vars = [];
      var block = analyze(block).map(function (t) {
        if (t.vars) {
          t.vars.forEach(v => block_vars.push(v))
        }
        return t.code;
      }).join(';\n');
      /*if (block_vars.length > 0) {
        var variables = `var ${block_vars.join(', ')};`;
        var block = `${variables}\n${block}`;
      }*/
      var name = node.tokens.shift().raw;
      var args = node.tokens.map(t => t.raw).join(', ');
      var arg_names = node.tokens.map(t => `'${t.raw}'`).join(', ');
      if (name == '') {
        return {
          code: `(function (scope) {
            var func = builtins.lazy(async function(${args}) {
              var scope = Object.assign({}, func.frozenscope);
              var args_obj = {};
              var _arguments = arguments;
              [${arg_names}].forEach(function(arg, index) {
                  scope[arg] = _arguments[index]
              });
              ${block}
            }, true);
            func.frozenscope = Object.assign({}, scope);
            func.frozenscope['recall'] = func;
            return func;
          })(scope)`
        };
      }
      return {
        code: `builtins.define_function((function (scope) {
          var func = builtins.lazy(async function(${args}) {
            var scope = Object.assign({}, func.frozenscope);
            var args_obj = {};
            var _arguments = arguments;
            [${arg_names}].forEach(function(arg, index) {
                scope[arg] = _arguments[index]
            });
            ${block}
          }, true);
          func.frozenscope = Object.assign({}, scope);
          func.frozenscope['${name}'] = func;
          func.frozenscope['recall'] = func;
          return func;
        })(scope), '${name}', scope)`,
        name: name,
        overload: `'default'`
      };
    },
    fundefif: function (node) {
      var block = node.tokens.pop().tokens;
      var _ifs = node.tokens.pop();
      if (_ifs.name == 'symbol') {
        _ifs = [`'${_ifs.raw}'`]
      } else {
        _ifs = _ifs.tokens.map(t => `'${t.raw}'`)
      }
      var implicit_return = make_return(block.pop());
      block.push(implicit_return);
      var block_vars = [];
      var block = analyze(block).map(function (t) {
        if (t.vars) {
          t.vars.forEach(v => block_vars.push(v))
        }
        return t.code;
      }).join(';\n');
      var name = node.tokens.shift().raw;
      var args = node.tokens.map(t => t.raw).join(', ');
      var arg_names = node.tokens.map(t => `'${t.raw}'`).join(', ');
      return {
        code: `builtins.define_function((function (scope) {
          var func = builtins.lazy(async function(${args}) {
            var scope = Object.assign({}, func.frozenscope);
            var args_obj = {};
            var _arguments = arguments;
            [${arg_names}].forEach(function(arg, index) {
                scope[arg] = _arguments[index]
            });
            ${block}
          }, true);
          func.frozenscope = Object.assign({}, scope);
          func.frozenscope['${name}'] = func;
          func.frozenscope['self'] = func;
          func.overload = [${_ifs}];
          return func;
        })(scope), '${name}', scope)`,
        name: name,
        overload: `[${_ifs}]`
      };
    },
    fundefof: function (node) {
      var block = node.tokens.pop().tokens;
      var implicit_return = make_return(block.pop());
      block.push(implicit_return);
      var block_vars = [];
      var block = analyze(block).map(function (t) {
        if (t.vars) {
          t.vars.forEach(v => block_vars.push(v))
        }
        return t.code;
      }).join(';\n');
      var name = node.tokens.shift().raw;
      // now take the of method
      var overload = node.tokens.pop().tokens[0].raw;
      var args = node.tokens.map(t => t.raw).join(', ');
      var arg_names = [`'self'`, ...node.tokens.map(t => `'${t.raw}'`)].join(', ');
      return {
        code: `builtins.define_function((function (scope) {
          var func = builtins.lazy(async function(${args}) {
            var scope = Object.assign({}, func.frozenscope);
            var args_obj = {};
            var _arguments = arguments;
            [${arg_names}].forEach(function(arg, index) {
                scope[arg] = _arguments[index]
            });
            ${block}
          }, true);
          func.frozenscope = Object.assign({}, scope);
          func.frozenscope['${name}'] = func;
          func.frozenscope['self'] = func;
          func.overload = ['${overload}'];
          return func;
        })(scope), '${name}', scope)`,
        name: name,
        overload: `['${overload}']`
      };
    },
    fundefifof: function (node) {
      var block = node.tokens.pop().tokens;
      var implicit_return = make_return(block.pop());
      block.push(implicit_return);
      var block_vars = [];
      var block = analyze(block).map(function (t) {
        if (t.vars) {
          t.vars.forEach(v => block_vars.push(v))
        }
        return t.code;
      }).join(';\n');
      var name = node.tokens.shift().raw;
      // now take the of method
      var _of = node.tokens.pop().tokens[0].raw;
      var _ifs = node.tokens.pop();
      if (_ifs.name == 'symbol') {
        _ifs = [_ifs.raw]
      } else {
        _ifs = _ifs.tokens.map(t => t.raw)
      }
      var overload = [_of, ..._ifs].map(o => `'${o}'`).join(', ');
      var args = node.tokens.map(t => t.raw).join(', ');
      var arg_names = [`'self'`, ...node.tokens.map(t => `'${t.raw}'`)].join(', ');
      return {
        code: `builtins.define_function((function (scope) {
          var func = builtins.lazy(async function(${args}) {
            var scope = Object.assign({}, func.frozenscope);
            var args_obj = {};
            var _arguments = arguments;
            [${arg_names}].forEach(function(arg, index) {
                scope[arg] = _arguments[index]
            });
            ${block}
          }, true);
          func.frozenscope = Object.assign({}, scope);
          func.frozenscope['${name}'] = func;
          func.frozenscope['self'] = func;
          func.overload = [${overload}];
          return func;
        })(scope), '${name}', scope)`,
        name: name,
        overload: `[${overload}]`
      };
    },
    inflowprocdef: function (node) {
      node.tokens.unshift({name: 'symbol', raw: ''})
      node.name = 'procdef';
      var func_code = analyze(node).code;
      return {
        type: 'inflowprocdef',
        code: func_code
      }
    },
    starinflowprocdef: function (node) {
      node.tokens.unshift({name: 'symbol', raw: ''})
      node.name = 'procdef';
      var func_code = analyze(node).code;
      return {
        type: 'starinflowprocdef',
        code: func_code
      }
    },
    procdef: function (node) {
      var block = node.tokens.pop().tokens;
      var implicit_return = make_return(block.pop());
      block.push(implicit_return);
      var block_vars = [];
      var block = analyze(block).map(function (t) {
        if (t.vars) {
          t.vars.forEach(v => block_vars.push(v))
        }
        return t.code;
      }).join(';\n');
      /*if (block_vars.length > 0) {
        var variables = `var ${block_vars.join(', ')};`;
        var block = `${variables}\n${block}`;
      }*/
      var name = node.tokens.shift().raw;
      var args = node.tokens.map(t => t.raw).join(', ');
      var arg_names = node.tokens.map(t => `'${t.raw}'`).join(', ');
      if (name == '') {
        return {
          code: `function(${args}) {
              var args_obj = {};
              var _arguments = arguments;
              [${arg_names}].forEach(function (arg, index) {
                args_obj[arg] = _arguments[index]
              })
              scope = Object.assign(scope, args_obj);
              ${block}
            }`
        };
      }
      return {
        code: `scope['${name}'] = function(${args}) {
            var args_obj = {};
            var _arguments = arguments;
            [${arg_names}].forEach(function (arg, index) {
              args_obj[arg] = _arguments[index]
            })
            scope = Object.assign(scope, args_obj);
            ${block}
          }`
      };
    },
    empty_list: function (node) {
      return {
        code: `new builtins.Generator(
          (i, self) => self.data[i],
          [],
          self => self.data.length,
        )`
      };
    },
    condmapper: function (node) {
      var conditional = node.tokens[0];
      var tokens = conditional.tokens;
      var else_statement;
      if (tokens[tokens.length-1].name == 'else_block') {
        else_statement = tokens.pop();
      }

      function transform(expr) {
        if (expr.name == 'halfcmp') {
          expr.tokens.unshift({name: 'symbol', raw: '$in'});
          expr.name = 'cmpexpr';
        } else if (expr.name == 'if_fun_call') {
          expr.name = 'mapper';
          expr = {
            name: 'flow',
            tokens: [
              {name: 'symbol', raw: '$in'},
              expr
            ]
          }
        } else if (expr.name == 'symbol') {
          expr.name = 'naked_mapper';
          expr = {
            name: 'flow',
            tokens: [
              {name: 'symbol', raw: '$in'},
              expr
            ]
          }
        } else if (expr.name == 'flow') {
          // can be symbol, or if_fun_call
          var left = expr.tokens[0]
          if (left.name == 'if_fun_call') {
            expr.tokens[0].name = 'mapper'
          } else if (left.name == 'symbol') {
            expr.tokens[0] = {
              name: 'naked_mapper',
              tokens: [expr.tokens[0]]
            }
          } else {
            // error!
          }
          expr.tokens.unshift({name: 'symbol', raw: '$in'});
        } else if (expr.name == 'cmpexpr') {
          // can be symbol, flow, or if_fun_call
          var left = expr.tokens[0];
          if (['symbol', 'if_fun_call', 'flow'].includes(left.name)) {
            expr.tokens[0] = transform(left);
          } else {
            // error!
          }
        }
        return expr;
      }

      tokens = tokens.map(function (statement) {
        statement.tokens[0] = transform(statement.tokens[0]);
        return statement;
      });

      if (else_statement) {
        tokens.push(else_statement);
      }

      var fun_def = {
        name: 'fundef',
        tokens: [
          {name: 'symbol', raw: ''}, // function name, this is anonymous
          {name: 'symbol', raw: '$in'}, // variable name
          {
            name: 'block',
            tokens: [
              {
                name: 'conditional',
                tokens: tokens
              }
            ]
          }
        ]
      }

      var code = analyze(fun_def).code;
      return {
        code: `(${code})`,
        type: 'condmapper'
      };
    },
    starcondmapper: function (node) {
      node.name = 'condmapper';
      var result = analyze(node);
      result.type = 'starcondmapper';
      return result;
    },
    conditional: function (node) {
      var block_vars = [];
      var code = node.tokens.map(analyze).map(function (t) {
        if (t.vars) {
          t.vars.forEach(v => block_vars.push(v))
        }
        return t.code;
      }).join(' ');
      return {
        code: code,
        vars: block_vars
      };
    },
    if_statement: function (node) {
      var variables = [];
      var condition = analyze(node.tokens[0]);
      if (node.tokens[1].name != 'block') {
        node.tokens[1] = {
          name: 'block',
          tokens: [node.tokens[1]]
        }
      }
      var block = node.tokens[1].tokens.map(analyze).map(function (t) {
        if (t.vars) {
          t.vars.forEach(v => variables.push(v))
        }
        return t.code;
      }).join(';\n');
      if (condition.variables) {
        condition.variables.forEach(v => variables.push(v))
      }
      return {
        code: `if (await builtins.funcall([${condition.code}], [], builtins.bool)) {${block}}`,
        vars: variables
      };
    },
    elif_statement: function (node) {
      node.name = 'if_statement';
      var result = analyze(node);
      result.code = `else ${result.code}`;
      return result;
    },
    else_statement: function (node) {
      if (node.tokens[0].name != 'block') {
        node.tokens[0] = {
          name: 'block',
          tokens: [node.tokens[0]]
        }
      }
      block_vars = [];
      var block = analyze(node.tokens[0].tokens).map(function (t) {
        if (t.vars) {
          t.vars.forEach(v => block_vars.push(v))
        }
        return t.code;
      }).join(';\n');
      return {
        code: `else{${block}}`,
        vars: block_vars
      };
    },
  }

  function analyze(tree) {
    if (tree.constructor === Array) {
      var result = tree.map(function (node) {
        return analyzers[node.name](node);
      });
    } else {
      var result = analyzers[tree.name](tree);
    }
    return result;
  };

  tree = analyze(tree);
  var variables = [];
  tree.forEach(function(t){
    if (t.vars) {
      t.vars.forEach(function (v) {
        variables.push(v);
      })
    }
  })
  /*
  if (variables.length) {
    variables = variables.join(', ');
    variables = `var ${variables};`
  } else {
    variables = ''
  }*/
  var code = tree.map(t => t.code || t).join(';\n');

  var code = `module.exports = async function (scope, builtins) {
    ${code};
    return scope;
  };`

  return code;
}

module.exports = analyzer;
