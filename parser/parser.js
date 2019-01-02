const throw_error = require('../common').throw_error;
const helpers = require('./helpers');
const {matchers, illegals} = require('../syntax/parsing');

function parser(contents, tokens, silent) {
  var ast = [];
  var match, matched;
  var res_tokens;
  var all_matchers = Object.keys(matchers);
  var i = 0;
  var j = 0;
  while (true) {
    matched = false;
    var matcher = all_matchers[j];
    i = 0;
    while (true) {
      res_tokens = undefined;
      match = matchers[matcher](i, tokens, parser);
      if (match.constructor === Array) {
        res_tokens = match[1];
        match = match[0];
      }
      if (match > i) {
        tokens = helpers.wrapAs(matcher, i, match, tokens, res_tokens);
        matched = true;
        i = 0; j = -1;
        break;
      }
      if (i == tokens.length - 1) {
        break;
      }
      i++;
    }
    if (j == all_matchers.length - 1) {
      if (!matched) {
        break;
      }
    }
    j++;
  }
  var result = true;
  for (var i = 0; i < tokens.length; i++) {
    if (illegals.includes(tokens[i].name)) { // TODO: add a distance calculator to detect typos (eg. eilf instead of elif)
      if (!silent) {
        throw_error(contents, `Unexpected token '${tokens[i].name}'`, tokens[i].index);
      }
      result = false;
      break;
    }
  }
  if (result) {
    tokens = tokens.filter(function (token) {
      return !['_', '_n', '^'].includes(token.name);
    })
  }
  return [result, tokens];
}

module.exports = parser;
