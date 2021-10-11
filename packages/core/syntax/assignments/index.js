import { expressions, values, wrap } from "../common.js";
import { map, merge } from "bean-parser";

export default merge(
  {
    // Assignment
    ...map(["symbol", "propertyAccess", "slice"], {
      assign: wrap((lhs, rhs) => {
        return { type: "assignOpen", name: lhs, assign: rhs };
      }, 10),
    }),
    assignOpen: {
      ...map(
        [...values, ...expressions],
        wrap((lhs, rhs) => {
          lhs.type = "assignment";
          lhs.value = rhs;
          return lhs;
        }, 0.001)
      ),
    },
  },
  {
    ...map(["symbol", "propertyAccess"], {
      assignment: wrap((lhs, rhs) => {
        return { type: "typedAssignment", assignment: rhs, valueType: lhs };
      }),
    }),
  }
);
