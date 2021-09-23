const { map, merge } = require("bean-parser");
const { wrap } = require("../common");

const specials = [
  "symbol",
  "propertyAccess",
  "wrapped",
  "slice",
  "parallelFn",
  "decorator",
  "decoratorAccess",
];

module.exports = merge(
  {
    ...map(specials, {
      ...map(
        ["groupStart"],
        wrap(
          /* istanbul ignore next */
          () => {
            /* This never matches, but boosts wrapped, array,
             hashmap, set vs block rule matching */
          },
          0.5
        )
      ),
    }),
  },
  {
    ...map(specials, {
      ...map(
        ["hash"],
        wrap(
          /* istanbul ignore next */
          () => {
            /* This never matches, but boosts wrapped, array,
             hashmap, set vs block rule matching */
          },
          0.05
        )
      ),
    }),
  }
);
