const { rule, lPluck, map } = require("bean-parser");

const wrap = (fn, priority) =>
  rule((lhs, rhs) => {
    const result = fn(lhs, rhs);
    result.lambda = result.lambda || [];
    for (const it of [lhs, rhs]) {
      if (it.type == "wrapped") continue;
      if (it.type == "decorators") continue;
      if (it.type == "parameter") result.lambda.push(it);
      else if (it.lambda?.length) result.lambda.push(...it.lambda);
    }
    result.meta = {
      location: lhs.meta?.location || {
        file: lhs.file,
        line: lhs.line,
        column: lhs.column,
      },
    };
    return result;
  }, priority);

const ignore = (...rules) => map(rules, wrap(lPluck));

const ranges = ["range", "rangeFull", "rangeBy", "byRange", "ranger"];

const values = [
  "symbol",
  "parameter",
  "number",
  "array",
  "string",
  "formattedString",
  "hashmap",
  "propertyAccess",
  ...ranges,
  "slice",
  "set",
  "wrapped",
  "awaited",
  "parallelFn",
  "null",
  "true",
  "false",
  "inCheck",
  "group",
];
const arrayLike = ["array", "symbol", "propertyAccess", "slice"];
const expressions = [
  "math",
  "comparison",
  "logical",
  "logicalNot",
  "call",
  "parameterCall",
  "arrowAssignment",
];
const controls = ["conditional", "fullConditional"];
const topLevels = [
  ...controls,
  "function",
  "decoratedFunction",
  ...values,
  "assignment",
  "arrowAssignment",
  ...expressions,
  "importStatement",
  "typeDef",
];

const lexerTokens = [
  "if",
  "else",
  "fn",
  "await",
  "import",
  "as",
  "from",
  "export",
  "and",
  "or",
  "not",
  "by",
  "in",
  "number",
  "fmtStart",
  "fmtEnd",
  "strEscape",
  "fmtExprStart",
  "ender",
  "fmtExprEnd",
  "fmtStr",
  "format",
  "string",
  "comment",
  "outdent",
  "indent",
  "space",
  "awaitAll",
  "symbol",
  "parameter",
  "format",
  "slicer",
  "hash",
  "ranger",
  "dot",
  "pike",
  "lCurly",
  "rCurly",
  "lSquare",
  "rSquare",
  "lParen",
  "ender",
  "rParen",
  "colon",
  "arrow",
  "subOp",
  "addOp",
  "gte",
  "gt",
  "lte",
  "lt",
  "eq",
  "fatArrow",
  "assign",
  "divOp",
  "modOp",
  "powOp",
  "mulOp",
  "lineBreak",
  "groupOpen",
  "groupClose",
  "type",
  "is",
];

module.exports.wrap = wrap;
module.exports.ignore = ignore;
module.exports.topLevels = topLevels;
module.exports.controls = controls;
module.exports.expressions = expressions;
module.exports.arrayLike = arrayLike;
module.exports.ranges = ranges;
module.exports.values = values;
module.exports.lexerTokens = lexerTokens;
