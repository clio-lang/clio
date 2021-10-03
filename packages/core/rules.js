import _await from "./syntax/await/index.js";
import _exports from "./syntax/exports/index.js";
import _in from "./syntax/in/index.js";
import arrays from "./syntax/arrays/index.js";
import assignments from "./syntax/assignments/index.js";
import blocks from "./syntax/blocks/index.js";
import boosters from "./syntax/boosters/index.js";
import calls from "./syntax/calls/index.js";
import clio from "./syntax/clio/index.js";
import comparisons from "./syntax/comparisons/index.js";
import conditionals from "./syntax/conditionals/index.js";
import decorators from "./syntax/decorators/index.js";
import fatAssignments from "./syntax/fatAssignments/index.js";
import formattedStrings from "./syntax/formattedStrings/index.js";
import functions from "./syntax/functions/index.js";
import groups from "./syntax/groups/index.js";
import hashmaps from "./syntax/hashmaps/index.js";
import imports from "./syntax/imports/index.js";
import list from "./syntax/list/index.js";
import logicals from "./syntax/logicals/index.js";
import math from "./syntax/math/index.js";
import { merge } from "bean-parser";
import methods from "./syntax/methods/index.js";
import parallelFns from "./syntax/parallelFns/index.js";
import properties from "./syntax/properties/index.js";
import ranges from "./syntax/ranges/index.js";
import sets from "./syntax/sets/index.js";
import slices from "./syntax/slices/index.js";
import types from "./syntax/types/index.js";
import wrapped from "./syntax/wrapped/index.js";

const rules = merge(
  _await,
  _exports,
  _in,
  arrays,
  assignments,
  blocks,
  boosters,
  calls,
  clio,
  comparisons,
  conditionals,
  decorators,
  fatAssignments,
  formattedStrings,
  functions,
  groups,
  hashmaps,
  imports,
  list,
  logicals,
  math,
  methods,
  parallelFns,
  properties,
  ranges,
  sets,
  slices,
  types,
  wrapped
);

export default rules;
