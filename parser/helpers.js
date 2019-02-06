const helpers = {
  isOneOf: function (token, list) {
    return list.includes(token.name);
  },
  isWrappedRepeat: function (start, end, seq, i, tokens, parser) {
    if (!helpers.isOneOf(tokens[i], [start])) {
      return -1;
    }
    i += 1;
    // grab until end;
    var match = helpers.isSeq(seq, i, tokens);
    while (match != -1) {
      i = match;
      match = helpers.isSeq(seq, i, tokens);
      if (i > tokens.length-1) {
        return -1;
      }
    }
    if (!helpers.isOneOf(tokens[i], [end])) {
      return -1;
    }
    return i+1;
  },
  isWrapped: function (start, expected, end, i, tokens, parser) {
    const start_i = i;
    if (!helpers.isOneOf(tokens[i], [start])) {
      return -1;
    }
    i += 1;
    // grab until end;
    while (!helpers.isOneOf(tokens[i], [end, start])) {
      i += 1;
      if (i > tokens.length-1) {
        return -1;
      }
    }
    if (helpers.isOneOf(tokens[i], [start])) {
      return -1;
    }
    // match it XD
    var grabbed_tokens = tokens.slice(start_i+1, i);
    grabbed_tokens.push({name: 'eof'})
    var match = parser('', grabbed_tokens, true);
    if (!match[0]) {
      return -1;
    }
    if (helpers.isOneOf(match[1][0], [expected])) {
      return [i+1, [match[1][0]]];
    }
    return -1;
  },
  isSeq: function (seq, i, tokens) {
    for (var rule in seq) {
      if (seq.hasOwnProperty(rule)) {
        rule = seq[rule];
        if (typeof rule.name != typeof []) {
          rule.name = [rule.name];
        }
        // these work only if count is 1, fix this
        if (rule.not_after) {
          var j = i-1;
          while ((j > 0) && (tokens[j].name == '_')) {
            j--;
          }
          if ((j > 0) && (rule.not_after.includes(tokens[j].name))) {
            return -1;
          }
        }
        if (rule.not_before) {
          var j = i+1;
          while ((j < tokens.length) && (tokens[j].name == '_')) {
            j++;
          }
          if ((j <= tokens.length) && (rule.not_before.includes(tokens[j].name))) {
            return -1;
          }
        }
        if (rule.should_be_after) {
          var j = i-1;
          while ((j > 0) && (tokens[j].name == '_')) {
            j--;
          }
          if ((j < 0) || (!rule.should_be_after.includes(tokens[j].name))) {
            return -1;
          }
        }
        if (rule.count >= 1) {
          var count = rule.count;
          while (count > 0) {
            var name_match = true;
            if (rule.raw && (rule.raw != tokens[i].raw)) {
              name_match = false;
            }
            if (name_match && helpers.isOneOf(tokens[i], rule.name)) {
              i += 1
              count -= 1;
            } else {
              if (rule.opt != true) {
                return -1;
              }
              if (rule.fail && helpers.isOneOf(tokens[i], rule.fail)) {
                return -1;
              }
              count -= 1;
            }
          }
        } else if (rule.count <= 0) {
          if (rule.sep != undefined) {
            var _i = helpers.grabAllUntil(tokens, i, rule.name, rule.sep, rule.enders);
            if (rule.count == -1) {
              if (_i - i == 1) {
                return -1;
              }
            }
            if (_i > i) {
              i = _i;
            } else if (_i == -1) {
              if (rule.opt != true) {
                return -1;
              }
            }
          } else {
            var res = helpers.isOneOf(tokens[i], rule.name);
            if (res) {
              while (helpers.isOneOf(tokens[i], rule.name)) {
                i += 1;
              }
            } else {
              if (rule.opt != true) {
                return -1;
              }
            }
          }
        }
      }
    }
    return i;
  },
  grabAllUntil: function (tokens, i, list, sep, enders) {
    var initial_i = i;
    var one_matched = false;
    while (true) {
      var curr_tok = tokens[i];
      if (helpers.isOneOf(curr_tok, sep)) {
        i += 1;
      } else if (helpers.isOneOf(curr_tok, list)) {
        one_matched = true;
        i += 1;
      } else if ((!enders.length) || (helpers.isOneOf(curr_tok, enders))) {
        while ((i > 0) && helpers.isOneOf(tokens[i-1], sep)) {
          i -= 1;
        }
        if (!one_matched) {
          return -1;
        }
        return i;
      } else {
        return -1;
      }
    }
  },
  wrapAs: function (name, start, end, tokens, res_tokens) {
    if (res_tokens !== undefined) {
      var result = {
        name: name,
        index: tokens[start].index,
        tokens: res_tokens
      };
    } else {
      var non_importants_raw = [
        '_', '_n', '^', 'map', 'set', 'indent', 'dedent', 'filt', 'not', 'proc', 'import', 'from',
        'lbra', 'rbra', 'colon', 'if', 'else', 'elif', 'fn', 'lpar', 'rpar', 'dot', 'comma', 'type', 'of', 'as',
        'lcbr', 'rcbr', 'async'
      ];
      var non_importants_token = ['starmap'];
      var res_tokens = tokens.slice(start, end).filter(function (obj) {
        if ((non_importants_raw.includes(obj.name)) && (obj.raw != undefined)) {
          return false;
        }
        if (non_importants_token.includes(obj.name)) {
          return false;
        }
        return true;
      })
      var result = {
        name: name,
        index: tokens[start].index,
        tokens: res_tokens
      };
    }
    var head = tokens.slice(0, start);
    head.push(result);
    var tail = tokens.slice(end);
    var body = head.concat(tail);
    return body;
  }
}

module.exports = helpers;
