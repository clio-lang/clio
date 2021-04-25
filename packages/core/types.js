const { mapfn, map, bean } = require("bean-parser");
const { SourceNode } = require("source-map");
const rules = require("./rules");

const join = (arr, sep) => new SourceNode(null, null, null, arr).join(sep);
const asIs = (token) =>
  new SourceNode(token.line, token.column, token.file, token.value);

const conditionals = ["fullConditional", "conditional"];

const checkLambda = (node, body, getValue) => {
  if (node.lambda?.length)
    return get({ type: "lambda", body, params: node.lambda });
  return getValue ? get(node) : node;
};

const getCallFn = (node) => {
  if (node.fn.type == "method") {
    if (!node.isMap)
      return {
        type: "propertyAccess",
        lhs: node.args.shift(),
        dot: node.fn.dot,
        rhs: node.fn.property,
      };
    if (node.args.length > 1)
      return {
        type: "propertyAccess",
        lhs: { type: "symbol", value: "$item" },
        dot: node.fn.dot,
        rhs: node.fn.property,
        dropData: true,
        dropMeta: true,
      };
    return {
      type: "wrapped",
      start: { value: "(" },
      end: { value: ")" },
      content: {
        type: "function",
        start: node.fn,
        noParallel: true,
        name: "",
        needsAsync: node.needsAsync,
        params: [get({ type: "symbol", value: "$item" })],
        body: get({
          type: "return",
          content: [
            {
              type: "call",
              fn: {
                type: "propertyAccess",
                lhs: { type: "symbol", value: "$item" },
                dot: node.fn.dot,
                rhs: node.fn.property,
              },
              args: [],
            },
          ],
        }),
      },
    };
  }
  return node.fn;
};

