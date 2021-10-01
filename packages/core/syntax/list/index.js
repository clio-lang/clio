const { wrap, ignore } = require("../common");
const { map } = require("bean-parser");

module.exports = {
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
  listOpenIs: {
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
    outdent: wrap((list) => {
      list.type = "listDef";
      return list;
    }, 10),
  },
};
