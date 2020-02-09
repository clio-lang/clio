const { parser } = require("./parser");

const template = generated => `
const { Fn, Flow, Lazy, Scope, Array, Range, Method, builtins } = require('clio-internals');

const scope = new Scope(builtins, null);

const moduleName = path =>
  path
    .split("/")
    .pop()
    .replace(/(\.clio|\.js)$/, "");

${generated}

module.exports = scope
`;

const implicitReturn = block => {
  const lastExpr = block[block.length - 1];
  block[block.length - 1] = {
    name: "return",
    expr: lastExpr
  };
  return block;
};

const rules = {
  clio(cst, generate) {
    const { body } = cst;
    const processedBody = body.map(generate);
    const generated = processedBody.join(";\n\n");
    return template(generated);
  },
  return(cst, generate) {
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
      return generate(expr);
    } else {
      const processedExpr = generate(expr);
      return `return ${processedExpr}`;
    }
  },
  function(cst, generate) {
    const {
      fn: name,
      parameters,
      body: { body }
    } = cst;
    const processedParams = parameters.map(
      param => `scope.$.${param} = ${param}`
    );
    const processedBody = implicitReturn(body).map(generate);
    return `scope.$.${name} = new Fn(
      function ${name} (scope, ${parameters.join(", ")}) {
        ${processedParams.join(";\n")}
        ${processedBody.join(";\n")}
      }, scope, Lazy)`;
  },
  anonymousFunction(cst, generate) {
    const { parameter, body: expr } = cst;
    const processedBody =
      expr.name == "block"
        ? expr.body.map(generate).join(";\n")
        : generate(expr);
    return `new Fn(function (scope, ${parameter}) {
      ${processedBody}
    })`;
  },
  math(cst, generate) {
    const { lhs, op, rhs } = cst;
    const left = generate(lhs);
    const right = generate(rhs);
    if (op != "^") return `(${left} ${op} ${right})`;
    return `Math.pow(${left}, ${right})`;
  },
  symbol(cst, generate) {
    const { raw } = cst;
    return `scope.$.${raw}`;
  },
  decoratedFunction(cst, generate) {
    const { fn, decorator } = cst;
    const { fn: fnName } = fn;
    parsedFn = generate(fn);
    const {
      fn: { raw: name },
      args
    } = decorator;
    const parsedArgs = args.map(generate);
    return `scope.$.${fnName} = ${name}(${parsedFn}, ${parsedArgs.join(", ")})`;
  },
  number(cst, generate) {
    const { raw } = cst;
    return raw;
  },
  string(cst, generate) {
    const { raw } = cst;
    return raw;
  },
  flow(cst, generate) {
    const { data, calls } = cst;
    const processedData = generate(data);
    const processedCalls = calls.map(generate).join("\n");
    return `new Flow(scope, ${processedData})\n` + processedCalls;
  },
  functionCall(cst, generate) {
    const { fn, args, map } = cst;
    const processedFn = generate(fn);
    const processedArgs = args.map(generate);
    const method = map ? ".map" : ".pipe";
    return `${method}(${processedFn}, ${processedArgs.join(", ")})`;
  },
  setVar(cst, generate) {
    const { variable } = cst;
    const { name } = variable;
    return name == "symbol"
      ? `.set("${variable.raw}")`
      : `.set("${variable.parts.map(({ raw }) => raw).join(".")}")`;
  },
  array(cst, generate) {
    const { items } = cst;
    const processedItems = items.map(generate);
    return `new Array(${processedItems.join(", ")})`;
  },
  slice(cst, generate) {
    const { slicee, slicer } = cst;
    const processedSlicee = generate(slicee);
    const processedSlicer = generate(slicer);
    return `${processedSlicee}.slice(${processedSlicer})`;
  },
  range(cst, generate) {
    const { start, end, step } = cst;
    const rangeStart = start ? generate(start) : "null";
    const rangeEnd = end ? generate(end) : "null";
    const rangeStep = step ? generate(step) : "null";
    return `new Range({ start: ${rangeStart}, end: ${rangeEnd}, step: ${rangeStep} })`;
  },
  comparison(cst, generate) {
    const { lhs, cmp, rhs } = cst;
    const left = generate(lhs);
    const right = generate(rhs);
    return `(${left} ${cmp} ${right})`;
  },
  conditional(cst, generate) {
    const { ifBlock, elifBlock, elseBlock } = cst;
    const processedIf = generate(ifBlock);
    const processedElif = elifBlock ? generate(elifBlock) : "";
    const processedElse = elseBlock ? generate(elseBlock) : "";
    return [processedIf, processedElif, processedElse].join("\n");
  },
  ifConditional(cst, generate) {
    const {
      condition,
      body: { body }
    } = cst;
    const processedBody = body.map(generate);
    const processedCondition = generate(condition);
    return `if (${processedCondition}) { ${processedBody.join(";\n")} }`;
  },
  elifConditional(cst, generate) {
    const { body } = cst;
    const processedBody = body
      .map(({ condition, body: { body } }) => {
        const processedBody = body.map(generate);
        const processedCondition = generate(condition);
        return { body: processedBody, condition: processedCondition };
      })
      .map(({ condition, body }) => {
        return `else if (${condition}) { ${body.join(";\n")} }`;
      });
    return processedBody.join("\n");
  },
  elseConditional(cst, generate) {
    const {
      body: { body }
    } = cst;
    const processedBody = body.map(generate);
    return `else { ${processedBody.join(";\n")} }`;
  },
  importFromStatement(cst, generate) {
    const { path, names } = cst;
    const processedPath = generate(path);
    const processedNames = names.map(name => `"${name.raw}"`);
    const namesList = `[ ${processedNames.join(",")} ]`;
    return `scope.extend(require(${processedPath}), ${namesList})`;
  },
  importAllStatement(cst, generate) {
    const { path } = cst;
    const processedPath = generate(path);
    return `scope.extend(require(${processedPath}))`;
  },
  importFromAsStatement(cst, generate) {
    const { path, names } = cst;
    const processedPath = generate(path);
    const processedNames = names.map(name => {
      const { src, dest } = name;
      return `${src}: "${dest}"`;
    });
    namesObject = "{" + processedNames.join(",") + "}";
    return `scope.extend(require(${processedPath}), ${namesObject})`;
  },
  importAsStatement(cst, generate) {
    const { path, importAs } = cst;
    const processedPath = generate(path);
    return `scope.$.${importAs} = require(${processedPath})`;
  },
  importStatement(cst, generate) {
    const { path } = cst;
    const processedPath = generate(path);
    return `scope.extend(require(${processedPath}), null, moduleName(${processedPath}))`;
  },
  dotNotation(cst, generate) {
    const { parts } = cst;
    const [first, ...rest] = parts.map(part =>
      part.name == "symbol"
        ? part.raw
        : generate(part).replace(/scope\.\$./, "")
    );
    return `scope.$.${first}.${rest.join(".")}`;
  },
  method(cst, generate) {
    const { parts } = cst;
    const processedParts = parts.map(({ raw }) => `"${raw}"`).join(",");
    return `new Method([${processedParts}])`;
  },
  hashmap(cst, generate) {
    const { values } = cst;
    const makeHash = inValues => {
      const processed = [];
      for (const inValue of inValues) {
        const { key, value, values } = inValue;
        const processedValue = values ? makeHash(values) : generate(value);
        processed.push(`${key.raw}: (${processedValue})`);
      }
      return `{
        ${processed.join(",\n")}
      }`;
    };
    return makeHash(values);
  },
  boolean(cst, generate) {
    return cst.raw;
  },
  logical(cst, generate) {
    const { lhs, op, rhs } = cst;
    if (op.name == "not") return `(!${generate(rhs)})`;
    if (op.name == "and") return `(${generate(lhs)} && ${generate(rhs)})`;
    if (op.name == "or") return `(${generate(lhs)} || ${generate(rhs)})`;
  }
};

const generate = cst => rules[cst.name](cst, generate);
const generator = src => parser(src).then(generate);

module.exports = { generate, generator };
