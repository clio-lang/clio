const { map } = require("bean-parser");
const { wrap } = require("../common");

module.exports = {
  // Import
  import: {
    string: wrap((lhs, rhs) => {
      return { type: "importStatement", import: lhs, path: rhs };
    }),
  },
  from: {
    string: wrap((lhs, rhs) => {
      return {
        type: "fromPath",
        path: rhs,
        from: lhs,
        items: [],
      };
    }, 30),
  },
  fromPath: {
    import: wrap((lhs, rhs) => {
      return {
        ...lhs,
        import: rhs,
        type: "importFromOpen",
      };
    }, 29),
  },
  importFromOpen: {
    ...map(
      ["asClause", "symbol"],
      wrap((lhs, rhs) => {
        return {
          ...lhs,
          items: [rhs],
          type: "importFromTail",
        };
      }, 31)
    ),
  },
  importFromTail: {
    ...map(
      ["asClause", "symbol"],
      wrap((lhs, rhs) => {
        lhs.items.push(rhs);
        return lhs;
      }, 31)
    ),
    lineBreak: wrap((lhs) => {
      return {
        ...lhs,
        type: "importStatement",
      };
    }, 99),
  },
  ...map(["symbol", "mulOp"], {
    as: wrap((lhs, rhs) => {
      return { type: "asOpen", lhs, as: rhs };
    }, 32),
  }),
  asOpen: {
    symbol: wrap((lhs, rhs) => {
      lhs.rhs = rhs;
      lhs.type = "asClause";
      return lhs;
    }, 33),
  },
};