const types = {
  symbol(node) {
    return asIs(node);
  },
  number(node) {
    return new SourceNode(
      node.line,
      node.column,
      node.file,
      node.value.replace(/_/g, "")
    );
  },
  awaited(node) {
    const value = node.all
      ? ["Promise.all(", get(node.value), ")"]
      : [get(node.value)];
    if (node.await.value.startsWith("["))
      node.await.value = node.await.value.slice(1, -1);
    const sn = new SourceNode(
      node.await.line,
      node.await.column,
      node.await.file,
      ["(", asIs(node.await), " ", ...value, ")"]
    );
    sn.needsAsync = true;
    return sn;
  },
  mapCall(node) {
    const { awaited, all } = node;
    const fn = getCallFn(node);
    const args = node.args.map((arg) => checkLambda(arg, get(arg), true));
    const insertBefore = args.map((arg) => arg.insertBefore).filter(Boolean);
    const data = args.shift();
    const needsAsync = data.needsAsync || args.some((arg) => arg.needsAsync);
    let func;
    if (args.length) {
      func = new SourceNode(null, null, null, [
        needsAsync ? "async " : "",
        "($item",
        fn.dropMeta ? ")=>" : ", $index, $iterator)=>",
        checkLambda(fn, get(fn), true),
        fn.dropData ? "(" : "($item,",
        join(args, ","),
        fn.dropMeta ? ")" : ",$index,$iterator)",
      ]);
    } else {
      func = checkLambda(fn, get(fn), true);
    }
    let sn = new SourceNode(fn.line, fn.column, fn.file, [
      data,
      ".",
      "map",
      "(",
      func,
      ")",
    ]);
    if (awaited) {
      const value = all ? ["Promise.all(", sn, ")"] : [sn];
      if (node.await.value.startsWith("["))
        node.await.value = node.await.value.slice(1, -1);
      sn = new SourceNode(node.await.line, node.await.column, node.await.file, [
        "(",
        asIs(node.await),
        " ",
        ...value,
        ")",
      ]);
    }
    if (insertBefore.length) sn.insertBefore = insertBefore;
    sn.needsAsync =
      awaited || data.needsAsync || args.some((arg) => arg.needsAsync);
    return sn;
  },
  call(node) {
    if (node.isMap) {
      node.type = "mapCall";
      return get(node);
    }
    const { awaited, all } = node;
    const fn = getCallFn(node);
    const args = node.args.map((arg) => checkLambda(arg, get(arg), true));
    const insertBefore = args.map((arg) => arg.insertBefore).filter(Boolean);
    let sn = new SourceNode(fn.line, fn.column, fn.file, [
      checkLambda(fn, get(fn), true),
      "(",
      join(args, ","),
      ")",
    ]);
    if (awaited) {
      const value = all ? ["Promise.all(", sn, ")"] : [sn];
      if (node.await.value.startsWith("["))
        node.await.value = node.await.value.slice(1, -1);
      sn = new SourceNode(node.await.line, node.await.column, node.await.file, [
        "(",
        asIs(node.await),
        " ",
        ...value,
        ")",
      ]);
    }
    if (insertBefore.length) sn.insertBefore = insertBefore;
    sn.needsAsync = awaited || args.some((arg) => arg.needsAsync);
    return sn;
  },
  ...mapfn(["add", "mul", "div", "sub", "mod", "pow"], (key) => [
    key,
    (node) => {
      const { op, lhs, rhs } = node;
      return new SourceNode(null, null, null, [
        lhs,
        new SourceNode(op.line, op.column, op.file, op.value),
        rhs,
      ]);
    },
  ]),
  math(node) {
    return node.value;
  },
  block(node) {
    const content = node.content
      .map(get)
      .map((node) => [node.insertBefore, node])
      .flat()
      .filter(Boolean);
    const sn = new SourceNode(null, null, null, [
      new SourceNode(null, null, null, content).join(";"),
    ]);
    sn.needsAsync = content.some((item) => item.needsAsync);
    return sn;
  },
  return(node) {
    let lastNode = node.content.pop();
    let addReturn = true;
    const content = node.content
      .map(get)
      .map((node) => [node.insertBefore, node])
      .flat()
      .filter(Boolean);
    if (conditionals.includes(lastNode.type)) {
      lastNode.if.body.type = "return";
      lastNode.elseIfs.map((elseIf) => (elseIf.body.type = "return"));
      if (lastNode.else) lastNode.else.body.type = "return";
      addReturn = false;
    } else if (lastNode.type == "assignment") {
      if (lastNode.value.insertBefore)
        content.push(lastNode.value.insertBefore);
      content.push(get(lastNode));
      lastNode = lastNode.name;
    }
    let last = lastNode.type
      ? lastNode.lambda?.length
        ? checkLambda(lastNode, get(lastNode))
        : get(lastNode)
      : lastNode;
    if (last.returnAs) last = last.returnAs;
    const sn = new SourceNode(null, null, null, [
      new SourceNode(null, null, null, content).join(";"),
      ...(content.length ? [";"] : []),
      ...(last.insertBefore ? [last.insertBefore, ";"] : []),
      ...(addReturn ? ["return "] : []),
      last,
    ]);
    sn.needsAsync = last.needsAsync || content.some((item) => item.needsAsync);
    return sn;
  },
  function(node) {
    const { start, name, params, body } = node;
    const man = node.man ? [`;`, name, ".__man__=`", asIs(node.man), "`"] : [];
    const sn = new SourceNode(start.line, start.column, start.file, [
      ...(name ? ["const ", name, "="] : []),
      ...(name ? ["register"] : []),
      "(",
      ...(name ? ["`", start.file, "/", name, "`,"] : []),
      node.body.needsAsync ? "async" : "",
      "(",
      new SourceNode(null, null, null, params).join(","),
      ")=>",
      "{",
      body,
      "})",
      ...man,
    ]);
    sn.needsAsync = false;
    sn.returnAs = new SourceNode(null, null, null, name);
    sn.returnAs.insertBefore = sn;
    return sn;
  },
  exportedFunction(node) {
    const fn = get(node.value);
    const sn = new SourceNode(
      node.export.line,
      node.export.column,
      node.export.file,
      ["clio.exports.", node.name, "=", node.name]
    );
    sn.insertBefore = [fn.insertBefore, fn].filter(Boolean);
    return sn;
  },
  exported(node) {
    const value = get(node.value);
    const sn = new SourceNode(
      node.export.line,
      node.export.column,
      node.export.file,
      ["clio.exports.", get(node.name), "=", get(node.name)]
    );
    sn.insertBefore = [value.insertBefore, value].filter(Boolean);
    return sn;
  },
  imported(node) {
    /* each import has 2 parts:
        1. import
        2. assign
    */
    const path = node.path.value.slice(1, -1).replace(/^[^:]*:/, "");
    const name = path
      .replace(/\.[^.]*$/, "")
      .split("/")
      .pop()
      .split(".")
      .filter(Boolean)
      .map((v, i) =>
        i > 0 /* istanbul ignore next */ ? v[0].toUpperCase() + v.slice(1) : v
      )
      .join("");
    const protocol =
      node.path.value.slice(1, -1).match(/^[^:]*(?=:)/)?.[0] || "clio";
    let require;
    /* We are clearly testing these in our unit tests,
       yet istanbul considers them untested branches,
       I have no idea why, I disabled istanbul checks
       here until I figure out why? */
    if (protocol == "js") {
      require = new SourceNode(
        node.import.line,
        node.import.column,
        node.import.file,
        ["require(", '"', path, '")']
      );
    } /* istanbul ignore next */ else if (protocol == "clio") {
      require = new SourceNode(
        node.import.line,
        node.import.column,
        node.import.file,
        [
          "await require(",
          '"',
          path + (path.endsWith(".clio") ? ".js" : ".clio.js"),
          '").exports(clio)',
        ]
      );
    }
    let assign;
    if (!node.items) {
      assign = new SourceNode(null, null, null, ["const ", name, "="]);
    } else {
      let parts = [];
      let rest;
      for (const part of node.items) {
        if (part.type == "symbol") {
          parts.push(get(part));
        } else if (part.lhs.type == "symbol") {
          parts.push(
            new SourceNode(part.as.line, part.as.column, part.as.file, [
              get(part.lhs),
              ":",
              get(part.rhs),
            ])
          );
        } else {
          rest = new SourceNode(part.as.line, part.as.column, part.as.file, [
            "...",
            get(part.rhs),
          ]);
        }
      }
      if (rest) parts.push(rest);
      assign = new SourceNode(null, null, null, [
        "const{",
        new SourceNode(null, null, null, parts).join(","),
        "}=",
      ]);
    }
    return new SourceNode(null, null, null, [assign, require]);
  },
  lambda(node) {
    const { body } = node;
    const params = [];
    const added = new Set();
    for (const param of node.params) {
      if (!added.has(param.value)) {
        added.add(param.value);
        params.push(get(param));
      }
    }
    const start = node.params[0];
    return new SourceNode(start.line, start.column, start.file, [
      "(",
      /* istanbul ignore next */
      body.needsAsync ? "async " : "",
      "(",
      new SourceNode(null, null, null, params).join(","),
      ")",
      "=>",
      body,
      ")",
    ]);
  },
  parallelFn(node) {
    const { start, fn } = node;
    return new SourceNode(start.line, start.column, start.file, [
      fn,
      ".parallel",
    ]);
  },
  comparison(node) {
    const nodes = [];
    const first = node.comparisons.shift();
    let needsAsync = node.lhs.needsAsync;
    nodes.push(
      "(",
      node.lhs,
      new SourceNode(
        first.op.line,
        first.op.column,
        first.op.file,
        first.op.value
      ),
      first.rhs,
      ")"
    );
    let lhs = first.rhs;
    for (const { op, rhs } of node.comparisons) {
      needsAsync = needsAsync || lhs.needsAsync;
      nodes.push(
        "&&",
        "(",
        lhs,
        new SourceNode(op.line, op.column, op.file, op.value),
        rhs,
        ")"
      );
      lhs = rhs;
    }
    const sn = new SourceNode(null, null, null, nodes);
    sn.needsAsync = needsAsync;
    sn.lambda = node.lambda;
    return sn;
  },
  logicalNot(node) {
    const { rhs, op } = node;
    const sn = new SourceNode(op.line, op.column, op.file, [
      new SourceNode(op.line, op.column, op.file, "!"),
      "(",
      rhs,
      ")",
    ]);
    sn.needsAsync = rhs.needsAsync;
    return sn;
  },
  logical(node) {
    const { lhs, logicals } = node;
    const parts = [
      "(",
      lhs,
      ")",
      ...logicals
        .map(({ op, rhs }) => [
          new SourceNode(
            op.line,
            op.column,
            op.file,
            op.value == "and" ? "&&" : "||"
          ),
          "(",
          rhs,
          ")",
        ])
        .flat(),
    ];
    const sn = new SourceNode(null, null, null, parts);
    sn.needsAsync =
      lhs.needsAsync || logicals.some(({ rhs }) => rhs.needsAsync);
    return sn;
  },
  ifBlock(node) {
    const { start, condition } = node;
    const body = get(node.body);
    const sn = new SourceNode(null, null, null, [
      asIs(start),
      "(",
      condition,
      ")",
      "{",
      body,
      "}",
    ]);
    sn.needsAsync = body.needsAsync;
    return sn;
  },
  elseIfBlock(node) {
    const { start, condition } = node;
    const body = get(node.body);
    const sn = new SourceNode(null, null, null, [
      asIs(start),
      " ",
      asIs(node.if),
      "(",
      condition,
      ")",
      "{",
      body,
      "}",
    ]);
    sn.needsAsync = body.needsAsync;
    return sn;
  },
  elseBlock(node) {
    const body = get(node.body);
    const sn = new SourceNode(null, null, null, [
      asIs(node.start),
      "{",
      body,
      "}",
    ]);
    sn.needsAsync = body.needsAsync;
    return sn;
  },
  conditional(node) {
    const ifBlock = get(node.if);
    const elseIfBlocks = node.elseIfs.map(get);
    const sn = new SourceNode(null, null, null, [ifBlock, ...elseIfBlocks]);
    sn.needsAsync =
      ifBlock.needsAsync || elseIfBlocks.some((block) => block.needsAsync);
    return sn;
  },
  fullConditional(node) {
    const ifBlock = get(node.if);
    const elseIfBlocks = node.elseIfs.map(get);
    const elseBlock = get(node.else);
    const sn = new SourceNode(null, null, null, [
      ifBlock,
      ...elseIfBlocks,
      elseBlock,
    ]);
    sn.needsAsync =
      ifBlock.needsAsync ||
      elseBlock.needsAsync ||
      elseIfBlocks.some((block) => block.needsAsync);
    return sn;
  },
  array(node) {
    const { start, end, items } = node;
    const sn = new SourceNode(null, null, null, [
      asIs(start),
      new SourceNode(null, null, null, items).join(","),
      asIs(end),
    ]);
    const insertBefores = items
      .map((item) => item.insertBefore)
      .filter(Boolean);
    if (insertBefores.length)
      sn.insertBefore = new SourceNode(null, null, null, insertBefores).join(
        ";"
      );
    sn.needsAsync = items.some((item) => item.needsAsync);
    return sn;
  },
  keyValue(node) {
    const sn = new SourceNode(null, null, null, [node.key, ":", node.value]);
    sn.needsAsync = node.value.needsAsync;
    return sn;
  },
  string(node) {
    node.value = node.value
      .slice(1, -1)
      .replace(/`/g, "\\`")
      .replace(/\\"/, '"');
    node.value = "`" + node.value + "`";
    return asIs(node);
  },
  hashmap(node) {
    const sn = new SourceNode(
      node.start.line,
      node.start.column,
      node.start.file,
      ["{", new SourceNode(null, null, null, node.keyValues).join(","), "}"]
    );
    sn.needsAsync = node.keyValues.some((kv) => kv.needsAsync);
    return sn;
  },
  propertyAccess(node) {
    return new SourceNode(null, null, null, [
      get(node.lhs),
      asIs(node.dot),
      get(node.rhs),
    ]);
  },
  range(node) {
    const start = node.start || "0";
    const end = node.end || "Inf";
    const step = node.step || "null";
    const { location } = node;
    const sn = new SourceNode(location.line, location.column, location.file, [
      "range",
      "(",
      start,
      ",",
      end,
      ",",
      step,
      ")",
    ]);
    sn.needsAsync =
      node.start?.needsAsync || node.end?.needsAsync || node.step?.needsAsync;
    return sn;
  },
  ...map(["rangeFull", "byRange", "rangeBy"], (node) => {
    node.type = "range";
    return get(node);
  }),
  ranger(node) {
    return get({ type: "range", location: node });
  },
  slice(node) {
    const { slicer, slicee } = node;
    const sn = new SourceNode(null, null, null, [
      "slice",
      "(",
      slicee,
      ",",
      slicer,
      ")",
    ]);
    sn.needsAsync = slicer.needsAsync || slicee.needsAsync;
    return sn;
  },
  set(node) {
    const { start, items } = node;
    const sn = new SourceNode(start.line, start.column, start.file, [
      "new",
      " ",
      "Set",
      "(",
      "[",
      new SourceNode(null, null, null, items).join(","),
      "]",
      ")",
    ]);
    sn.needsAsync = items.some((item) => item.needsAsync);
    return sn;
  },
  wrapped(node) {
    if (!node.content) return new SourceNode(null, null, null, "");
    if (node.isFn && node.content.type == "call")
      node.content.args.map((arg) => (arg.lambda = []));
    const content = get(node.content);
    const sn = new SourceNode(null, null, null, [
      asIs(node.start),
      content,
      asIs(node.end),
    ]);
    sn.insertBefore = content.insertBefore;
    sn.needsAsync = content.needsAsync;
    return sn;
  },
  assignment(node) {
    const name = get(node.name);
    const value = checkLambda(node.value, node.value);
    const sn = new SourceNode(null, null, null, [
      ...(node.name.type == "symbol" ? ["const", " "] : []),
      name,
      asIs(node.assign),
      value,
    ]);
    sn.insertBefore = node.value.insertBefore;
    sn.needsAsync = value.needsAsync;
    return sn;
  },
  arrowAssignment(node) {
    const name = get(node.name);
    const insertBefore = new SourceNode(null, null, null, [
      ...(node.name.type == "symbol" ? ["const", " "] : []),
      name,
      new SourceNode(node.arrow.line, node.arrow.column, node.arrow.file, "="),
      node.value,
    ]);
    const insertBefores = new SourceNode(
      null,
      null,
      null,
      [node.value.insertBefore, insertBefore].filter(Boolean)
    ).join(";");
    name.insertBefore = insertBefores;
    name.needsAsync = node.value.needsAsync;
    return name;
  },
  parameter(node) {
    return new SourceNode(
      node.line,
      node.column,
      node.file,
      node.value.slice(1)
    );
  },
  inCheck(node) {
    return new SourceNode(node.start.line, node.start.column, node.start.file, [
      "includes(",
      get(node.lhs),
      ",",
      get(node.rhs),
      ")",
    ]);
  },
  formattedString(node) {
    const fn = get(node.fn);
    const args = new SourceNode(null, null, null, node.args.map(get));
    return new SourceNode(null, null, null, [fn, "(", args.join(","), ")"]);
  },
  fmtStr(node) {
    return new SourceNode(node.line, node.column, node.file, [
      "`",
      node.value,
      "`",
    ]);
  },
  fmtExpr(node) {
    return node.content || "undefined";
  },
  strEscape(node) {
    node.value = node.value.slice(1);
    return new SourceNode(null, null, null, ["`", asIs(node), "`"]);
  },
  clio(node) {
    const content = node.content
      .map((node) => [node.insertBefore, node])
      .flat()
      .filter(Boolean);
    const inner = new SourceNode(null, null, null, content).join(";");
    return new SourceNode(null, null, null, [
      "module.exports.exports=async(clio)=>{const{emitter,channel,range,slice,remote,register,man,includes,f}=clio;",
      inner,
      ";return clio.exports}",
    ]);
  },
};

const get = (node) => {
  return types[node.type](node);
};

module.exports.checkLambda = checkLambda;
module.exports.types = types;
module.exports.get = get;
