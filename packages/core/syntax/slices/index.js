import { arrayLike, wrap } from "../common.js";

import { map } from "bean-parser";

export default {
  // Slice
  sliceOpen: {
    array: wrap((lhs, rhs) => {
      lhs.type = "slice";
      lhs.slicer = rhs;
      return lhs;
    }, 100),
  },
  ...map(arrayLike, {
    slicer: wrap((lhs) => {
      return {
        type: "sliceOpen",
        slicee: lhs,
      };
    }, 99),
  }),
};
