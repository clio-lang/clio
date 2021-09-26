const types = require("../../types");
const { wrap, ignore } = require("../common");

module.exports = {
  // Functions
  type: {
    symbol: wrap((lhs, rhs) => {
      return {
        start: lhs,
        type: "typeOpen",
        members: [],
        name: types.get(rhs),
      };
    }, 10),
  },
  typeOpen: {
    is: wrap((type) => {
      type.type = "typeOpenIsOpen";
      return type;
    }),
    colon: wrap((type) => {
      type.type = "typeTail";
      return type;
    }, 10),
  },
  typeOpenIsOpen: {
    symbol: wrap((type, rhs) => {
      type.extends = types.get(rhs);
      type.type = "typeOpenIs";
      return type;
    }),
  },
  typeOpenIs: {
    colon: wrap((type) => {
      type.type = "typeTail";
      return type;
    }, 10),
  },
  typeTail: {
    indent: wrap((type) => {
      type.type = "typeTailIndent";
      return type;
    }, 10),
    symbol: wrap((type, rhs) => {
      type.curr = types.get(rhs);
      type.type = "typeTailSingleCurr";
      return type;
    }, 10),
  },
  typeTailSingle: {
    lineBreak: wrap((type) => {
      type.type = "typeDef";
      return type;
    }, 10),
    symbol: wrap((type, rhs) => {
      type.curr = types.get(rhs);
      type.type = "typeTailSingleCurr";
      return type;
    }, 10),
  },
  typeTailSingleCurr: {
    symbol: wrap((type, rhs) => {
      type.members.push({ type: "Any", name: type.curr });
      type.curr = types.get(rhs);
      type.type = "typeTailSingleCurr";
      return type;
    }, 10),
    assign: wrap((type) => {
      type.type = "typeTailSingleAssign";
      return type;
    }, 10),
    lineBreak: wrap((type) => {
      type.members.push({ type: "Any", name: type.curr });
      type.curr = null;
      type.type = "typeDef";
      return type;
    }, 10),
  },
  typeTailSingleAssign: {
    symbol: wrap((type, rhs) => {
      type.members.push({ type: types.get(rhs), name: type.curr });
      type.curr = null;
      type.type = "typeTailSingle";
      return type;
    }),
  },
  typeTailIndent: {
    ...ignore("lineBreak"),
    outdent: wrap((type) => {
      type.type = "typeDef";
      return type;
    }, 10),
    symbol: wrap((type, rhs) => {
      type.curr = types.get(rhs);
      type.type = "typeTailIndentCurr";
      return type;
    }, 10),
  },
  typeTailIndentCurr: {
    ...ignore("lineBreak"),
    outdent: wrap((type) => {
      type.members.push({ type: "Any", name: type.curr });
      type.type = "typeDef";
      return type;
    }, 10),
    symbol: wrap((type, rhs) => {
      type.members.push({ type: "Any", name: type.curr });
      type.curr = types.get(rhs);
      type.type = "typeTailIndentCurr";
      return type;
    }, 10),
    assign: wrap((type) => {
      type.type = "typeTailIndentAssign";
      return type;
    }, 10),
  },
  typeTailIndentAssign: {
    symbol: wrap((type, rhs) => {
      type.members.push({ type: types.get(rhs), name: type.curr });
      type.curr = null;
      type.type = "typeTailIndent";
      return type;
    }),
  },
};
