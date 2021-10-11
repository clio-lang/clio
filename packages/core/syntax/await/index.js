import { values, wrap } from "../common.js";

import { map } from "bean-parser";

export default {
  // Await
  await: {
    ...map(
      [...values, "call", "parallelFn", "method"],
      wrap((lhs, rhs) => {
        return { type: "awaited", await: lhs, value: rhs };
      }, 0.4)
    ),
  },
  awaitAll: {
    ...map(
      [...values, "call", "parallelFn", "method"],
      wrap((lhs, rhs) => {
        return {
          type: "awaited",
          all: true,
          await: lhs,
          value: rhs,
        };
      }, 0.4)
    ),
  },
};
