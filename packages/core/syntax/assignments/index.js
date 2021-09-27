const { map, merge } = require("bean-parser");
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
          lhs.value = rhs;
          return lhs;
        }, 0.001)
      ),
    },
  },
  {
    ...map(["symbol", "propertyAccess"], {
      assignment: wrap((lhs, rhs) => {
        return { type: "typedAssignment", assignment: rhs, valueType: lhs };
      }),
    }),
  }
);
