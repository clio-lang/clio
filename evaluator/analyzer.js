const unescapeJs = require("unescape-js");

function analyzer(tree) {
  // OPTIMIZE: this function needs to be optimized

  function makeReturn(expr) {
    if (expr.name === "conditional") {
      // special cases like if/else
      // replace last node with return
      expr.tokens = expr.tokens.map(makeReturn);
      return expr;
    } else if (
      ["if_statement", "elif_statement", "else_statement"].includes(expr.name)
    ) {
      let block = expr.tokens[expr.tokens.length - 1];

      if (block.name !== "block") {
        block = {
          name: "block",
          tokens: [block]
        };
      }

      let lastExpr = block.tokens[block.tokens.length - 1];
      block.tokens[block.tokens.length - 1] = makeReturn(lastExpr);
      expr.tokens[expr.tokens.length - 1] = block;
      return expr;
    }
    return {
      name: "return",
      tokens: [expr]
    };
  }

  const analyzers = {
    return: function(node) {
      let code = analyze(node.tokens[0]).code;
      return {
        code: `return ${code}`
      };
    },
    number: function(node) {
      node.raw = node.raw.replace(/'/g, "");
      return {
        code: `${node.raw}`
      };
    },
    bool: function(node) {
      return {
        code: node.raw
      };
    },
    symbol: function(node) {
      return {
        code: `await builtins.funcall(['${node.raw}'], [scope], builtins.get_symbol, file, {index: ${node.index}, fn: '<get-symbol>'})`
      };
    },
    propertyAccess: function(node) {
      let first = analyze(node.tokens.shift()).code;
      let last = node.tokens.pop().raw;
      return {
        code: `(await builtins.get_property(${first}, "${last}"))`
      };
    },
    string: function(node) {
      return {
        code: `\`${unescapeJs(node.raw).slice(1, -1)}\``
      };
    },
    word: function(node) {
      return {
        code: `'${node.raw.slice(1)}'`
      };
    },
    atsign: function() {
      return { code: "(new builtins.AtSign(0))" };
    },
    atnumber: function(node) {
      return { code: `(new builtins.AtSign(${node.tokens[1].raw}))` };
    },
    notexpr: function(node) {
      let right = analyze(node.tokens[0]).code;
      return {
        code: `(builtins.funcall([${right}], [], builtins.not, file, {index: ${node.index}, fn: '<not>'}))`
      };
    },
    and_or_expr: function(node) {
      let tokens = analyze(node.tokens);
      let left = tokens[0].code.replace(/ *;+ *$/, "");
      let right = tokens[2].code.replace(/ *;+ *$/, "");
      let cmp = tokens[1];
      return {
        code: `((${left}) ${cmp} (${right}))`
      };
    },
    wrappedNot: function(node) {
      return analyze(node.tokens[0]);
    },
    wrapped_and_or: function(node) {
      return analyze(node.tokens[0]);
    },
    or: function() {
      return "||";
    },
    and: function() {
      return "&&";
    },
    not: function() {
      return "!";
    },
    list: function(node) {
      let inner = node.tokens
        .map(function(token) {
          return analyze(token).code;
        })
        .join(", ");
      let list = `[${inner}]`;
      return {
        code: list
      };
    },
    hash_map: function(node) {
      // TODO: for now, we're using native json
      //       however, we need to support clio types
      let pairs = [];
      let key, val;
      for (let i = 0; i < node.tokens.length / 2; i++) {
        key = analyze(node.tokens[i * 2]);
        val = analyze(node.tokens[i * 2 + 1]);
        pairs.push(`${key.code}: ${val.code}`);
      }
      let code = pairs.join(", ");
      code = `{${code}}`;
      return {
        code: code
      };
    },
    range: function(node) {
      var start = node.tokens[0].tokens.length
        ? node.tokens[0].tokens[0]
        : { name: "number", raw: "0" };
      var end =
        node.tokens.length > 1
          ? node.tokens[1]
          : { name: "number", raw: "Infinity" };

      var start = analyze(start).code;
      var end = analyze(end).code;
      let step = `(${start} < ${end} ? 1 : -1)`;

      return {
        code: `new builtins.Range(${start}, ${end}, ${step})`
      };
    },
    stepped_range: function(node) {
      var start = node.tokens[0].tokens.length
        ? node.tokens[0].tokens[0]
        : { name: "number", raw: "0" };
      var end =
        node.tokens.length > 2
          ? node.tokens[1]
          : { name: "number", raw: "Infinity" };
      var step = node.tokens[node.tokens.length > 2 ? 2 : 1];
      var start = analyze(start).code;
      var end = analyze(end).code;
      var step = analyze(step).code;
      return {
        code: `new builtins.Range(${start}, ${end}, ${step})`
      };
    },
    slice: function(node) {
      let list = analyze(node.tokens.shift());
      var slicers = node.tokens.pop();
      let index = slicers.index;
      var slicers = slicers.tokens;
      var slicers = analyze(slicers)
        .map(s => s.code)
        .join(", ");
      return {
        code: `builtins.funcall([${list.code}], [[${slicers}], 0], builtins.slice, file, {index: ${index}, fn: 'builtins.slice'})`
      };
    },
    comparison: function(node) {
      return node.raw;
    },
    cmpexpr: function(node) {
      let tokens = analyze(node.tokens);
      let left = tokens[0];
      let right = tokens[2];
      let cmp = tokens[1];
      const funcs = {
        "=": "builtins.eq",
        ">": "builtins.gt",
        ">=": "builtins.gte",
        "<": "builtins.lt",
        "<=": "builtins.lte"
      };
      let func = funcs[cmp];
      return {
        code: `await builtins.funcall([${left.code}], [${right.code}], ${func}, file, {index: ${node.index}, fn: '${func}'})`
      };
    },
    import_st: function(node) {
      let names_to_import = node.tokens.slice(0, -1).map(t => t.raw);
      let from = node.tokens[node.tokens.length - 1].tokens[0];
      if (from.name == "url") {
        if (from.raw.startsWith("http")) {
          var code = names_to_import
            .map(function(symbol) {
              return `scope['${symbol}'] = builtins.lazy(function (...args) {
              return builtins.http_call('${from.raw}', '${symbol}', args, {});
            });`;
            })
            .join(";\n");
        } else {
          let conn = `await builtins.setup_ws(ws_connections, '${from.raw}')`;
          // it may not be a function, this should be considered!
          var code = names_to_import
            .map(function(symbol) {
              return `scope['${symbol}'] = await builtins.ws_get(ws_connections['${from.raw}'], '${symbol}');`;
            })
            .join(";\n");
          code = `${conn};${code}`;
        }
      } else {
        let stringified_names_to_import = names_to_import
          .map(a => `'${a}'`)
          .join(", ");
        var code = `await builtins.clio_require('${from.raw}', [${stringified_names_to_import}], __dirname, scope)`;
      }
      return { code: code };
    },
    import_nk: function(node) {
      let imports = node.tokens.map(function(mod) {
        if (mod.name == "property_access") {
          mod.raw = mod.tokens.map(t => t.raw).join(".");
        }
        return `await builtins.clio_require('${mod.raw}', [], __dirname, scope)`;
      });
      return {
        code: imports.join(";\n")
      };
    },
    import_path: function(node) {
      let imports = node.tokens.map(function(mod) {
        return `await builtins.clio_require('${mod.raw}', [], __dirname, scope)`;
      });
      return {
        code: imports.join(";\n")
      };
    },
    wrapped_quickfundef: function(node) {
      return analyze(node.tokens[0]);
    },
    wrapped_cmpexpr: function(node) {
      return analyze(node.tokens[0]);
    },
    quickfundef: function(node) {
      node.tokens.unshift({ name: "symbol", raw: "" });
      node.name = "fundef";
      node.tokens[2] = {
        name: "block",
        tokens: [node.tokens[2]]
      };
      let func_code = analyze(node).code;
      return {
        code: func_code
      };
    },
    inflowfundef: function(node) {
      node.tokens.unshift({ name: "symbol", raw: "" });
      node.name = "fundef";
      let func_code = analyze(node).code;
      return {
        type: "inflowfundef",
        code: func_code
      };
    },
    decorated_inflowfundef: function(node) {
      let block = node.tokens.pop();
      let arg = node.tokens.pop();
      let func = analyze({
        name: "inflowfundef",
        tokens: [arg, block]
      });
      let code = func.code;
      while (node.tokens.length) {
        token = node.tokens.pop().tokens.pop().tokens;
        token.shift(); // shift @
        let name = analyze(token.shift()).code;
        let args = analyze(token).map(t => t.code);
        args = args.join(", ");
        code = `builtins.decorate_function(${name}, [${args}], ${code}, '', scope)`;
      }
      return {
        code: code,
        type: func.type
      };
    },
    starinflowfundef: function(node) {
      node.tokens.unshift({ name: "symbol", raw: "" });
      let fnindex = node.tokens[1].index;
      node.name = "fundef";
      let func_code = analyze(node).code;
      return {
        type: "starinflowfundef",
        code: func_code,
        fnindex: fnindex
      };
    },
    decorated_starinflowfundef: function(node) {
      let block = node.tokens.pop();
      let arg = node.tokens.pop();
      let func = analyze({
        name: "starinflowfundef",
        tokens: [arg, block]
      });
      let code = func.code;
      while (node.tokens.length) {
        token = node.tokens.pop().tokens.pop().tokens;
        token.shift(); // shift @
        let name = analyze(token.shift()).code;
        let args = analyze(token).map(t => t.code);
        args = args.join(", ");
        code = `builtins.decorate_function(${name}, [${args}], ${code}, '', scope)`;
      }
      return {
        code: code,
        type: func.type
      };
    },
    star_transform: function(node) {
      let transform = node.tokens[0].tokens[1];
      transform.tokens[0] = { name: "symbol", raw: "" };
      transform.name = "fundef";
      if (transform.tokens[1].name == "atnum_as") {
        var index = transform.tokens[1].tokens[0].tokens[1].raw;
        transform.tokens[1] = {
          name: "symbol",
          raw: transform.tokens[1].tokens[1].raw
        };
      } else {
        var index = "0";
      }
      transform.tokens[2] = {
        name: "block",
        tokens: [transform.tokens[2]]
      };
      let func_code = analyze(transform).code;
      return {
        code: `(new builtins.Transform(${func_code}, ${index}, true))`
      };
    },
    transform: function(node) {
      let transform = node.tokens[0];
      transform.tokens[0] = { name: "symbol", raw: "" };
      transform.name = "fundef";
      if (transform.tokens[1].name == "atnum_as") {
        var index = transform.tokens[1].tokens[0].tokens[1].raw;
        transform.tokens[1] = {
          name: "symbol",
          raw: transform.tokens[1].tokens[1].raw
        };
      } else {
        var index = "0";
      }
      if (transform.tokens[2].name == "symbol") {
        // convert to flow
        let data = transform.tokens[1];
        let fn = transform.tokens[2];
        let flow = {
          name: "flow",
          tokens: [data, { name: "naked_mapper", tokens: [fn] }]
        };
        transform.tokens[2] = flow;
      }
      transform.tokens[2] = {
        name: "block",
        tokens: [transform.tokens[2]]
      };
      let func_code = analyze(transform).code;
      return {
        code: `(new builtins.Transform(${func_code}, ${index}, false))`
      };
    },
    event: function(node) {
      let ee = analyze(node.tokens[0]).code;
      let ev = analyze(node.tokens[1]).code;
      return {
        code: `(new builtins.EventListener(${ee}, ${ev}))`
      };
    },
    async_flow: function(node) {
      let flow = analyze(node.tokens[0]);
      flow.code = flow.code.replace(/^await /, "");
      return flow;
    },
    flow: function(node) {
      let tokens = analyze(node.tokens);
      let data = [];
      let function_calls = [
        "setter",
        "mapper",
        "starmapper",
        "naked_mapper",
        "naked_star_mapper",
        "filter",
        "starinflowfundef",
        "inflowfundef",
        "condmapper",
        "decorated_starinflowfundef",
        "starcondmapper",
        "quickfundef",
        "starquickfundef",
        "return_mapper",
        "fundef",
        "decorated_inflowfundef"
      ]; // fix this list
      let i = 0;
      while (!function_calls.includes(node.tokens[i++].name)) {
        data.push(tokens.shift());
      }
      data = data.map(d => d.code).join(", ");
      let code = `...__data`;
      let variables = [];
      tokens.forEach(function(token) {
        if (token.type == "setter") {
          code = `(await builtins.update_vars(scope, ${token.code}, ${code}))`;
          variables.push(token.code);
        } else if (token.type == "filter") {
          code = `await builtins.filter([${code}], ${token.code})`;
        } else if (token.type == "return") {
          code = `return await ${code};`;
        } else if (token.type == "map") {
          code = `await builtins.starmap([${code}], ${token.code[0]}, ${token.code[1]}, file, {index: ${token.fnindex}, fn: '${token.fn}'})`;
        } else if (["inflowfundef"].includes(token.type)) {
          code = `await builtins.funcall([${code}], [], ${token.code}, file, {index: ${node.index}, fn: '<anonymous-fn>'})`;
        } else if (["starinflowfundef"].includes(token.type)) {
          code = `await builtins.starmap([${code}], ${token.code}, [], file, {index: ${token.fnindex}, fn: '<anonymous-fn>'})`;
        } else if (token.type == "condmapper") {
          code = `await builtins.funcall([${code}], [], ${token.code}, file, {index: ${node.index}, fn: '<conditional>'})`;
        } else if (token.type == "starcondmapper") {
          code = `await builtins.starmap([${code}], ${token.code}, [], file, {index: ${token.fnindex}, fn: '${token.fn}'})`;
        } else {
          code = `await builtins.funcall([${code}], ${token.code[1]}, ${token.code[0]}, file, {index: ${token.fnindex}, fn: '${token.fn}'})`;
        }
      });
      code = `await (async function(__data) {
        var fn = async function (__data) {
          return ${code}
        }
        if (__data[0].isReactive) {
          return __data[0].setListener(function (n) {
            return fn([n, ...__data.slice(1)])
          })
        } else {
          return await fn(__data)
        }
      })([${data}])`;
      return {
        code: code,
        vars: variables
      };
    },
    wrapped_flow: function(node) {
      let res = analyze(node.tokens[0]);
      return {
        code: res.code,
        vars: res.vars
      };
    },
    setter: function(node) {
      if (node.tokens[0].name == "symbol") {
        var variable = `['${node.tokens[0].raw}']`;
      } else if (node.tokens[0].name == "property_access") {
        let tokens = node.tokens[0].tokens.map(token => `"${token.raw}"`);
        variable = `[${tokens.join(", ")}]`;
      }
      return {
        type: "setter",
        code: variable
      };
    },
    mapper: function(node) {
      let func = node.tokens[0];
      let fn = func.raw;
      let fnindex = func.index;
      func = analyze(func).code;
      var args = analyze(node.tokens.slice(1)).map(t => t.code);
      var args = `[${args.join(", ")}]`;
      return {
        code: [func, args],
        fn: fn,
        fnindex: fnindex
      };
    },
    naked_mapper: function(node) {
      let func = node.tokens[0];
      if (func.name == "halfnot") {
        func.raw = "not";
        func.name = "symbol";
      }
      let fn = func.raw;
      let fnindex = func.index;
      func = analyze(func).code;
      let args = "[]";
      return {
        code: [func, args],
        fn: fn,
        fnindex: fnindex
      };
    },
    starmapper: function(node) {
      let func = node.tokens[0];
      let fn = func.raw;
      let fnindex = func.index;
      func = analyze(func).code;
      var args = analyze(node.tokens.slice(1)).map(t => t.code);
      var args = `[${args.join(", ")}]`;
      return {
        code: [func, args],
        type: "map",
        fn: fn,
        fnindex: fnindex
      };
    },
    naked_star_mapper: function(node) {
      let func = node.tokens[0];
      if (func.name == "halfnot") {
        func.raw = "not";
        func.name = "symbol";
      }
      let fn = func.raw;
      let fnindex = func.index;
      func = analyze(func).code;
      let args = "[]";
      return {
        code: [func, args],
        type: "map",
        fn: fn,
        fnindex: fnindex
      };
    },
    return_mapper: function(node) {
      return {
        type: "return"
      };
    },
    filter: function(node) {
      let arg = node.tokens[0].raw;
      let body = node.tokens[1];
      let block = {
        name: "block",
        tokens: [body]
      };
      let func = {
        name: "fundef",
        tokens: [
          { name: "symbol", raw: "" }, // anonymous
          { name: "symbol", raw: arg },
          block
        ]
      };
      funcode = analyze(func).code;
      return {
        code: funcode,
        type: "filter"
      };
    },
    wrapped_math: function(node) {
      return analyze(node.tokens[0]);
    },
    math: function(node) {
      const ops = {
        "*": "builtins.mul",
        "^": "builtins.pow",
        "/": "builtins.div",
        "+": "builtins.add",
        "-": "builtins.dec",
        "%": "builtins.mod"
      };
      let left = analyze(node.tokens[0].tokens[0]);
      let op = ops[node.tokens[0].tokens[1].raw];
      let right = analyze(node.tokens[0].tokens[2]);
      return {
        code: `builtins.funcall([${left.code}], [${right.code}], ${op}, file, {index: ${node.index}, fn: '${op}'})`,
        vars: (left.vars || []).concat(right.vars || [])
      };
    },
    decorated_fundef: function(node) {
      let func = analyze(node.tokens.pop());
      let code = [];
      while (node.tokens.length) {
        token = node.tokens.pop().tokens;
        token.shift(); // shift @
        let name = analyze(token.shift()).code;
        let args = analyze(token).map(t => t.code);
        args = args.join(", ");
        code.push(
          `builtins.decorate_function(${name}, [${args}], '${func.name}', scope)`
        );
      }
      code.unshift(func.code);
      code = code.join(";\n");
      return {
        code: code
      };
    },
    fundef: function(node) {
      var block = node.tokens.pop().tokens;
      let implicit_return = makeReturn(block.pop());
      block.push(implicit_return);
      let block_vars = [];
      var block = analyze(block)
        .map(function(t) {
          if (t.vars) {
            t.vars.forEach(v => block_vars.push(v));
          }
          return t.code;
        })
        .join(";\n");
      let name = node.tokens.shift().raw;
      let args = node.tokens.map(t => t.raw).join(", ");
      let arg_names = node.tokens.map(t => `'${t.raw}'`).join(", ");
      if (name == "") {
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
            func.frozenscope.recall = func;
            func.frozenscope.is_clio_fn = true;
            func.is_clio_fn = true;
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
          func.frozenscope.recall = func;
          func.frozenscope.${name} = func;
          func.frozenscope.is_clio_fn = true;
          func.is_clio_fn = true;
          return func;
        })(scope), '${name}', scope)`,
        name: name
      };
    },
    empty_list: function() {
      return {
        code: `[]`
      };
    },
    condmapper: function(node) {
      let conditional = node.tokens[0];
      let tokens = conditional.tokens;
      let else_statement;
      if (tokens[tokens.length - 1].name == "else_block") {
        else_statement = tokens.pop();
      }

      function transform(expr) {
        if (expr.name == "halfcmp") {
          expr.tokens.unshift({ name: "symbol", raw: "$in" });
          expr.name = "cmpexpr";
        } else if (expr.name == "halfnot") {
          expr.tokens = [{ name: "symbol", raw: "$in" }];
          expr.name = "notexpr";
        } else if (expr.name == "if_fun_call") {
          expr.name = "mapper";
          expr = {
            name: "flow",
            tokens: [{ name: "symbol", raw: "$in" }, expr]
          };
        } else if (expr.name == "symbol") {
          expr.name = "naked_mapper";
          expr = {
            name: "flow",
            tokens: [{ name: "symbol", raw: "$in" }, expr]
          };
        } else if (expr.name == "flow") {
          // can be symbol, or if_fun_call
          var left = expr.tokens[0];
          if (left.name == "if_fun_call") {
            expr.tokens[0].name = "mapper";
          } else if (left.name == "symbol") {
            expr.tokens[0] = {
              name: "naked_mapper",
              tokens: [expr.tokens[0]]
            };
          } else {
            // error!
          }
          expr.tokens.unshift({ name: "symbol", raw: "$in" });
        } else if (expr.name == "cmpexpr") {
          // can be symbol, flow, or if_fun_call
          var left = expr.tokens[0];
          if (["symbol", "if_fun_call", "flow"].includes(left.name)) {
            expr.tokens[0] = transform(left);
          } else {
            // error!
          }
        }
        return expr;
      }

      tokens = tokens.map(function(statement) {
        statement.tokens[0] = transform(statement.tokens[0]);
        return statement;
      });

      if (else_statement) {
        tokens.push(else_statement);
      }

      let fun_def = {
        name: "fundef",
        tokens: [
          { name: "symbol", raw: "" }, // function name, this is anonymous
          { name: "symbol", raw: "$in" }, // variable name
          {
            name: "block",
            tokens: [
              {
                name: "conditional",
                tokens: tokens
              }
            ]
          }
        ]
      };

      let code = analyze(fun_def).code;
      return {
        code: `(${code})`,
        type: "condmapper"
      };
    },
    starcondmapper: function(node) {
      node.name = "condmapper";
      let result = analyze(node);
      result.type = "starcondmapper";
      return result;
    },
    conditional: function(node) {
      let block_vars = [];
      let code = node.tokens
        .map(analyze)
        .map(function(t) {
          if (t.vars) {
            t.vars.forEach(v => block_vars.push(v));
          }
          return t.code;
        })
        .join(" ");
      return {
        code: code,
        vars: block_vars
      };
    },
    if_statement: function(node) {
      let variables = [];
      let condition = analyze(node.tokens[0]);
      if (node.tokens[1].name != "block") {
        node.tokens[1] = {
          name: "block",
          tokens: [node.tokens[1]]
        };
      }
      let block = node.tokens[1].tokens
        .map(analyze)
        .map(function(t) {
          if (t.vars) {
            t.vars.forEach(v => variables.push(v));
          }
          return t.code;
        })
        .join(";\n");
      if (condition.variables) {
        condition.variables.forEach(v => variables.push(v));
      }
      return {
        code: `if (await builtins.funcall([${condition.code}], [], builtins.bool, file, {index: ${node.index}, fn: '<conditional>'})) {${block}}`,
        vars: variables
      };
    },
    elif_statement: function(node) {
      node.name = "if_statement";
      let result = analyze(node);
      result.code = `else ${result.code}`;
      return result;
    },
    else_statement: function(node) {
      if (node.tokens[0].name != "block") {
        node.tokens[0] = {
          name: "block",
          tokens: [node.tokens[0]]
        };
      }
      block_vars = [];
      let block = analyze(node.tokens[0].tokens)
        .map(function(t) {
          if (t.vars) {
            t.vars.forEach(v => block_vars.push(v));
          }
          return t.code;
        })
        .join(";\n");
      return {
        code: `else{${block}}`,
        vars: block_vars
      };
    }
  };

  function analyze(tree) {
    if (tree.constructor === Array) {
      var result = tree.map(function(node) {
        let result = analyzers[node.name](node);
        result.index = result.index || node.index;
        return result;
      });
    } else {
      var result = analyzers[tree.name](tree);
      result.index = result.index || tree.index;
    }
    return result;
  }

  tree = analyze(tree);
  let variables = [];
  tree.forEach(function(t) {
    if (t.vars) {
      t.vars.forEach(function(v) {
        variables.push(v);
      });
    }
  });
  /*
  if (variables.length) {
    variables = variables.join(', ');
    variables = `var ${variables};`
  } else {
    variables = ''
  }*/
  var code = tree.map(t => t.code || t).join(";\n");

  var code = `module.exports = async function (scope, builtins, file) {
    var ws_connections = [];
    ${code};
    scope.clio_ws_connections = ws_connections;
    return scope;
  };`;

  /*
    for (var server in ws_connections) {
      if (ws_connections.hasOwnProperty(server)) {
          if (Object.keys(ws_connections[server].emitters).length == 0) {
              ws_connections[server].socket.close()
          }
      }
    }
  */

  return code;
}

module.exports = analyzer;
