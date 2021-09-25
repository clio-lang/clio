const types = require("../../types");
const { wrap, ignore } = require("../common");

module.exports = {
  collection: {
    symbol: wrap((lhs, rhs) => {
      return {
        start: lhs,
        type: "collectionOpen",
        members: [],
        name: types.get(rhs),
      };
    }, 10),
  },
  collectionOpen: {
    is: wrap((collection) => {
      collection.type = "collectionOpenIsOpen";
      return collection;
    }),
    colon: wrap((collection) => {
      collection.type = "collectionTail";
      return collection;
    }, 10),
  },
  collectionOpenIsOpen: {
    symbol: wrap((collection, rhs) => {
      collection.extends = types.get(rhs);
      collection.type = "collectionOpenIs";
      return collection;
    }),
  },
  collectionOpenIs: {
    colon: wrap((collection) => {
      collection.type = "collectionTail";
      return collection;
    }, 10),
  },
  collectionTail: {
    indent: wrap((collection) => {
      collection.type = "collectionTailIndent";
      return collection;
    }, 10),
    symbol: wrap((collection, rhs) => {
      collection.members.push(types.get(rhs));
      collection.type = "collectionTailSingle";
      return collection;
    }, 10),
  },
  collectionTailSingle: {
    lineBreak: wrap((collection) => {
      collection.type = "collectionDef";
      return collection;
    }, 10),
    symbol: wrap((collection, rhs) => {
      collection.members.push(types.get(rhs));
      return collection;
    }, 10),
  },
  collectionTailIndent: {
    ...ignore("lineBreak"),
    outdent: wrap((collection) => {
      collection.type = "collectionDef";
      return collection;
    }, 10),
    symbol: wrap((collection, rhs) => {
      collection.members.push(types.get(rhs));
      return collection;
    }, 10),
  },
};
