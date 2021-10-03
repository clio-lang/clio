import { wrap } from "../common.js";

export default {
  // Parallel functions
  pike: {
    symbol: wrap((pike, rhs) => {
      return { type: "pikeOpen", fn: rhs, start: pike };
    }),
  },
  pikeOpen: {
    pike: wrap((lhs) => {
      return { type: "parallelFn", fn: lhs.fn, start: lhs.start };
    }),
  },
};
