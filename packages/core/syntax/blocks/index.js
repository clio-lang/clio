const { topLevels, wrap } = require("../common");
const { map, ignore } = require("bean-parser");

module.exports = {
  // Blocks
  lineBreak: {
    indent: wrap((_, rhs) => rhs, 99),
  },
  indent: {
    ...map(
      topLevels,
      wrap((_, rhs) => {
        return { type: "blockOpen", content: [rhs] };
      }, 0)
    ),
  },
  blockOpen: {
    ...ignore("lineBreak"),
    ...map(
      topLevels,
      wrap((lhs, rhs) => {
        lhs.content.push(rhs);
        return lhs;
      }, 0)
    ),
    outdent: wrap((lhs) => {
      lhs.type = "block";
      return lhs;
    }),
  },
};
