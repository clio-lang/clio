const { merge } = require("bean-parser");

const rules = merge(
  require("./syntax/groups/index"),
  require("./syntax/calls/index"),
  require("./syntax/blocks/index"),
  require("./syntax/parallelFns/index"),
  require("./syntax/functions/index"),
  require("./syntax/math/index"),
  require("./syntax/comparisons/index"),
  require("./syntax/logicals/index"),
  require("./syntax/conditionals/index"),
  require("./syntax/arrays/index"),
  require("./syntax/hashmaps/index"),
  require("./syntax/properties/index"),
  require("./syntax/methods/index"),
  require("./syntax/ranges/index"),
  require("./syntax/slices/index"),
  require("./syntax/sets/index"),
  require("./syntax/wrapped/index"),
  require("./syntax/formattedStrings/index"),
  require("./syntax/assignments/index"),
  require("./syntax/fatAssignments/index"),
  require("./syntax/await/index"),
  require("./syntax/exports/index"),
  require("./syntax/imports/index"),
  require("./syntax/in/index"),
  require("./syntax/structs/index"),
  require("./syntax/clio/index"),
  require("./syntax/boosters/index")
);

module.exports = rules;
