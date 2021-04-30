const { wrap } = require("../common");

module.exports = {
  // Export
  export: {
    function: wrap((lhs, rhs) => {
      return {
        type: "exportedFunction",
        name: rhs.name,
        value: rhs,
        export: lhs,
      };
    }),
    assignment: wrap((lhs, rhs) => {
      return {
        type: "exported",
        name: rhs.name,
        value: rhs,
        export: lhs,
      };
    }),
  },
};
