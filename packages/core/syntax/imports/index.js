const { map } = require("bean-parser");
const { wrap } = require("../common");

module.exports = {
  // Import
  import: {
    ...map(
      ["asClause", "symbol"],
      wrap((lhs, rhs) => {
        return { type: "importOpen", items: [rhs], import: lhs };
      }, 17)
    ),
    string: wrap((lhs, rhs) => {
      return { type: "imported", import: lhs, path: rhs };
    }),
  },
  importOpen: {
    ...map(
      ["asClause", "symbol"],
      wrap((lhs, rhs) => {
        lhs.items.push(rhs);
        return lhs;
      }, 18)
    ),
    from: wrap((lhs, rhs) => {
      lhs.from = rhs;
      lhs.type = "importFromOpen";
      return lhs;
    }),
  },
  importFromOpen: {
    string: wrap((lhs, rhs) => {
      lhs.path = rhs;
      lhs.type = "imported";
      return lhs;
    }),
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
