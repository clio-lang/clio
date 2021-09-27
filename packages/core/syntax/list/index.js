const types = require("../../types");
const { wrap, ignore } = require("../common");

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
    is: wrap((list) => {
      list.type = "listOpenIsOpen";
      return list;
    }),
    colon: wrap((list) => {
      list.type = "listTail";
      return list;
    }, 10),
  },
  listOpenIsOpen: {
    symbol: wrap((list, rhs) => {
      list.extends = rhs;
      list.type = "listOpenIs";
      return list;
    }),
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
    symbol: wrap((list, rhs) => {
      list.members.push(rhs);
      list.type = "listTailSingle";
      return list;
    }, 10),
  },
  listTailSingle: {
    lineBreak: wrap((list) => {
      list.type = "listDef";
      return list;
    }, 10),
    symbol: wrap((list, rhs) => {
      list.members.push(rhs);
      return list;
    }, 10),
  },
  listTailIndent: {
    ...ignore("lineBreak"),
    outdent: wrap((list) => {
      list.type = "listDef";
      return list;
    }, 10),
    symbol: wrap((list, rhs) => {
      list.members.push(rhs);
      return list;
    }, 10),
  },
};
