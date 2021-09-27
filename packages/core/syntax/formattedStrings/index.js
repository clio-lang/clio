const { rule, map } = require("bean-parser");
const { lPluck } = require("bean-parser");
const types = require("../../types");
const { expressions, wrap, values, ignore } = require("../common");

module.exports = {
  // Formatted Strings
  ...map(["symbol", "propertyAccess", "slice"], {
    format: wrap((lhs) => {
      return { type: "fmtStrFn", fn: lhs, args: [] };
    }, 99),
  }),
  fmtStrFn: {
    fmtStart: wrap((lhs) => {
      lhs.type = "fmtOpen";
      return lhs;
    }, 99),
  },
  fmtOpen: {
    ...map(
      ["fmtExpr", "strEscape", "fmtStr"],
      wrap((lhs, rhs) => {
        lhs.args.push(rhs);
        return lhs;
      }, 99)
    ),
    fmtEnd: wrap((lhs) => {
      lhs.type = "formattedString";
      return lhs;
    }),
  },
  // fmtExpr
  fmtExprStart: {
    ...map(["lineBreak"], rule(lPluck, 10)),
    ...map(
      [...values, ...expressions],
      wrap((lhs, rhs) => {
        return { type: "fmtExprOpen", start: lhs, content: rhs };
      }, 0.11)
    ),
    fmtExprEnd: wrap(() => {
      return { type: "fmtExpr", content: null };
    }),
    ender: wrap((lhs) => lhs, 100),
  },
  fmtExprOpen: {
    ...ignore("lineBreak"),
    fmtExprEnd: wrap((lhs, rhs) => {
      lhs.type = "fmtExpr";
      lhs.end = rhs;
      return lhs;
    }),
  },
};
