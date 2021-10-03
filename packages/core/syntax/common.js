import { lPluck, map, rule } from "bean-parser";

const wrap = (fn, priority) =>
  rule((lhs, rhs, context) => {
    const result = fn(lhs, rhs, context);
    result.lambda = result.lambda || [];
    for (const it of [lhs, rhs]) {
      if (it.type == "wrapped") continue;
      if (it.type == "decorators") continue;
      if (it.type == "parameter" && result.type !== "parameter") {
        result.lambda.push(it);
      } else if (it.lambda?.length && it !== result) {
        result.lambda.push(...it.lambda);
      }
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
  "decoratedExportedFunction",
  ...values,
  "assignment",
  "arrowAssignment",
  "typedAssignment",
  ...expressions,
  "importStatement",
  "typeDef",
  "listDef",
];

const rootLevels = [...topLevels, "exported", "exportedFunction"];

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

const _wrap = wrap;
export { _wrap as wrap };
const _ignore = ignore;
export { _ignore as ignore };
const _topLevels = topLevels;
export { _topLevels as topLevels };
const _rootLevels = rootLevels;
export { _rootLevels as rootLevels };
const _controls = controls;
export { _controls as controls };
const _expressions = expressions;
export { _expressions as expressions };
const _arrayLike = arrayLike;
export { _arrayLike as arrayLike };
const _ranges = ranges;
export { _ranges as ranges };
const _values = values;
export { _values as values };
const _lexerTokens = lexerTokens;
export { _lexerTokens as lexerTokens };
