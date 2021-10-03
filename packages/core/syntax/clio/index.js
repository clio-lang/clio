import { rootLevels, wrap } from "../common.js";

import { map } from "bean-parser";

export default {
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
