const types = require("../../types");
const { wrap, ignore } = require("../common");

module.exports = {
  // Functions
  struct: {
    symbol: wrap((lhs, rhs) => {
      return {
        start: lhs,
        type: "structOpen",
        members: [],
        name: types.get(rhs),
      };
    }, 10),
  },
  structOpen: {
    colon: wrap((struct) => {
      struct.type = "structTail";
      return struct;
    }, 10),
  },
  structTail: {
    indent: wrap((struct) => {
      struct.type = "structTailIndent";
      return struct;
    }, 10),
    symbol: wrap((struct, rhs) => {
      struct.members.push(types.get(rhs));
      struct.type = "structTailSingle";
      return struct;
    }, 10),
  },
  structTailSingle: {
    lineBreak: wrap((struct) => {
      struct.type = "structDef";
      return struct;
    }, 10),
    symbol: wrap((struct, rhs) => {
      struct.members.push(types.get(rhs));
      return struct;
    }, 10),
  },
  structTailIndent: {
    ...ignore("lineBreak"),
    outdent: wrap((struct) => {
      struct.type = "structDef";
      return struct;
    }, 10),
    symbol: wrap((struct, rhs) => {
      struct.members.push(types.get(rhs));
      return struct;
    }, 10),
  },
};
