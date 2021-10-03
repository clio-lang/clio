import { expressions, values, wrap } from "../common.js";

import { map } from "bean-parser";

export default {
  // In check
  ...map([...expressions, ...values], {
    in: wrap((lhs, rhs) => {
      return { type: "inCheckOpen", lhs: lhs, start: rhs };
    }, 0.1),
  }),
  inCheckOpen: {
    ...map(
      [...expressions, ...values],
      wrap((lhs, rhs) => {
        lhs.type = "inCheck";
        lhs.rhs = rhs;
        return lhs;
      })
    ),
  },
};
