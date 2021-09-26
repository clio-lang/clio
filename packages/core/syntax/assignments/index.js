const { map, merge } = require("bean-parser");
const types = require("../../types");
const { expressions, wrap, values } = require("../common");

module.exports = merge(
  {
    // Assignment
    ...map(["symbol", "propertyAccess", "slice"], {
      assign: wrap((lhs, rhs) => {
        return { type: "assignOpen", name: lhs, assign: rhs };
      }, 10),
    }),
    assignOpen: {
      ...map(
        [...values, ...expressions],
        wrap((lhs, rhs) => {
          lhs.type = "assignment";
          lhs.value = types.get(rhs);
          return lhs;
        }, 0.001)
      ),
    },
  },
  {
    symbol: {
      assignment: wrap((lhs, rhs) => {
        return { type: "typedAssignment", assignment: rhs, valueType: lhs };
      }),
    },
  }
);
