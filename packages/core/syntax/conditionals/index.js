const { map, ignore } = require("bean-parser");
const types = require("../../types");
const { expressions, wrap, values } = require("../common");

module.exports = {
  // conditionals
  if: {
    ...map(
      expressions,
      wrap((lhs, rhs) => {
        return {
          type: "ifOpen",
          start: lhs,
          condition: types.get(rhs),
        };
      }, 0.05)
    ),
    ...map(
      values,
      wrap((lhs, rhs) => {
        return {
          type: "ifOpen",
          start: lhs,
          condition: types.get(rhs),
        };
      }, 0)
    ),
  },
  ifOpen: {
    colon: wrap((lhs) => {
      lhs.type = "ifTail";
      return lhs;
    }),
  },
  ifTail: {
    ...ignore("lineBreak"),
    block: wrap((lhs, rhs) => {
      return {
        type: "conditional",
        elseIfs: [],
        if: { ...lhs, type: "ifBlock", body: rhs },
      };
    }),
    ...map(
      [...expressions, ...values],
      wrap((lhs, rhs) => {
        const body = { type: "block", content: [rhs] };
        return {
          type: "conditional",
          elseIfs: [],
          if: { ...lhs, type: "ifBlock", body },
        };
      }, 0)
    ),
  },
  conditional: {
    lineBreak: wrap((lhs) => lhs, 100),
    else: wrap((lhs, rhs) => {
      return {
        type: "ifElseOpen",
        if: lhs.if,
        elseIfs: lhs.elseIfs,
        open: { start: rhs },
      };
    }),
  },
  ifElseOpen: {
    colon: wrap((lhs) => {
      lhs.type = "ifElseTail";
      return lhs;
    }),
    if: wrap((lhs, rhs) => {
      lhs.open.if = rhs;
      lhs.type = "ifElseIfNoCondition";
      return lhs;
    }),
  },
  ifElseIfNoCondition: {
    ...map(
      [...expressions, ...values],
      wrap((lhs, rhs) => {
        lhs.type = "ifElseIfOpen";
        lhs.open.condition = types.get(rhs);
        return lhs;
      }, 0)
    ),
  },
  ifElseIfOpen: {
    colon: wrap((lhs) => {
      lhs.type = "ifElseIfTail";
      return lhs;
    }),
  },
  ifElseIfTail: {
    ...ignore("lineBreak"),
    block: wrap((lhs, rhs) => {
      return {
        type: "conditional",
        if: lhs.if,
        elseIfs: [
          ...lhs.elseIfs,
          { ...lhs.open, type: "elseIfBlock", body: rhs },
        ],
        else: lhs.else,
      };
    }),
    ...map(
      [...expressions, ...values],
      wrap((lhs, rhs) => {
        const body = { type: "block", content: [rhs] };
        return {
          type: "conditional",
          if: lhs.if,
          elseIfs: [...lhs.elseIfs, { ...lhs.open, type: "elseIfBlock", body }],
          else: lhs.else,
        };
      }, 0)
    ),
  },
  ifElseTail: {
    ...ignore("lineBreak"),
    block: wrap((lhs, rhs) => {
      return {
        type: "fullConditional",
        if: lhs.if,
        elseIfs: [...lhs.elseIfs],
        else: { ...lhs.open, type: "elseBlock", body: rhs },
      };
    }),
    ...map(
      [...expressions, ...values],
      wrap((lhs, rhs) => {
        const body = { type: "block", content: [rhs] };
        return {
          type: "fullConditional",
          if: lhs.if,
          elseIfs: [...lhs.elseIfs],
          else: { ...lhs.open, type: "elseBlock", body },
        };
      }, 0)
    ),
  },
};
