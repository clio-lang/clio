const { bean } = require("bean-parser");
const lex = require("./lexer");
const types = require("./types");
const rules = require("./rules");
const { parsingError, importError } = require("./errors");

const parse = (tokens, source, file) => {
  try {
    const result = bean(tokens, rules);
    return result;
  } catch (error) {
    if (error instanceof types.ImportError) {
      throw importError(source, file, error);
    }
    throw error;
  }
};

const compile = (source, file, { sourceDir, root, debug = false }) => {
  const tokens = lex(source, { file, sourceDir, root });
  /* istanbul ignore next */
  if (debug) console.dir(tokens.current, { depth: null });
  const result = parse(tokens, source, file);
  /* istanbul ignore next */
  if (debug) console.dir(result, { depth: null });
  /* istanbul ignore next */
  if (result.first.item.type == "clio") {
    const { code, map } = types
      .get(result.current.item)
      .toStringWithSourceMap();
    map.setSourceContent(file, source);
    return {
      code: code + `//# sourceMappingURL=${file}.js.map`,
      map: map.toString(),
    };
    /* istanbul ignore next */
  } else {
    /* istanbul ignore next */
    throw parsingError(source, file, result);
  }
};

module.exports.parse = parse;
module.exports.compile = compile;
module.exports.tokenize = lex;
