const { map, merge } = require("bean-parser");
const { wrap } = require("../common");

module.exports = merge(
  {
    ...map(
      ["symbol", "propertyAccess", "wrapped", "slice", "range", "parallelFn"],
      {
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
      }
    ),
  },
  {
    ...map(["symbol", "propertyAccess", "wrapped", "slice", "parallelFn"], {
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
