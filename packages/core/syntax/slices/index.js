const { map } = require("bean-parser");
const { arrayLike, wrap } = require("../common");

module.exports = {
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
