import { expressions, ignore, values, wrap } from "../common.js";

import { map } from "bean-parser";

export default {
  // Sets
  lCurly: {
    ...ignore("lineBreak"),
    ...map(
      [...values, ...expressions],
      wrap((lhs, rhs) => {
        return { type: "setOpen", start: lhs, items: [rhs] };
      })
    ),
    rCurly: wrap((lhs, rhs) => {
      return { type: "set", start: lhs, end: rhs, items: [] };
    }),
  },
  setOpen: {
    ...ignore("lineBreak"),
    ...map(
      [...values, ...expressions],
      wrap((lhs, rhs) => {
        lhs.items.push(rhs);
        return lhs;
      })
    ),
    rCurly: wrap((lhs, rhs) => {
      lhs.type = "set";
      lhs.end = rhs;
      return lhs;
    }),
  },
};
