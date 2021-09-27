const { map, bean, merge, list } = require("bean-parser");
const { wrap, lexerTokens } = require("../common");

const rules = merge(
  require("../calls/index"),
  require("../blocks/index"),
  require("../parallelFns/index"),
  require("../functions/index"),
  require("../math/index"),
  require("../comparisons/index"),
  require("../logicals/index"),
  require("../conditionals/index"),
  require("../arrays/index"),
  require("../hashmaps/index"),
  require("../properties/index"),
  require("../methods/index"),
  require("../ranges/index"),
  require("../slices/index"),
  require("../sets/index"),
  require("../wrapped/index"),
  require("../formattedStrings/index"),
  require("../assignments/index"),
  require("../fatAssignments/index"),
  require("../await/index"),
  require("../exports/index"),
  require("../imports/index"),
  require("../in/index"),
  require("../clio/index"),
  require("../boosters/index")
);

module.exports = {
  // Group
  groupStart: {
    ...map(
      lexerTokens,
      wrap((_, rhs) => {
        return { type: "groupOpen", content: list([rhs]), open: 1 };
      }, 9999)
    ),
  },
  groupOpen: {
    ...map(
      lexerTokens,
      wrap((lhs, rhs) => {
        lhs.content.push(rhs);
        return lhs;
      }, 9999)
    ),
    groupStart: wrap((lhs) => {
      lhs.open++;
      return lhs;
    }, 9999),
    groupEnd: wrap((lhs, context) => {
      lhs.open--;
      // FIXME: We need error checking here
      return lhs.open
        ? lhs
        : bean(lhs.content, rules, true, context).first.item;
    }, 9999),
  },
};
