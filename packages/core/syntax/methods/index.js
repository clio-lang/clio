import { map } from "bean-parser";
import { wrap } from "../common.js";

export default {
  // Method
  dot: {
    ...map(
      ["symbol", "propertyAccess", "slice"],
      wrap((dot, rhs) => {
        return { type: "method", dot, property: rhs };
      }, 11)
    ),
  },
};
