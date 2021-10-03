import { bean, list, map, merge } from "bean-parser";
import { lexerTokens, wrap } from "../common.js";

import _await from "../await/index.js";
import _exports from "../exports/index.js";
import _in from "../in/index.js";
import arrays from "../arrays/index.js";
import assignments from "../assignments/index.js";
import blocks from "../blocks/index.js";
import boosters from "../boosters/index.js";
import calls from "../calls/index.js";
import clio from "../clio/index.js";
import comparisons from "../comparisons/index.js";
import conditionals from "../conditionals/index.js";
import fatAssignments from "../fatAssignments/index.js";
import formattedStrings from "../formattedStrings/index.js";
import functions from "../functions/index.js";
import hashmaps from "../hashmaps/index.js";
import imports from "../imports/index.js";
import logicals from "../logicals/index.js";
import math from "../math/index.js";
import methods from "../methods/index.js";
import parallelFns from "../parallelFns/index.js";
import properties from "../properties/index.js";
import ranges from "../ranges/index.js";
import sets from "../sets/index.js";
import slices from "../slices/index.js";
import wrapped from "../wrapped/index.js";

const rules = merge(
  calls,
  blocks,
  parallelFns,
  functions,
  math,
  comparisons,
  logicals,
  conditionals,
  arrays,
  hashmaps,
  properties,
  methods,
  ranges,
  slices,
  sets,
  wrapped,
  formattedStrings,
  assignments,
  fatAssignments,
  _await,
  _exports,
  imports,
  _in,
  clio,
  boosters
);

export default {
  // Group
  groupStart: {
    ...map(
      lexerTokens,
      wrap((_, rhs) => {
        return { type: "groupOpen", content: list([rhs]), open: 1 };
      }, 9999)
    ),
  },
  groupOpen: {
    ...map(
      lexerTokens,
      wrap((lhs, rhs) => {
        lhs.content.push(rhs);
        return lhs;
      }, 9999)
    ),
    groupStart: wrap((lhs) => {
      lhs.open++;
      return lhs;
    }, 9999),
    groupEnd: wrap((lhs, context) => {
      lhs.open--;
      // FIXME: We need error checking here
      return lhs.open
        ? lhs
        : bean(lhs.content, rules, true, context).first.item;
    }, 9999),
  },
};
