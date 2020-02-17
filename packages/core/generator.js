const { parser } = require("./parser");
const { SourceNode } = require("source-map");

const node = ({ location }, file, result) =>
  new SourceNode(location.line, location.column, file, result);

const template = `const { Fn, Flow, Lazy, Scope, Array, Range, Method, builtins } = require('clio-internals');

const scope = new Scope(builtins, null);

const moduleName = path =>
  path
    .split("/")
    .pop()
    .replace(/(\.clio|\.js)$/, "");

module.exports = scope
`;

const implicitReturn = block => {
  const lastExpr = block[block.length - 1];
  block[block.length - 1] = {
    name: "return",
    expr: lastExpr,
    location: block[block.length - 1].location
  };
  return block;
};

const sourceMap = file => `//# sourceMappingURL=${file}.js.map`;

const rules = {
  clio(cst, generate, file) {
    const { body } = cst;
    const processedBody = body.map(generate);
    const generated = processedBody.join(";");
    return node(cst, file, [template, generated, sourceMap(file)]);
  },
  return(cst, generate, file) {
    const { expr } = cst;
    const { name } = expr;
    if (name == "conditional") {
      expr.ifBlock.body.body = implicitReturn(expr.ifBlock.body.body);
      if (expr.elifBlock) {
        expr.elifBlock.body = expr.elifBlock.body.map(block => {
          block.body.body = implicitReturn(block.body.body);
          return block;
        });
      }
      if (expr.elseBlock) {
        expr.elseBlock.body.body = implicitReturn(expr.elseBlock.body.body);
      }
      return node(cst, file, [generate(expr)]);
    } else {
      const processedExpr = generate(expr);
      return node(cst, file, ["return", processedExpr]);
    }
  },
  // migrated
  function(cst, generate, file) {
    const {
      fn: name,
      parameters,
      body: { body }
    } = cst;
    const processedParams = parameters.map(
      param => `scope.$.${param} = ${param}`
    );
    const processedBody = implicitReturn(body).map(generate);
    return node(cst, file, [
      "scope.$.",
      name,
      " = new Fn(function ",
      name,
      "(scope, ",
      parameters.join(", "),
      ") { ",
      processedParams.join(";"),
      processedBody.join(";"),
      "}, scope, Lazy)"
    ]);
  },
  // migrated
  anonymousFunction(cst, generate, file) {
    const { parameter, body: expr } = cst;
    const processedBody =
      expr.name == "block" ? expr.body.map(generate).join(";") : generate(expr);
    return node(cst, file, [
      "new Fn(function (scope, ",
      parameter,
      ") {",
      processedBody,
      "})"
    ]);
  },
  // migrated
  math(cst, generate, file) {
    const { lhs, op, rhs } = cst;
    const left = generate(lhs);
    const right = generate(rhs);
    if (op != "^") return node(cst, file, ["(", left, op, right, ")"]);
    return node(cst, file, ["Math.pow(", left, ",", right, ")"]);
  },
  // migrated
  symbol(cst, generate, file) {
    const { raw } = cst;
    return node(cst, file, ["scope.$.", raw]);
  },
  // migrated
  decoratedFunction(cst, generate, file) {
    const { fn, decorator } = cst;
    const { fn: fnName } = fn;
    parsedFn = generate(fn);
    const {
      fn: { raw: name },
      args
    } = decorator;
    const parsedArgs = args.map(generate);
    return node(cst, file, [
      "scope.$.",
      fnName,
      " = ",
      name,
      "(",
      parsedFn,
      ", ",
      parsedArgs.join(", "),
      ")"
    ]);
  },
  // migrated
  number(cst, generate, file) {
    const { raw } = cst;
    return node(cst, file, [raw]);
  },
  // migrated
  string(cst, generate, file) {
    const { raw } = cst;
    return node(cst, file, [raw]);
  },
  // migrated
  flow(cst, generate, file) {
    const { data, calls } = cst;
    const processedData = generate(data);
    const processedCalls = calls.map(generate).join("");
    return node(cst, file, [
      "new Flow(scope, ",
      processedData,
      ")",
      processedCalls
    ]);
  },
  functionCall(cst, generate, file) {
    const { fn, args, map } = cst;
    const processedFn = generate(fn);
    const processedArgs = args.map(generate);
    const method = map ? ".map" : ".pipe";
    return node(cst, file, [
      method,
      "(",
      processedFn,
      ",",
      processedArgs.join(", "),
      ")"
    ]);
  },
  setVar(cst, generate, file) {
    const { variable } = cst;
    const { name } = variable;
    return name == "symbol"
      ? node(cst, file, [".set(", `"${variable.raw}"`, ")"])
      : node(cst, file, [
          ".set(",
          `"${variable.parts.map(({ raw }) => raw).join(".")}"`,
          ")"
        ]);
  },
  array(cst, generate, file) {
    const { items } = cst;
    const processedItems = items.map(generate);
    return node(cst, file, ["new Array(", processedItems.join(", "), ")"]);
  },
  slice(cst, generate, file) {
    const { slicee, slicer } = cst;
    const processedSlicee = generate(slicee);
    const processedSlicer = generate(slicer);
    return node(cst, file, [processedSlicee, ".slice(", processedSlicer, ")"]);
  },
  range(cst, generate, file) {
    const { start, end, step } = cst;
    const rangeStart = start ? generate(start) : "null";
    const rangeEnd = end ? generate(end) : "null";
    const rangeStep = step ? generate(step) : "null";
    return node(cst, file, [
      "new Range({ start: ",
      rangeStart,
      ", end: ",
      rangeEnd,
      ", step: ",
      rangeStep,
      "})"
    ]);
  },
  comparison(cst, generate, file) {
    const { lhs, cmp, rhs } = cst;
    const left = generate(lhs);
    const right = generate(rhs);
    return node(cst, file, ["(", left, cmp, right, ")"]);
  },
  conditional(cst, generate, file) {
    const { ifBlock, elifBlock, elseBlock } = cst;
    const processedIf = generate(ifBlock);
    const processedElif = elifBlock ? generate(elifBlock) : "";
    const processedElse = elseBlock ? generate(elseBlock) : "";
    return node(cst, file, [processedIf, processedElif, processedElse]);
  },
  ifConditional(cst, generate, file) {
    const {
      condition,
      body: { body }
    } = cst;
    const processedBody = body.map(generate);
    const processedCondition = generate(condition);
    return node(cst, file, [
      "if (",
      processedCondition,
      ") { ",
      processedBody.join(";"),
      " }"
    ]);
  },
  elifConditional(cst, generate, file) {
    const { body } = cst;
    const processedBody = body
      .map(({ condition, body: { body }, location }) => {
        const processedBody = body.map(generate);
        const processedCondition = generate(condition);
        return { body: processedBody, condition: processedCondition, location };
      })
      .map(({ condition, body, location }) => {
        return node({ location }, file, [
          "else if (",
          condition,
          " { ",
          body.join(";"),
          "}"
        ]);
      });
    return node(cst, file, [processedBody.join("")]);
  },
  elseConditional(cst, generate, file) {
    const {
      body: { body }
    } = cst;
    const processedBody = body.map(generate);
    return node(cst, file, ["else { ", processedBody.join(";"), " }"]);
  },
  importFromStatement(cst, generate, file) {
    const { path, names } = cst;
    const processedPath = generate(path);
    const processedNames = names.map(name => `"${name.raw}"`);
    return node(cst, file, [
      "scope.extend(require(",
      processedPath,
      "), [",
      processedNames.join(","),
      "])"
    ]);
  },
  importAllStatement(cst, generate, file) {
    const { path } = cst;
    const processedPath = generate(path);
    return node(cst, file, ["scope.extend(require(", processedPath, "))"]);
  },
  importFromAsStatement(cst, generate, file) {
    const { path, names } = cst;
    const processedPath = generate(path);
    const processedNames = names.map(name => {
      const { src, dest } = name;
      return `${src}: "${dest}"`;
    });
    return node(cst, file, [
      "scope.extend(require(",
      processedPath,
      "), {",
      processedNames.join(","),
      "})"
    ]);
  },
  importAsStatement(cst, generate, file) {
    const { path, importAs } = cst;
    const processedPath = generate(path);
    return node(cst, file, [
      "scope.$.",
      importAs,
      " = require(",
      processedPath,
      ")"
    ]);
  },
  importStatement(cst, generate, file) {
    const { path } = cst;
    const processedPath = generate(path);
    return node(cst, file, [
      "scope.extend(require(",
      processedPath,
      "), null, moduleName(",
      processedPath,
      "))"
    ]);
  },
  dotNotation(cst, generate, file) {
    const { parts } = cst;
    const [first, ...rest] = parts.map(part =>
      part.name == "symbol"
        ? part.raw
        : generate(part)
            .toString()
            .replace(/scope\.\$./, "")
    );
    return node(cst, file, ["scope.$.", first, ".", rest.join(".")]);
  },
  method(cst, generate, file) {
    const { parts } = cst;
    const processedParts = parts.map(({ raw }) => `"${raw}"`).join(",");
    return node(cst, file, ["new Method([", processedParts, "])"]);
  },
  hashmap(cst, generate, file) {
    const { values } = cst;
    const makeHash = inValues => {
      const processed = [];
      for (const inValue of inValues) {
        const { key, value, values } = inValue;
        const processedValue = values ? makeHash(values) : generate(value);
        processed.push(node(key, file, [key.raw, ": (", processedValue, ")"]));
        processed.push(",");
      }
      processed.pop();
      return node(cst, file, ["{", ...processed, "}"]);
    };
    return makeHash(values);
  },
  boolean(cst, generate, file) {
    return node(cst, file, [cst.raw]);
  },
  logical(cst, generate, file) {
    const { lhs, op, rhs } = cst;
    if (op.name == "not") return node(cst, file, ["(!", generate(rhs), ")"]);
    if (op.name == "and")
      return node(cst, file, ["(", generate(lhs), "&&", generate(rhs), ")"]);
    if (op.name == "or")
      return node(cst, file, ["(", generate(lhs), "||", generate(rhs), ")"]);
  }
};

const generate = (cst, file) => rules[cst.name](cst, generate, file);
const generator = (src, file) => parser(src).then(cst => generate(cst, file));

module.exports = { generate, generator };
