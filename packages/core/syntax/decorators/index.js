const { wrap, ignore } = require("../common");
const { map } = require("bean-parser");

module.exports = {
  // Export
  decoratorCall: {
    ...ignore("lineBreak"),
    function: wrap((lhs, rhs) => {
      rhs.type = "decoratedFunction";
      rhs.decorators = [lhs];
      return rhs;
    }),
    ...map(
      ["decoratorCall", "decorator", "decoratorAccess"],
      wrap((lhs, rhs) => {
        return {
          type: "decorators",
          decorators: [lhs, rhs],
        };
      }, 0)
    ),
  },
  ...map(["decorator", "decoratorAccess"], {
    ...ignore("lineBreak"),
    function: wrap((lhs, rhs) => {
      rhs.type = "decoratedFunction";
      rhs.decorators = [lhs];
      return rhs;
    }),
    ...map(
      ["decoratorCall", "decorator", "decoratorAccess"],
      wrap((lhs, rhs) => {
        return {
          type: "decorators",
          decorators: [lhs, rhs],
        };
      }, 0)
    ),
  }),
  decorators: {
    ...ignore("lineBreak"),
    function: wrap((lhs, rhs) => {
      rhs.type = "decoratedFunction";
      rhs.decorators = lhs.decorators;
      return rhs;
    }),
    ...map(
      ["decoratorCall", "decorator", "decoratorAccess"],
      wrap((lhs, rhs) => {
        lhs.decorators.push(rhs);
        return lhs;
      }, 0)
    ),
  },
};
