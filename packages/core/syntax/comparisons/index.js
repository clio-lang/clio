const { map } = require("bean-parser");
const { expressions, wrap, values, ignore } = require("../common");

module.exports = {
  // Comparisons
  ...map([...values, ...expressions], {
    ...map(
      ["eq", "gt", "lt", "gte", "lte"],
      wrap((lhs, op) => {
        return {
          type: "comparisonOpen",
          lhs,
          op,
          comparisons: [],
        };
      }, 5)
    ),
  }),
  comparisonOpen: {
    ...ignore("lineBreak"),
    ...map(
      [...values, ...expressions],
      wrap((lhs, rhs) => {
        return {
          type: "comparison",
          lhs: lhs.lhs,
          comparisons: [...lhs.comparisons, { op: lhs.op, rhs }],
        };
      }, 6)
    ),
  },
  comparison: {
    ...ignore("lineBreak"),
    ...map(
      ["eq", "gt", "lt", "gte", "lte"],
      wrap((lhs, op) => {
        return {
          type: "comparisonOpen",
          lhs: lhs.lhs,
          op,
          comparisons: lhs.comparisons,
        };
      })
    ),
  },
};
