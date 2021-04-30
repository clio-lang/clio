const { map } = require("bean-parser");
const types = require("../../types");
const { topLevels, wrap } = require("../common");

module.exports = {
  // Top level rule
  ...map([...topLevels, "exported", "exportedFunction"], {
    eof: wrap((lhs) => {
      return { type: "clio", content: [types.get(lhs)] };
    }, 0),
    clio: wrap((lhs, rhs) => {
      rhs.content.unshift(types.get(lhs));
      return rhs;
    }, 0),
  }),
  lineBreak: {
    clio: wrap((_, rhs) => rhs, 0),
    eof: wrap(() => {
      return { type: "clio", content: [] };
    }),
  },
};
