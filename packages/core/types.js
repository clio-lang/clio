const { mapfn, map } = require("bean-parser");
const { SourceNode } = require("source-map");
const { existsSync } = require("fs");
const { join: joinPath, dirname, relative, resolve } = require("path");
const { getPackageConfig } = require("clio-manifest");

class ImportError extends Error {
  constructor(meta) {
    super(meta.message);
    this.meta = meta;
  }
}

const ensureClioExtension = (path) =>
  path.endsWith(".clio") ? path : path + ".clio";

const ensureRelative = (curr, path) => {
  const relativePath = relative(curr, path);
  return relativePath.match(/^\.{1,2}\//) ? relativePath : "./" + relativePath;
};

const resolveRelativeModule = (context, path, line, column) => {
  const currDir = dirname(
    joinPath(context.root, context.sourceDir, context.file)
  );
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
      if (path.match(/^\.{1,2}\//)) {
        return { source: path, require: path + ".js" };
      }
      const relativePath = ensureRelative(currDir, path);
      return { source: relativePath, require: relativePath + ".js" };
    }
  }

  throw new ImportError({
    message: [
      `Cannot find module "${path}" in any of the following locations:\n`,
      ...possiblePaths.map((path) => `  - ${relative(context.root, path)}`),
    ].join("\n"),
    line,
    column,
  });
};

const resolveAbsoluteModule = (context, path, line, column) => {
  const currDir = dirname(
    joinPath(context.root, context.sourceDir, context.file)
  );
  const possiblePaths = [];
  const resolvePath = resolve(context.root, context.sourceDir, path.slice(1));

  if (!resolvePath.endsWith(".clio")) {
    possiblePaths.push(resolvePath + ".clio");
  } else {
    possiblePaths.push(resolvePath);
  }
  possiblePaths.push(joinPath(resolvePath, "main.clio"));

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      if (path.match(/^\.{1,2}\//)) {
        return { source: path, require: path + ".js" };
      }
      const relativePath = ensureRelative(currDir, path);
      return { source: relativePath, require: relativePath + ".js" };
    }
  }

  throw new ImportError({
    message: [
      `Cannot find module "${path}" in any of the following locations:\n`,
      ...possiblePaths.map((path) => `  - ${relative(context.root, path)}`),
    ].join("\n"),
    line,
    column,
  });
};

const resolveModule = (context, path, line, column) => {
  const [moduleName, subPath = ""] = path.match(/(.*?)(?:$|\/(.*))/).slice(1);
  const modulePath = joinPath(context.modulesDir, moduleName);
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

  const { source, destination } = context.config.build;
  const possiblePaths = [];
  const getResolvePath = (subPath) => {
    return {
      source: resolve(context.modulesDir, moduleName, source, subPath),
      destination: resolve(
        context.modulesDestDir,
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
        return { source: path.source, require: path.destination + ".js" };
      }
      const requirePath =
        ensureRelative(dirname(context.destFile), path.destination) + ".js";
      const sourcePath = ensureRelative(context.sourceDir, path.source);

      return {
        source: sourcePath,
        require: requirePath,
      };
    }
  }

  throw new ImportError({
    message: [
      `Cannot find module "${path}" in any of the following locations:\n`,
      ...possiblePaths.map((path) => `  - ${relative(context.root, path)}`),
    ].join("\n"),
    line,
    column,
  });
};

