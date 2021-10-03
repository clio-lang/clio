import { ignore, wrap } from "../common.js";

import { map } from "bean-parser";

export default {
  // Import
  import: {
    string: wrap((lhs, rhs) => {
      return { type: "importStatement", import: lhs, path: rhs };
    }),
    stringAsClause: wrap((lhs, rhs) => {
      return {
        ...rhs,
        import: lhs,
        type: "importStatement",
      };
    }, 99),
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
    indent: wrap((lhs) => {
      lhs.type = "importFromIndented";
      lhs.items = [];
      return lhs;
    }, 80),
  },
  importFromIndented: {
    ...map(
      ["asClause", "symbol"],
      wrap((lhs, rhs) => {
        return {
          ...lhs,
          items: [...lhs.items, rhs],
        };
      }, 31)
    ),
    outdent: wrap((lhs) => {
      return {
        ...lhs,
        type: "importStatement",
      };
    }),
    ...ignore("lineBreak"),
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
  string: {
    as: wrap((lhs, rhs) => {
      return { type: "stringAsOpen", path: lhs, as: rhs };
    }, 32),
  },
  stringAsOpen: {
    symbol: wrap((lhs, rhs) => {
      return {
        type: "stringAsClause",
        path: lhs.path,
        items: [{ type: "asClause", as: lhs.as, rhs, lhs: { type: "mulOp" } }],
      };
    }, 33),
  },
};
