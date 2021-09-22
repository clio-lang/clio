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
      type.members.push(types.get(rhs));
      type.type = "typeTailSingle";
      return type;
    }, 10),
  },
  typeTailSingle: {
    lineBreak: wrap((type) => {
      type.type = "typeDef";
      return type;
    }, 10),
    symbol: wrap((type, rhs) => {
      type.members.push(types.get(rhs));
      return type;
    }, 10),
  },
  typeTailIndent: {
    ...ignore("lineBreak"),
    outdent: wrap((type) => {
      type.type = "typeDef";
      return type;
    }, 10),
    symbol: wrap((type, rhs) => {
      type.members.push(types.get(rhs));
      return type;
    }, 10),
  },
};
