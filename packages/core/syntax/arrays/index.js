import { expressions, ignore, values, wrap } from "../common.js";

import { map } from "bean-parser";

export default {
  // Arrays
  lSquare: {
    ...ignore("lineBreak"),
    ...map(
      [...values, ...expressions],
      wrap((lhs, rhs) => {
        return { type: "arrayOpen", start: lhs, items: [rhs] };
      }, 4.1)
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
        lhs.items.push(rhs);
        return lhs;
      }, 4.1)
    ),
    rSquare: wrap((lhs, rhs) => {
      lhs.type = "array";
      lhs.end = rhs;
      return lhs;
    }),
  },
};
