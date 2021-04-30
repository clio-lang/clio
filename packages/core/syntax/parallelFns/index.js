const { wrap } = require("../common");
const types = require("../../types");

module.exports = {
  // Parallel functions
  pike: {
    symbol: wrap((pike, rhs) => {
      return { type: "pikeOpen", fn: types.get(rhs), start: pike };
    }),
  },
  pikeOpen: {
    pike: wrap((lhs) => {
      return { type: "parallelFn", fn: lhs.fn, start: lhs.start };
    }),
  },
};
