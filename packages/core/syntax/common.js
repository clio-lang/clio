const { rule } = require("bean-parser");
const wrap = (fn, priority) =>
  rule((lhs, rhs) => {
    const result = fn(lhs, rhs);
    result.lambda = result.lambda || [];
    for (const it of [lhs, rhs]) {
      if (it.type == "wrapped") continue;
      if (it.type == "parameter") result.lambda.push(it);
      else if (it.lambda?.length) result.lambda.push(...it.lambda);
    }
    result.meta = {
      location: rhs.meta?.location || {
        file: rhs.file,
        line: rhs.line,
        column: rhs.column,
      },
    };
    return result;
  }, priority);

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
];
const arrayLike = ["array", "symbol", "propertyAccess", "slice"];
const expressions = [
  "math",
  "comparison",
  "logical",
  "logicalNot",
  "call",
  "arrowAssignment",
];
const controls = ["conditional", "fullConditional"];
const topLevels = [
  ...controls,
  "function",
  ...values,
  "assignment",
  "arrowAssignment",
  ...expressions,
  "imported",
];

module.exports.topLevels = topLevels;
module.exports.controls = controls;
module.exports.expressions = expressions;
module.exports.arrayLike = arrayLike;
module.exports.wrap = wrap;
module.exports.ranges = ranges;
module.exports.values = values;
