const { map } = require("bean-parser");
const { wrap } = require("../common");

module.exports = {
  // Method
  dot: {
    ...map(
      ["symbol", "propertyAccess", "slice"],
      wrap((dot, rhs) => {
        return { type: "method", dot, property: rhs };
      }, 11)
    ),
  },
};
