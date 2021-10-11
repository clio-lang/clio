import { expressions, ignore, values, wrap } from "../common.js";
import { lPluck, map, rule } from "bean-parser";

export default {
  // Wrapped
  lParen: {
    ...map(["lineBreak"], rule(lPluck, 10)),
    ...map(
      [...values, ...expressions],
      wrap((lhs, rhs) => {
        return { type: "wrappedOpen", start: lhs, content: rhs };
      }, 0.1)
    ),
    rParen: wrap(() => {
      return { type: "wrapped", content: null };
    }),
    ender: wrap((lhs) => lhs, 100),
  },
  wrappedOpen: {
    ...ignore("lineBreak"),
    rParen: wrap((lhs, rhs) => {
      lhs.type = "wrapped";
      lhs.end = rhs;
      return lhs;
    }),
  },
};
