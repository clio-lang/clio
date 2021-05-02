const { map } = require("bean-parser");
const { wrap } = require("../common");

module.exports = {
  // Property Access
  ...map(["symbol", "propertyAccess", "slice", "parameter"], {
    dot: wrap((lhs, dot) => {
      return { type: "propertyAccessOpen", lhs, dot };
    }, 12),
  }),
  propertyAccessOpen: {
    symbol: wrap((lhs, rhs) => {
      return { ...lhs, type: "propertyAccess", rhs };
    }, 13),
  },
};
