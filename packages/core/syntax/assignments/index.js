const { map } = require("bean-parser");
const types = require("../../types");
const { expressions, wrap, values } = require("../common");

module.exports = {
  // Assignment
  symbol: {
    assign: wrap((lhs, rhs) => {
      return { type: "assignOpen", name: types.get(lhs), assign: rhs };
    }),
  },
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
};
