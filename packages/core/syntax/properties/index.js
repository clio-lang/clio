const { map } = require("bean-parser");
const { wrap } = require("../common");

module.exports = {
  // Property Access
  ...map(["symbol", "propertyAccess", "slice", "parameter"], {
    dot: wrap((lhs, dot) => {
      return { type: "propertyAccessOpen", lhs, dot };
    }, 912),
  }),
  propertyAccessOpen: {
    symbol: wrap((lhs, rhs) => {
      return { ...lhs, type: "propertyAccess", rhs };
    }, 913),
  },
  ...map(["decorator", "decoratorAccess"], {
    dot: wrap((lhs, dot) => {
      return { type: "decoratorAccessOpen", lhs, dot };
    }, 912),
  }),
  decoratorAccessOpen: {
    symbol: wrap((lhs, rhs) => {
      return { ...lhs, type: "decoratorAccess", rhs };
    }, 913),
  },
};
