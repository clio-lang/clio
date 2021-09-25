const { map } = require("bean-parser");
const { rootLevels, wrap } = require("../common");

module.exports = {
  // Top level rule
  ...map(rootLevels, {
    eof: wrap((lhs) => {
      return { type: "clio", content: [lhs] };
    }, 0),
    clio: wrap((lhs, rhs) => {
      rhs.content.unshift(lhs);
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
