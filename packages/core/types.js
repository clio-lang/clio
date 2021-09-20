const { mapfn, map } = require("bean-parser");
const { SourceNode } = require("source-map");
const { existsSync } = require("fs");
const { join: joinPath, dirname, relative, resolve } = require("path");

class ImportError extends Error {
  constructor(meta) {
    super(meta.message);
    this.meta = meta;
  }
}

const ensureClioExtension = (path) =>
  path.endsWith(".clio") ? path : path + ".clio";

const resolveRelativeModule = (meta, path, line, column) => {
  const currDir = dirname(joinPath(meta.root, meta.sourceDir, meta.file));
  const possiblePaths = [];
  const resolvePath = resolve(currDir, path);

  if (!resolvePath.endsWith(".clio")) {
    possiblePaths.push(resolvePath + ".clio");
  } else {
    possiblePaths.push(resolvePath);
  }
  possiblePaths.push(joinPath(resolvePath, "main.clio"));

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      if (path.match(/\.{1,2}\//)) {
        return path + ".js";
      }
      const relativePath = relative(currDir, path) + ".js";
      return relativePath.match(/^\.{1,2}\//)
        ? relativePath
        : "./" + relativePath;
    }
  }

  throw new ImportError({
    message: [
      `Cannot find module "${path}" in any of the following locations:\n`,
      ...possiblePaths.map((path) => `  - ${relative(meta.root, path)}`),
    ].join("\n"),
    line,
    column,
  });
};

