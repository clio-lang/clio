import { ignore, topLevels, wrap } from "../common.js";

import { map } from "bean-parser";

const blockLevels = topLevels.filter((tl) => tl !== "importStatement");

export default {
  // Blocks
  lineBreak: {
    indent: wrap((_, rhs) => rhs, 99),
  },
  indent: {
    ...map(
      blockLevels,
      wrap((_, rhs) => {
        return { type: "blockOpen", content: [rhs] };
      }, 0)
    ),
  },
  blockOpen: {
    ...ignore("lineBreak"),
    ...map(
      blockLevels,
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
