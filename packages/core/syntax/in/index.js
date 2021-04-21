const { map } = require("bean-parser");
const { expressions, wrap, values } = require("../common");

module.exports = {
  // In check
  ...map([...expressions, ...values], {
    in: wrap((lhs, rhs) => {
      return { type: "inCheckOpen", lhs: lhs, start: rhs };
    }, 0.1),
  }),
  inCheckOpen: {
    ...map(
      [...expressions, ...values],
      wrap((lhs, rhs) => {
        lhs.type = "inCheck";
        lhs.rhs = rhs;
        return lhs;
      })
    ),
  },
};
