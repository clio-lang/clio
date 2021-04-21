const { map, ignore } = require("bean-parser");
const types = require("../../types");
const { expressions, wrap, values } = require("../common");

module.exports = {
  // Logical
  ...map([...values, ...expressions], {
    ...map(
      ["and", "or"],
      wrap((lhs, op) => {
        return {
          type: "logicalOpen",
          lhs: types.get(lhs),
          op,
          logicals: [],
        };
      }, 2)
    ),
  }),
  logicalOpen: {
    ...ignore("lineBreak"),
    ...map(
      [...values, ...expressions],
      wrap((lhs, rhs) => {
        return {
          type: "logical",
          lhs: lhs.lhs,
          logicals: [...lhs.logicals, { op: lhs.op, rhs: types.get(rhs) }],
        };
      }, 3)
    ),
  },
  logical: {
    ...ignore("lineBreak"),
    ...map(
      ["and", "or"],
      wrap((lhs, op) => {
        return {
          type: "logicalOpen",
          lhs: lhs.lhs,
          op,
          logicals: lhs.logicals,
        };
      })
    ),
  },
  not: {
    ...ignore("lineBreak"),
    ...map(
      [...values, ...expressions],
      wrap((op, rhs) => {
        return { type: "logicalNot", op, rhs: types.get(rhs) };
      }, 3.5)
    ),
  },
};
