import { expressions, ignore, values, wrap } from "../common.js";

import { map } from "bean-parser";

export default {
  // Functions
  fn: {
    symbol: wrap((lhs, rhs) => {
      return {
        start: lhs,
        type: "fnOpen",
        params: [],
        name: rhs,
      };
    }, 10),
  },
  fnOpen: {
    symbol: wrap((fn, rhs) => {
      fn.params.push(rhs);
      return fn;
    }, 10),
    colon: wrap((fn) => {
      fn.type = "fnTail";
      return fn;
    }),
  },
  fnTail: {
    ...ignore("lineBreak"),
    block: wrap((lhs, rhs) => {
      lhs.type = "function";
      rhs.type = "return";
      rhs.recursefn = lhs;
      lhs.body = rhs;
      return lhs;
    }, 10),
    ...map(
      [...expressions, ...values],
      wrap((lhs, rhs) => {
        lhs.type = "function";
        lhs.body = { type: "return", content: [rhs] };
        return lhs;
      }, 0)
    ),
  },
};
