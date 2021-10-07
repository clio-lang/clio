import { ignore, wrap } from "../common.js";

import { map } from "bean-parser";

export default {
  list: {
    symbol: wrap((lhs, rhs) => {
      return {
        start: lhs,
        type: "listOpen",
        members: [],
        name: rhs,
      };
    }, 10),
  },
  listOpen: {
    colon: wrap((list) => {
      list.type = "listTail";
      return list;
    }, 10),
  },
  listTail: {
    indent: wrap((list) => {
      list.type = "listTailIndent";
      return list;
    }, 10),
    ...map(
      ["symbol", "propertyAccess"],
      wrap((list, rhs) => {
        list.memberType = rhs;
        list.type = "listTailSingle";
        return list;
      }, 10)
    ),
  },
  listTailSingle: {
    lineBreak: wrap((list) => {
      list.type = "listDef";
      return list;
    }, 10),
  },
  listTailIndent: {
    ...ignore("lineBreak"),
    ...map(
      ["symbol", "propertyAccess"],
      wrap((list, rhs) => {
        list.memberType = rhs;
        list.type = "listTailIndentComplete";
        return list;
      }, 10)
    ),
  },
  listTailIndentComplete: {
    ...ignore("lineBreak"),
    outdent: wrap((list) => {
      list.type = "listDef";
      return list;
    }, 10),
  },
};
