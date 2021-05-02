const { map } = require("bean-parser");
const types = require("../../types");
const { arrayLike, wrap } = require("../common");

module.exports = {
  // Slice
  sliceOpen: {
    array: wrap((lhs, rhs) => {
      lhs.type = "slice";
      lhs.slicer = types.get(rhs);
      return lhs;
    }, 100),
  },
  ...map(arrayLike, {
    slicer: wrap((lhs) => {
      return {
        type: "sliceOpen",
        slicee: types.get(lhs),
      };
    }, 99),
  }),
};
