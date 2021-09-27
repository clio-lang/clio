const { map } = require("bean-parser");
const { wrap, ranges, values } = require("../common");

module.exports = {
  // Range
  ranger: {
    ...map(
      values.filter((item) => !ranges.includes(item)),
      wrap((lhs, rhs) => {
        return { type: "range", location: lhs, end: rhs };
      }, 43)
    ),
    by: wrap((lhs, rhs) => {
      return { location: lhs, step: rhs.step, type: "rangeByOpen" };
    }, 99),
  },
  ...map(
    values.filter((item) => !ranges.includes(item)),
    {
      ranger: wrap((lhs, rhs) => {
        return { type: "range", start: lhs, location: rhs };
      }, 99.9),
    }
  ),
  range: {
    ...map(
      values.filter((item) => !ranges.includes(item)),
      wrap((lhs, rhs) => {
        lhs.type = "rangeFull";
        lhs.end = rhs;
        return lhs;
      }, 45)
    ),
    by: wrap((lhs, rhs) => {
      return { ...lhs, step: rhs.step, type: "rangeByOpen" };
    }, 99),
  },
  rangeFull: {
    by: wrap((lhs, rhs) => {
      return { ...lhs, step: rhs.step, type: "rangeByOpen" };
    }, 99),
  },
  by: {
    ...map(
      values.filter((item) => !ranges.includes(item)),
      wrap((lhs, rhs) => {
        return { type: "byRange", step: rhs, location: lhs };
      }, 47)
    ),
  },
  rangeByOpen: {
    ...map(
      values.filter((item) => !ranges.includes(item)),
      wrap((lhs, rhs) => {
        return { ...lhs, type: "byRange", step: rhs, location: lhs };
      }, 47)
    ),
  },
};