const resolveModule = (meta, path, line, column) => {
  const [moduleName, subPath = ""] = path.match(/(.*?)(?:$|\/(.*))/).slice(1);
  const modulePath = joinPath(meta.modulesDir, moduleName);
  if (!existsSync(modulePath)) {
    throw new ImportError({
      message: [
        `Cannot find module "${moduleName}" in your project.`,
        "Are you sure it is installed?",
      ].join("\n"),
      line,
      column,
    });
  }

  const { source, destination } = meta.config.build;
  const possiblePaths = [];
  const getResolvePath = (subPath) => {
    return {
      source: resolve(meta.modulesDir, moduleName, source, subPath),
      destination: resolve(
        meta.modulesDestDir,
        moduleName,
        destination,
        subPath
      ),
    };
  };
  if (!subPath.endsWith(".clio")) {
    possiblePaths.push(getResolvePath(subPath + ".clio"));
  } else {
    possiblePaths.push(getResolvePath(subPath));
  }
  possiblePaths.push(getResolvePath(joinPath(subPath, "main.clio")));

  for (const path of possiblePaths) {
    if (existsSync(path.source)) {
      if (path.destination.match(/^\.{1,2}\//)) {
        return path + ".js";
      }
      const relativePath =
        relative(dirname(meta.destFile), path.destination) + ".js";
      return relativePath.match(/\.{1,2}\//)
        ? relativePath
        : "./" + relativePath;
    }
  }

  throw new ImportError({
    message: [
      `Cannot find module "${path}" in any of the following locations:\n`,
      ...possiblePaths.map((path) => `  - ${relative(meta.root, path)}`),
    ].join("\n"),
    line,
    column,
  });
};

const getModulePath = (meta, path, line, column) => {
  if (!meta.sourceDir) {
    return ensureClioExtension(path) + ".js";
  }
  if (path.match(/\.{1,2}\//)) {
    return resolveRelativeModule(meta, path, line, column);
  } else {
    return resolveModule(meta, path, line, column);
  }
};

const join = (arr, sep) => new SourceNode(null, null, null, arr).join(sep);
const asIs = (token) =>
  new SourceNode(token.line, token.column, token.file, token.value);

const conditionals = ["fullConditional", "conditional"];

const checkLambda = (node, body, getValue, getBody) => {
  if (node.lambda?.length) {
    return get({
      type: "lambda",
      body: getBody ? get(body) : body,
      params: node.lambda,
    });
  }
  return getValue ? get(node) : node;
};

const getCallFn = (node) => {
  if (node.fn.type === "method") {
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

const checkRecursive = (node) => {
  // Checks for recursive calls
  const lastNode = node.content[node.content.length - 1];
  if (conditionals.includes(lastNode.type)) {
    const bodies = [
      lastNode.if.body,
      ...lastNode.elseIfs.map((elseIf) => elseIf.body),
      lastNode.else?.body,
    ].filter(Boolean);
    return bodies
      .map((body) => ({ ...body, recursefn: node.recursefn }))
      .some(checkRecursive);
  }
  // This is an infinite recursion:
  else if (lastNode.type === "call") {
    return (
      lastNode.fn.type === "symbol" &&
      get(lastNode.fn).toString() === node.recursefn?.name?.toString()
    );
  }
  return false;
};

const toProperCall = (node) => {
  const lastNode = node.content[node.content.length - 1];
  if (conditionals.includes(lastNode.type)) {
    const bodies = [
      lastNode.if.body,
      ...lastNode.elseIfs.map((elseIf) => elseIf.body),
      lastNode.else?.body,
    ].filter(Boolean);
    bodies
      .map((body) => {
        body.recursefn = node.recursefn;
        return body;
      })
      .map(toProperCall);
  } else if (lastNode.type === "call") {
    if (
      lastNode.fn.type === "symbol" &&
      get(lastNode.fn).toString() === node.recursefn?.name?.toString()
    ) {
      lastNode.type = "properCall";
      lastNode.paramNames = node.recursefn.params.map((param) =>
        param.toString()
      );
      lastNode.optimized = true;
      node.optimized = true;
    }
  }
  return node;
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
    const args = node.args.map(get);
    const insertBefore = args.map((arg) => arg.insertBefore).filter(Boolean);
    if (fn.insertBefore) insertBefore.unshift(fn.insertBefore);
    const data = args.shift();
    const needsAsync = data.needsAsync || args.some((arg) => arg.needsAsync);
    let fun;
    if (args.length) {
      fun = new SourceNode(null, null, null, [
        needsAsync ? "async " : "",
        "($item",
        fn.dropMeta ? ")=>" : ", $index, $iterator)=>",
        get(fn),
        fn.dropData ? "(" : "($item,",
        join(args, ","),
        fn.dropMeta ? ")" : ",$index,$iterator)",
      ]);
    } else {
      fun = get(fn);
    }
    if (fun.insertBefore) insertBefore.unshift(fun.insertBefore);
    let sn = new SourceNode(fn.line, fn.column, fn.file, [
      data,
      ".",
      "map",
      "(",
      fun,
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
      awaited ||
      data.needsAsync ||
      args.some((arg) => arg.needsAsync) ||
      fun.needsAsync;
    return sn;
  },
  properCall(node) {
    const params = node.paramNames;
    const recurseArgs = params.map((param, i) => {
      let recurseArg = "undefined";
      if (node.args[i]) {
        const value = get(node.args[i]);
        if (value.toString()) {
          recurseArg = value;
        }
      }
      return new SourceNode(null, null, null, [`__${param}=`, recurseArg, ";"]);
    });
    const properArgs = params.map((param) => `${param}=__${param};`);
    return new SourceNode(null, null, null, [
      recurseArgs,
      properArgs,
      `__recurse=true;`,
      `continue __`,
      get(node.fn),
      ";",
    ]);
  },
  call(node) {
    if (node.isMap) {
      node.type = "mapCall";
      return get(node);
    }
    const { awaited, all } = node;
    const fn = getCallFn(node);
    const args = node.args.map(get);
    const insertBefore = args.map((arg) => arg.insertBefore).filter(Boolean);
    const fun = get(fn);
    if (fun.insertBefore) insertBefore.unshift(fun.insertBefore);
    let sn = new SourceNode(fn.line, fn.column, fn.file, [
      fun,
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
    sn.needsAsync =
      awaited || args.some((arg) => arg.needsAsync) || fun.needsAsync;
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
  recursiveReturn(node) {
    const params = node.recursefn.params.map((param) => param.toString());
    const recursionParams = params.length
      ? `let ` + params.map((param) => `__${param}`).join(",") + ";"
      : "";
    // Convert all recursive calls to proper calls
    const proper = toProperCall(node);
    proper.type = "return";
    proper.optimized = true;
    const properCode = get(proper);
    const sn = new SourceNode(null, null, null, [
      `${recursionParams}let __recurse = true;`,
      `__${node.recursefn.name}: while(__recurse) {`,
      `__recurse = false;`,
      properCode,
      `}`,
    ]);
    sn.needsAsync = properCode.needsAsync;
    return sn;
  },
  return(node) {
    if (!node.optimized && checkRecursive(node)) {
      node.type = "recursiveReturn";
      return get(node);
    }
    let lastNode = node.content.pop();
    let addReturn = !node.optimized && !lastNode.optimized;
    const content = node.content
      .map(get)
      .map((node) => [node.insertBefore, node])
      .flat()
      .filter(Boolean);
    if (conditionals.includes(lastNode.type)) {
      if (!lastNode.if.body.optimized) {
        lastNode.if.body.type = "return";
      }
      lastNode.elseIfs.forEach((elseIf) => {
        if (!elseIf.body.optimized) {
          elseIf.body.type = "return";
        }
      });
      if (lastNode.else && !lastNode.else.body.optimized) {
        lastNode.else.body.type = "return";
      }
      addReturn = false;
    } else if (lastNode.type === "assignment") {
      if (lastNode.value.insertBefore)
        content.push(lastNode.value.insertBefore);
      content.push(get(lastNode));
      lastNode = lastNode.name;
    }
    let last = lastNode.type ? get(lastNode) : lastNode;
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
    const doc = node.doc ? [`;`, name, ".__doc__=`", asIs(node.doc), "`"] : [];
    const sn = new SourceNode(start.line, start.column, start.file, [
      ...(name ? ["const ", name, "="] : []),
      ...(name ? ["register"] : []),
      "(",
      ...(name ? ["`", start.rpcPrefix, "/", start.file, "/", name, "`,"] : []),
      node.body.needsAsync ? "async" : "",
      "(",
      new SourceNode(null, null, null, params).join(","),
      ")=>",
      "{",
      body,
      "})",
      ...doc,
    ]);
    sn.needsAsync = false;
    sn.returnAs = new SourceNode(null, null, null, name);
    sn.returnAs.insertBefore = sn;
    sn.fn = {
      doc: node.doc,
      name,
    };
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
    sn.fn = fn.fn;
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
  importStatement(node) {
    /* each import has 2 parts:
        1. import
        2. assign
    */
    const path = node.path.value.slice(1, -1).replace(/^[^:]*:/, "");
    const filename = path.split("/").pop();
    // Get the name, and make it pascalCase
    const name = filename
      .replace(/\.[^.]*$/, "")
      .split("/")
      .pop()
      .replace(/@.*$/, "")
      .split(/[-._]+/)
      .filter(Boolean)
      .map((v, i) => (i > 0 ? v[0].toUpperCase() + v.slice(1) : v))
      .join("");
    const protocol =
      node.path.value.slice(1, -1).match(/^[^:]*(?=:)/)?.[0] || "clio";
    let require;
    /* We are clearly testing these in our unit tests,
       yet istanbul considers them untested branches,
       I have no idea why, I disabled istanbul checks
       here until I figure out why? */
    if (protocol === "js") {
      require = new SourceNode(
        node.import.line,
        node.import.column,
        node.import.file,
        ["require(", '"', path, '")']
      );
    } /* istanbul ignore next */ else if (protocol === "clio") {
      /*
        Resolve imports:

          1. Check if import is relative or not
          2. Check if import path exists
          3. Check if import path is a directory or not
          4. Check if we need to append .clio to the import path
      
      */

      const modulePath = getModulePath(
        node.import,
        path,
        node.path.line,
        node.path.column
      );

      require = new SourceNode(
        node.import.line,
        node.import.column,
        node.import.file,
        ["await require(", '"', modulePath, '").exports(clio)']
      );
    } else {
      require = new SourceNode(
        node.import.line,
        node.import.column,
        node.import.file,
        ["await remote(clio,", '"', protocol + "://" + path, '")']
      );
    }
    let assign;
    if (!node.items) {
      assign = new SourceNode(null, null, null, ["const ", name, "="]);
    } else {
      let parts = [];
      let rest;
      for (const part of node.items) {
        if (part.type === "symbol") {
          parts.push(get(part));
        } else if (part.lhs.type === "symbol") {
          parts.push(
            new SourceNode(part.as.line, part.as.column, part.as.file, [
              get(part.lhs),
              ":",
              get(part.rhs),
            ])
          );
        } else {
          const name = get(part.rhs);
          rest = new SourceNode(part.as.line, part.as.column, part.as.file, [
            "...",
            name,
          ]);
          rest.name = name;
        }
      }
      if (rest) parts.push(rest);
      assign =
        rest && parts.length == 1
          ? new SourceNode(null, null, null, ["const ", rest.name, "="])
          : new SourceNode(null, null, null, [
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
      /* istanbul ignore next */
      body.needsAsync ? "async " : "",
      "(",
      new SourceNode(null, null, null, params).join(","),
      ")",
      "=>",
      body,
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
    for (const { op } of node.comparisons)
      if (op.value === "==") op.value = "===";
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
            op.value === "and" ? "&&" : "||"
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
    const lhs = get(node.lhs);
    const rhs = get(node.rhs);
    const sn = new SourceNode(null, null, null, [lhs, asIs(node.dot), rhs]);
    sn.insertBefore = [lhs.insertBefore, rhs.insertBefore].filter(Boolean);
    sn.insertBefore = sn.insertBefore.length ? sn.insertBefore : null;
    sn.needsAsync = lhs.needsAsync || rhs.needsAsync;
    return sn;
  },
  range(node) {
    const start = node.start || "0";
    const end = node.end || "Infinity";
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
    const sn = new SourceNode(null, null, null, [slicee, slicer]);
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
    if (node.isFn && node.content.type === "call")
      node.content.args.map((arg) => (arg.lambda = []));
    const content = checkLambda(node.content, node.content, true, true);
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
    const sn = new SourceNode(null, null, null, [
      ...(node.name.type === "symbol" ? ["const", " "] : []),
      name,
      asIs(node.assign),
      node.value,
    ]);
    sn.insertBefore = node.value.insertBefore;
    sn.needsAsync = node.value.needsAsync;
    return sn;
  },
  arrowAssignment(node) {
    const name = get(node.name);
    const insertBefore = new SourceNode(null, null, null, [
      ...(node.name.type === "symbol" ? ["const", " "] : []),
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
    const value = asIs(node);
    return "{}".includes(value.toString())
      ? new SourceNode(null, null, null, ["`", asIs(node), "`"])
      : new SourceNode(null, null, null, ["`\\", asIs(node), "`"]);
  },
  clio(node) {
    const content = node.content
      .map((node) => [node.insertBefore, node])
      .flat()
      .filter(Boolean);
    const inner = new SourceNode(null, null, null, content).join(";");
    return new SourceNode(null, null, null, [
      "module.exports.exports=async(clio)=>{const{emitter,range,slice,remote,register,man,includes,f}=clio;",
      inner,
      ";return clio.exports}",
    ]);
  },
};

const get = (node) => {
  const result = types[node.type](node);
  result.node = node;
  return result;
};

module.exports.ImportError = ImportError;
module.exports.checkLambda = checkLambda;
module.exports.types = types;
module.exports.get = get;
