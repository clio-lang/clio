import { map, merge } from "bean-parser";

import { wrap } from "../common.js";

export default merge(
  {
    ...map(
      [
        "symbol",
        "propertyAccess",
        "wrapped",
        "slice",
        "range",
        "parallelFn",
        "decorator",
        "decoratorAccess",
      ],
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
    ...map(
      [
        "symbol",
        "propertyAccess",
        "wrapped",
        "slice",
        "parallelFn",
        "decorator",
        "decoratorAccess",
      ],
      {
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
      }
    ),
  }
);
