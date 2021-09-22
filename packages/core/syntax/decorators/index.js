const { wrap, ignore } = require("../common");
const { map } = require("bean-parser");

module.exports = {
  // Export
  parameterCall: {
    ...ignore("lineBreak"),
    function: wrap((lhs, rhs) => {
      rhs.type = "decoratedFunction";
      rhs.decorators = [lhs];
      return rhs;
    }),
    ...map(
      ["parameterCall", "parameter"],
      wrap((lhs, rhs) => {
        return {
          type: "decorator",
          decorators: [lhs, rhs],
        };
      })
    ),
  },
  parameter: {
    ...ignore("lineBreak"),
    function: wrap((lhs, rhs) => {
      rhs.type = "decoratedFunction";
      rhs.decorators = [lhs];
      return rhs;
    }),
    ...map(
      ["parameterCall", "parameter"],
      wrap((lhs, rhs) => {
        return {
          type: "decorator",
          decorators: [lhs, rhs],
        };
      })
    ),
  },
  decorator: {
    ...ignore("lineBreak"),
    function: wrap((lhs, rhs) => {
      rhs.type = "decoratedFunction";
      rhs.decorators = lhs.decorators;
      return rhs;
    }),
    ...map(
      ["parameterCall", "parameter"],
      wrap((lhs, rhs) => {
        lhs.decorators.push(rhs);
        return lhs;
      })
    ),
  },
};