const getImportPath = (context, path, line, column) => {
  if (!context.sourceDir) {
    const source = ensureClioExtension(path);
    return { source, require: source + ".js" };
  }
  if (path.match(/^\.{1,2}\//)) {
    return resolveRelativeModule(context, path, line, column);
  } else if (path.match(/^\//)) {
    return resolveAbsoluteModule(context, path, line, column);
  } else {
    return resolveModule(context, path, line, column);
  }
};

const join = (arr, sep) => new SourceNode(null, null, null, arr).join(sep);
const asIs = (token) =>
  new SourceNode(token.line, token.column, token.file, token.value);

const conditionals = ["fullConditional", "conditional"];

const checkLambda = (node, body, context, getValue, getBody) => {
  if (node.lambda?.length) {
    return get(
      {
        type: "lambda",
        body: getBody ? get(body, context) : body,
        params: node.lambda,
      },
      context
    );
  }
  return getValue ? get(node, context) : node;
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
        body: {
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
        },
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

const getTypeOf = (node, scope) => {
  if (node.type === "number") {
    return "Number";
  }
  if (node.type === "string") {
    return "String";
  }
  if (node.type === "array") {
    return "Array";
  }
  if (node.type === "hashmap") {
    return "Object"; // TODO: FIXME
  }
  if (node.type === "symbol") {
    return scope[get(node)]?.type;
  }
  if (node.type === "propertyAccess") {
    return scope[get(node)]?.type;
  }
};

const compileImport = (path, importPath, context) => {
  if (context.sourceDir) {
    const isModule = !path.match(/^(\.{1,2})?\//);
    const filePath = joinPath(context.sourceDir, importPath.source);

    const {
      compileFile,
      config,
      configPath,
      modulesDir,
      modulesDestDir,
      configs = {},
    } = context;

    if (isModule) {
      // we need to get the config file
      const moduleName = path.split("/").shift();
      const configPath = joinPath(modulesDir, moduleName, "clio.toml");
      const config = configs[moduleName] || getPackageConfig(configPath);
      configs[moduleName] = config;
      context.configs = configs;
      const { scope } = compileFile(
        filePath,
        config,
        configPath,
        modulesDir,
        modulesDestDir,
        moduleName
      );
      return scope;
    } else {
      const { scope } = compileFile(
        filePath,
        config,
        configPath,
        modulesDir,
        modulesDestDir
      );
      return scope;
    }
  }
  return {};
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
  mapCall(node, context) {
    const { awaited, all } = node;
    const fn = getCallFn(node);
    const fnName = get(fn).toString();
    const { accepts } = context.scope[fnName] || {};
    if (accepts) {
      for (let index = 0; index < node.args.length; index++) {
        const arg = node.args[index];
        const type = getTypeOf(arg, context);
        const match = type === accepts[index];
        if (!match) {
          const argTypeName = type.split("/").pop();
          const paramTypeName = accepts[index].split("/").pop();
          throw new Error(
            `Argument of type ${argTypeName} at position ${index} does not satisfy parameter of type ${paramTypeName}`
          );
        }
      }
    }
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
        get(fn, context),
        fn.dropData ? "(" : "($item,",
        join(args, ","),
        fn.dropMeta ? ")" : ",$index,$iterator)",
      ]);
    } else {
      fun = get(fn, context);
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
  parameterCall(node, context) {
    return get({ ...node, type: "call" }, context);
  },
  call(node, context) {
    if (node.isMap) {
      node.type = "mapCall";
      return get(node, context);
    }
    const { awaited, all } = node;
    const fn = getCallFn(node);
    const args = node.args.map(get);
    const insertBefore = args.map((arg) => arg.insertBefore).filter(Boolean);
    const fun = get(fn, context);
    const { accepts } = context.scope[fun] || {};
    if (accepts) {
      for (let index = 0; index < node.args.length; index++) {
        const arg = node.args[index];
        const type = getTypeOf(arg, context);
        const match = type === accepts[index];
        if (!match) {
          const argTypeName = type.split("/").pop();
          const paramTypeName = accepts[index].split("/").pop();
          throw new Error(
            `Argument of type ${argTypeName} at position ${index} does not satisfy parameter of type ${paramTypeName}`
          );
        }
      }
    }
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
  return(node, context) {
    if (!node.optimized && checkRecursive(node)) {
      node.type = "recursiveReturn";
      return get(node, context);
    }
    let lastNode = node.content.pop();
    let addReturn = !node.optimized && !lastNode.optimized;
    const content = node.content
      .map((content) => get(content, context))
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
      if (lastNode.value.insertBefore) {
        content.push(lastNode.value.insertBefore);
      }
      content.push(get(lastNode, context));
      lastNode = lastNode.name;
    } else if (lastNode.type === "typedAssignment") {
      if (lastNode.assignment.value.insertBefore) {
        content.push(lastNode.assignment.value.insertBefore);
      }
      content.push(get(lastNode, context));
      lastNode = lastNode.assignment.name;
    }
    let last =
      lastNode instanceof SourceNode ? lastNode : get(lastNode, context);
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
  decoratedExportedFunction(node, context) {
    node.value.type = "decoratedFunction";
    const fn = get(node.value, context);
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
  decoratedFunction(node, context) {
    const { start, name } = node;
    const docLines = [];
    for (const decorator of node.decorators) {
      if (decorator.type === "decoratorCall") {
        const { fn, args } = decorator;
        switch (fn.value) {
          case "@describe":
            const line = args
              .filter((arg) => ["string", "number"].includes(arg.type))
              .map((arg) => {
                const compiled = get(arg, context).toString();
                return arg.type === "string" ? compiled.slice(1, -1) : compiled;
              })
              .join(" ");
            if (line) {
              docLines.push(line);
            }
            break;

          case "@returns":
            const type = get(args[0], context).toString();
            context.scope[name] = {
              ...context.scope[name],
              returns: context.scope[type].id,
            };
            break;

          case "@params":
            const types = args
              .map((arg) => get(arg, context).toString())
              .map((type) => context.scope[type].id);
            context.scope[name] = {
              ...context.scope[name],
              accepts: types,
            };
            break;

          default:
            break;
        }
      }
    }
    const doc = docLines.join("\n");
    const fn = get({ ...node, type: "function", name: null }, context);
    let decorated = fn;
    for (const decorator of node.decorators) {
      if (decorator.type === "decorator") {
        const symbol = {
          ...decorator,
          type: "symbol",
          value: decorator.value.slice(1),
        };
        decorated = new SourceNode(null, null, null, [
          get(symbol, context),
          "(",
          decorated,
          ")",
        ]);
      } else if (decorator.type === "decoratorAccess") {
        const { lhs } = decorator;
        const symbol = {
          ...lhs,
          type: "symbol",
          value: lhs.value.slice(1),
        };
        decorator.lhs = symbol;
        decorator.type = "propertyAccess";
        decorated = new SourceNode(null, null, null, [
          get(decorator, context),
          "(",
          decorated,
          ")",
        ]);
      } else if (decorator.type === "decoratorCall") {
        if (decorator.fn.type === "decorator") {
          const parameter = decorator.fn;
          const symbol = {
            ...parameter,
            type: "symbol",
            value: parameter.value.slice(1),
          };
          decorator.fn = symbol;
          decorator.type = "call";
          decorator.args.push({ type: "asIs", value: decorated });
          decorated = get(decorator, context);
        } else {
          const { lhs } = decorator.fn;
          const symbol = {
            ...lhs,
            type: "symbol",
            value: lhs.value.slice(1),
          };
          decorator.fn.lhs = symbol;
          decorator.fn.type = "propertyAccess";
          decorator.type = "call";
          decorator.args.push({ type: "asIs", value: decorated });
          decorated = get(decorator, context);
        }
      }
    }
    const sn = new SourceNode(start.line, start.column, start.file, [
      "const ",
      name,
      "=",
      decorated,
    ]);
    sn.fn = { doc, name };
    return sn;
  },
  asIs(node) {
    return node.value;
  },
  function(node, context) {
    node.outerScope = context.scope;
    const { start, name, params } = node;
    const body = get(node.body, context);
    const sn = new SourceNode(start.line, start.column, start.file, [
      ...(name ? ["const ", name, "="] : []),
      ...(name ? ["register"] : []),
      "(",
      ...(name
        ? ["`", context.rpcPrefix, "/", start.file, "/", name, "`,"]
        : []),
      body.needsAsync ? "async" : "",
      "(",
      new SourceNode(null, null, null, params).join(","),
      ")=>",
      "{",
      body,
      "})",
    ]);
    sn.needsAsync = false;
    sn.returnAs = new SourceNode(null, null, null, name);
    sn.returnAs.insertBefore = sn;
    sn.fn = { name };
    // Restore scope
    context.scope = node.outerScope;
    return sn;
  },
  exportedFunction(node, context) {
    const fn = get(node.value, context);
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
  exported(node, context) {
    const value = get(node.value, context);
    const name =
      node.name instanceof SourceNode ? node.name : get(node.name, context);
    const { line, column, file } = node.export;
    const sn = new SourceNode(line, column, file, [
      "clio.exports.",
      name,
      "=",
      name,
    ]);
    sn.insertBefore = [value.insertBefore, value].filter(Boolean);
    return sn;
  },
  importStatement(node, context) {
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
    let importScope = {};
    /* We are clearly testing these in our unit tests,
       yet istanbul considers them untested branches,
       I have no idea why, I disabled istanbul checks
       here until I figure out what is happening! */
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

      const { line, column } = node.path;
      const importPath = getImportPath(context, path, line, column);

      importScope = compileImport(path, importPath, context);

      require = new SourceNode(
        node.import.line,
        node.import.column,
        node.import.file,
        ["await require(", '"', importPath.require, '").exports(clio)']
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
      context.scope[name] = importScope;
    } else {
      let parts = [];
      let rest;
      for (const part of node.items) {
        if (part.type === "symbol") {
          const name = get(part);
          parts.push(name);
          if (importScope[name]) {
            context.scope[name] = importScope[name];
          }
        } else if (part.lhs.type === "symbol") {
          const name = get(part.lhs);
          const rename = get(part.rhs);
          parts.push(
            new SourceNode(part.as.line, part.as.column, part.as.file, [
              name,
              ":",
              rename,
            ])
          );
          if (importScope[name]) {
            context.scope[rename] = importScope[name];
          }
        } else {
          const name = get(part.rhs);
          rest = new SourceNode(part.as.line, part.as.column, part.as.file, [
            "...",
            name,
          ]);
          rest.name = name;
          context.scope[name] = importScope;
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
  wrapped(node, context) {
    if (!node.content) return new SourceNode(null, null, null, "");
    if (node.isFn && node.content.type === "call") {
      node.content.args.map((arg) => (arg.lambda = []));
    }
    const content = checkLambda(
      node.content,
      node.content,
      context,
      true,
      true
    );
    const sn = new SourceNode(null, null, null, [
      asIs(node.start),
      content,
      asIs(node.end),
    ]);
    sn.insertBefore = content.insertBefore;
    sn.needsAsync = content.needsAsync;
    return sn;
  },
  assignment(node, context) {
    const name = get(node.name, context);
    const value = get(node.value, context);
    const sn = new SourceNode(null, null, null, [
      ...(node.name.type === "symbol" ? ["const", " "] : []),
      name,
      asIs(node.assign),
      value,
    ]);
    sn.insertBefore = value.insertBefore;
    sn.needsAsync = value.needsAsync;
    sn.name = name;
    return sn;
  },
  typedAssignment(node, context) {
    const assignment = get(node.assignment, context);
    // type check
    const type = get(node.valueType).toString();
    const value = get(node.assignment, context);
    if (value.node.type === "call") {
      const fnName = get(value.node.fn, context);
      const fnType = context.scope[fnName].returns;
      if (fnType && fnType !== type) {
        const typeName = fnType.split("/").pop();
        throw `Cannot assign value of type ${typeName} to variable ${assignment.name} of type ${type}`;
      }
    }
    const { rpcPrefix, file } = context;
    context.scope[assignment.name] = {
      type: context.scope[type].id,
      id: [rpcPrefix, file, assignment.name].join("/"),
    };
    return assignment;
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
  typeDef(node, context) {
    if (node.extends) {
      node.type = "typeDefExtends";
      return get(node, context);
    }
    const { line, column, file } = node.start;
    const { rpcPrefix } = context;
    context.scope[node.name] = {
      type: "Type",
      id: [rpcPrefix, file, node.name].join("/"),
    };
    return new SourceNode(line, column, file, [
      "const ",
      node.name,
      "=new Proxy(class ",
      node.name,
      "{constructor(",
      new SourceNode(
        null,
        null,
        null,
        node.members.map((member) => member.name)
      ).join(","),
      "){",
      ...node.members.map((member) => {
        return new SourceNode(null, null, null, [
          "this.",
          member.name,
          "=",
          member.name,
          ";",
        ]);
      }),
      "} static get members(){return ",
      node.members.length.toString(),
      "}},{apply(target,_,args){return new target(...args)}})",
    ]);
  },
  typeDefExtends(node, context) {
    const { line, column, file } = node.start;
    const { rpcPrefix } = context;
    context.scope[node.name] = {
      type: "Type",
      id: [rpcPrefix, file, node.name].join("/"),
    };
    return new SourceNode(line, column, file, [
      "const ",
      node.name,
      "=new Proxy(class ",
      node.name,
      " extends ",
      node.extends,
      "{constructor(...$args){",
      "super(...",
      "$args.slice(0,",
      node.extends,
      ".members));",
      "const [",
      new SourceNode(
        null,
        null,
        null,
        node.members.map((member) => member.name)
      ).join(","),
      "]=$args.slice(",
      node.extends,
      ".members);",
      ...node.members.map((member) => {
        return new SourceNode(null, null, null, [
          "this.",
          member.name,
          "=",
          member.name,
          ";",
        ]);
      }),
      "} static get members(){return ",
      node.extends,
      ".members+",
      node.members.length.toString(),
      "}},{apply(target,_,args){return new target(...args)}})",
    ]);
  },
  listDef(node, context) {
    const { line, column, file } = node.start;
    const { rpcPrefix } = context;
    context.scope[node.name] = {
      type: "ListType",
      id: [rpcPrefix, file, node.name].join("/"),
    };
    return new SourceNode(line, column, file, [
      "const ",
      node.name,
      "=[",
      join(node.members, ","),
      ...(node.extends ? [",...", node.extends] : []),
      "]",
    ]);
  },
  clio(node, context) {
    const content = node.content
      .map((node) => get(node, context))
      .map((node) => [node.insertBefore, node])
      .flat()
      .filter(Boolean);
    const inner = new SourceNode(null, null, null, content).join(";");
    const builtins =
      "emitter,range,slice,remote,register,help,describe,returns,check,params,includes,f";
    return new SourceNode(null, null, null, [
      `module.exports.exports=async(clio)=>{const{${builtins}}=clio;`,
      inner,
      ";return clio.exports}",
    ]);
  },
};

const get = (node, context) => {
  const result = types[node.type](node, context);
  result.node = node;
  return result;
};

module.exports.ImportError = ImportError;
module.exports.checkLambda = checkLambda;
module.exports.types = types;
module.exports.get = get;
