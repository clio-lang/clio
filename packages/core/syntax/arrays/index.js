const { map, ignore } = require("bean-parser");
const types = require("../../types");
const { expressions, wrap, values } = require("../common");

module.exports = {
  // Arrays
  lSquare: {
    ...ignore("lineBreak"),
    ...map(
      [...values, ...expressions],
      wrap((lhs, rhs) => {
        return { type: "arrayOpen", start: lhs, items: [types.get(rhs)] };
      }, 0.1)
    ),
    rSquare: wrap((lhs, rhs) => {
      return { type: "array", start: lhs, end: rhs, items: [] };
    }),
  },
  arrayOpen: {
    ...ignore("lineBreak"),
    ...map(
      [...values, ...expressions],
      wrap((lhs, rhs) => {
        lhs.items.push(types.get(rhs));
        return lhs;
      }, 0.1)
    ),
    rSquare: wrap((lhs, rhs) => {
      lhs.type = "array";
      lhs.end = rhs;
      return lhs;
    }),
  },
};
