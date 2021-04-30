const { map } = require("bean-parser");
const { lPluck } = require("bean-parser");
const types = require("../../types");
const { wrap, values } = require("../common");

module.exports = {
  // Hashmaps
  hash: {
    symbol: wrap((lhs, rhs) => {
      return {
        type: "hashOpen",
        key: types.get(rhs),
        start: lhs,
        keyValues: [],
      };
    }, 4.1),
    indent: wrap((lhs) => {
      return {
        type: "hashmapIndent",
        start: lhs,
        keyValues: [],
        isTopLevel: true,
      };
    }),
  },
  hashOpen: {
    ...map(
      values,
      wrap((lhs, rhs) => {
        lhs.type = "hashmap";
        lhs.keyValues.push(
          types.get({
            type: "keyValue",
            key: lhs.key,
            value: types.get(rhs),
          })
        );
        return lhs;
      }, 4.1)
    ),
    indent: wrap((lhs, rhs) => {
      return {
        type: "hashmapIndent",
        parent: lhs,
        keyValues: [],
        start: rhs,
      };
    }),
  },
  hashmap: {
    symbol: wrap((lhs, rhs) => {
      lhs.key = types.get(rhs);
      lhs.type = "hashOpen";
      return lhs;
    }, 4.1),
    indent: wrap((lhs) => {
      lhs.type = "hashmapIndent";
      lhs.isTopLevel = true;
      return lhs;
    }),
  },
  // Nested Hashmap
  hashIndentOpen: {
    ...map(["lineBreak"], wrap(lPluck, 3)),
    ...map(
      values,
      wrap((lhs, rhs) => {
        lhs.type = "hashmapIndent";
        lhs.keyValues.push(
          types.get({
            type: "keyValue",
            key: lhs.key,
            value: types.get(rhs),
          })
        );
        return lhs;
      }, 4.1)
    ),
    indent: wrap((lhs, rhs) => {
      return {
        type: "hashmapIndent",
        parent: lhs,
        start: rhs,
        keyValues: [],
      };
    }),
  },
  hashmapIndent: {
    ...map(["lineBreak"], wrap(lPluck, 3)),
    symbol: wrap((lhs, rhs) => {
      lhs.key = types.get(rhs);
      lhs.type = "hashIndentOpen";
      return lhs;
    }, 4.1),
    outdent: wrap((lhs) => {
      const { parent, isTopLevel } = lhs;
      if (isTopLevel) {
        lhs.type = "hashmap";
        return lhs;
      }
      lhs.type = "hashmap";
      parent.type = parent.type == "hashOpen" ? "hashmap" : "hashmapIndent";
      parent.keyValues.push(
        types.get({
          type: "keyValue",
          key: parent.key,
          value: types.get(lhs),
        })
      );
      return parent;
    }),
  },
};
