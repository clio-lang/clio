const { rule, map } = require("bean-parser");
const { lPluck } = require("bean-parser");
const { expressions, wrap, values, ignore } = require("../common");

module.exports = {
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
