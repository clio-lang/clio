const { map } = require("bean-parser");
const types = require("../../types");
const { expressions, wrap, values, ignore } = require("../common");

module.exports = {
  // Functions
  fn: {
    symbol: wrap((lhs, rhs, context) => {
      const outerScope = { ...context.scope };
      return {
        start: lhs,
        type: "fnOpen",
        params: [],
        name: types.get(rhs),
        outerScope,
      };
    }, 10),
  },
  fnOpen: {
    symbol: wrap((fn, rhs) => {
      fn.params.push(types.get(rhs));
      return fn;
    }, 10),
    colon: wrap((fn) => {
      fn.type = "fnTail";
      return fn;
    }),
  },
  fnTail: {
    ...ignore("lineBreak"),
    block: wrap((lhs, rhs) => {
      lhs.type = "function";
      rhs.type = "return";
      rhs.recursefn = lhs;
      lhs.body = rhs;
      return lhs;
    }, 10),
    ...map(
      [...expressions, ...values],
      wrap((lhs, rhs) => {
        lhs.type = "function";
        lhs.body = { type: "return", content: [rhs] };
        return lhs;
      }, 0)
    ),
  },
  comment: {
    ...ignore("lineBreak"),
    function: wrap((lhs, rhs) => {
      rhs.doc = lhs;
      return rhs;
    }, 2),
    exportedFunction: wrap((lhs, rhs) => {
      rhs.value.doc = lhs;
      return rhs;
    }, 2),
  },
};
