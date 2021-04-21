const { map, mapfn, ignore } = require("bean-parser");
const types = require("../../types");
const { wrap, values } = require("../common");

module.exports = {
  // Math
  /*
    Even though we're doing a 1:1 translation to JavaScript
    and we do not care about op priorities, I decided to
    implement them anyways because that's the correct way
    of doing it.
  */
  ...map([...values, "math"], {
    powOp: wrap((lhs, op) => {
      return { type: "powLhs", lhs: types.get(lhs), op };
    }, 9),
    mulOp: wrap((lhs, op) => {
      return { type: "mulLhs", lhs: types.get(lhs), op };
    }, 8),
    divOp: wrap((lhs, op) => {
      return { type: "divLhs", lhs: types.get(lhs), op };
    }, 8),
    addOp: wrap((lhs, op) => {
      return { type: "addLhs", lhs: types.get(lhs), op };
    }, 7),
    subOp: wrap((lhs, op) => {
      return { type: "subLhs", lhs: types.get(lhs), op };
    }, 7),
    modOp: wrap((lhs, op) => {
      return { type: "modLhs", lhs: types.get(lhs), op };
    }, 7),
  }),
  ...mapfn(["add", "sub", "mul", "div", "pow", "mod"], (op) => [
    `${op}Lhs`,
    {
      ...ignore("lineBreak"),
      ...map(
        values,
        wrap((lhs, rhs) => {
          return {
            type: "math",
            value: types.get({
              type: op,
              op: lhs.op,
              lhs: lhs.lhs,
              rhs: types.get(rhs),
            }),
          };
        }, 10)
      ),
    },
  ]),
};
