const { bean } = require("bean-parser");
const lex = require("./lexer");
const types = require("./types");
const rules = require("./rules");
const { parsingError } = require("./errors");

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
