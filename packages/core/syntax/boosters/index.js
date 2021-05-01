const { map } = require("bean-parser");
const { wrap } = require("../common");

module.exports = {
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
};
