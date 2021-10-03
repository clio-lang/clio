import { expressions, ignore, values, wrap } from "../common.js";

import { map } from "bean-parser";

export default {
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
