const { bean, merge } = require("bean-parser");
const lex = require("./lexer");
const types = require("./types");

const rules = merge(
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
  require("./syntax/clio/index"),
  require("./syntax/boosters/index")
);

/* istanbul ignore next */
const skips = ["blockOpen", "ifTail"];

/* istanbul ignore next */
const parsingError = (source, file, tokens) => {
  let first = tokens.first;
  let next = tokens.first.next;
  while (true) {
    const isValid = rules[first.item.type][next.item.type];
    if (isValid || skips.includes(next.item.type)) {
      first = next;
      next = first.next;
    } else {
      break;
    }
  }
  first = first.item;
  next = next.item;
  const expecting = Object.keys(rules[first.type] || {}).join(", ");
  const start = Math.max(0, next.line - 3);
  const location = next.meta?.location || next;
  const { line, column } = location;
  const message = [
    `Parsing error at ${file}[${line}:${column}]\n`,
    source.split("\n").slice(start, line).join("\n"),
    " ".repeat(column) + "^",
    `\nExpecting one of ${expecting} but encountered ${next?.type}`,
  ].join("\n");
  return new Error(message);
};

const parse = (tokens) => bean(tokens, rules);
const compile = (source, file, debug = false) => {
  const tokens = lex(source, file);
  /* istanbul ignore next */
  if (debug) console.dir(tokens.current, { depth: null });
  const result = parse(tokens);
  /* istanbul ignore next */
  if (debug) console.dir(result, { depth: null });
  /* istanbul ignore next */
  if (result.first.item.type == "clio") {
    const { code, map } = types
      .get(result.current.item)
      .toStringWithSourceMap();
    map.setSourceContent(file, source);
    return { code, map: map.toString() };
    /* istanbul ignore next */
  } else {
    /* istanbul ignore next */
    throw parsingError(source, file, result);
  }
};

module.exports.compile = compile;
module.exports.tokenize = lex;
