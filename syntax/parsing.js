const helpers = require('../parser/helpers');

const matchers = {
  wrapped_decorator: function (i, tokens, parser) {
    return helpers.isWrapped('lpar', 'decorator', 'rpar', i, tokens, parser)
  },
  wrapped_math: function (i, tokens, parser) {
    return helpers.isWrapped('lpar', 'math', 'rpar', i, tokens, parser)
  },
  wrapped_flow: function (i, tokens, parser) {
    return helpers.isWrapped('lpar', 'flow', 'rpar', i, tokens, parser)
  },
  wrapped_quickfundef: function (i, tokens, parser) {
    return helpers.isWrapped('lpar', 'quickfundef', 'rpar', i, tokens, parser)
  },
  transform: function (i, tokens, parser) {
    return helpers.isWrapped('lpar', 'naked_transform', 'rpar', i, tokens, parser)
  },
  startransform: function (i, tokens, parser) {
    return helpers.isWrapped('lpar', 'naked_startransform', 'rpar', i, tokens, parser)
  },
  wrapped_and_or: function (i, tokens, parser) {
    return helpers.isWrapped('lpar', 'and_or_expr', 'rpar', i, tokens, parser)
  },
  wrapped_not: function (i, tokens, parser) {
    return helpers.isWrapped('lpar', 'notexpr', 'rpar', i, tokens, parser)
  },
  naked_startransform: function (i, tokens) {
    return helpers.isSeq([
      {name: 'sop', count: 1, raw: '*'},
      {name: '_', count: 1, opt: true},
      {name: 'naked_transform', count: 1},
    ], i, tokens)
  },
  of_something: function (i, tokens) {
    return helpers.isSeq([
      {name: 'of', count: 1},
      {name: '_', count: 0},
      {name: 'symbol', count: 1},
    ], i, tokens);
  },
  // TODO: all to es6
  slice: (i, tokens) =>
    helpers.isSeq([
      {name: ['symbol', 'list', 'range', 'property_access', 'slice', 'stepped_range'], count: 1},
      {name: ['list'], count: 0, enders: []},
    ], i, tokens),

  property_access: (i, tokens) =>
    helpers.isSeq([
      {name: ['symbol', 'slice'], count: 1},
      {name: ['dot'], count: 1},
      {name: ['symbol'], count: 1}
    ], i, tokens),

  /*
  property_access: (i, tokens) =>
    helpers.isSeq([
      {name: 'possesive', count: 1},
      {name: '_', count: 0},
      {name: ['possesive', 'symbol'], count: 0, sep: ['_'], enders: []},
    ], i, tokens),*/

  atnumber: function (i, tokens) {
    return helpers.isSeq([
      {name: 'atsign', count: 1},
      {name: 'number', count: 1},
    ], i, tokens)
  },
  from_st: function (i, tokens) {
    return helpers.isSeq([
      {name: 'from', count: 1},
      {name: '_', count: 0},
      {name: ['url', 'symbol', 'property_access', 'path'], count: 1},
    ], i, tokens)
  },
  import_st: function (i, tokens) {
    return helpers.isSeq([
      {name: 'import', count: 1},
      {name: '_', count: 0},
      {name: ['symbol', 'property_access'], count: 0, sep: ['_', '^', '_n'], enders: ['from_st']},
      {name: '_', count: 0, opt: true},
      {name: 'from_st', count: 1},
    ], i, tokens)
  },
  import_nk: function (i, tokens) {
    return helpers.isSeq([
      {name: 'import', count: 1},
      {name: '_', count: 0},
      {name: ['symbol', 'property_access', 'property_access'], count: 0, sep: ['_'], enders: ['_n']},
    ], i, tokens)
  },
  import_al: function (i, tokens) {
    return helpers.isSeq([
      {name: 'import', count: 1},
      {name: '_', count: 0},
      {name: 'sop', count: 1},
      {name: '_', count: 0},
      {name: 'from_st', count: 1, opt: true},
    ], i, tokens)
  },
  starmap: function (i, tokens, parser) {
    return helpers.isSeq([
      {name: 'map', count: 1},
      {name: '_', count: 0, opt: true},
      {name: 'sop', count: 1, raw: '*'},
    ], i, tokens)
  },
  range_start: function (i, tokens, parser) {
    return helpers.isSeq([
      {name: 'lbra', count: 1},
      {name: ['number', 'symbol', 'wrapped_math'], count: 1, opt: true},
      {name: 'colon', count: 1},
    ], i, tokens);
  },
  stepped_range: function (i, tokens, parser) {
    return helpers.isSeq([
      {name: 'range_start', count: 1},
      {name: ['number', 'symbol', 'wrapped_math'], count: 1, opt: true},
      {name: 'colon', count: 1},
      {name: ['number', 'symbol', 'wrapped_math'], count: 1},
      {name: 'rbra', count: 1},
    ], i, tokens);
  },
  range: function (i, tokens, parser) {
    return helpers.isSeq([
      {name: 'range_start', count: 1},
      {name: ['number', 'symbol', 'wrapped_math'], count: 1, opt: true},
      {name: 'rbra', count: 1},
    ], i, tokens);
  },
  dsop_math: function (i, tokens, parser) {
    return helpers.isSeq([
      {name: ['symbol', 'property_access', 'number', 'wrapped_math', 'math', 'wrapped_flow', 'range', 'stepped_range', 'list'], count: 1},
      {name: ['_', '^', '_n'], count: 0, opt: true},
      {name: 'dsop', count: 1},
      {name: ['_', '^', '_n'], count: 0, opt: true},
      {name: ['symbol', 'property_access', 'number', 'wrapped_math', 'math', 'wrapped_flow'], count: 1},
    ], i, tokens);
  },
  sop_math: function (i, tokens, parser) {
    return helpers.isSeq([
      {name: ['symbol', 'property_access', 'number', 'wrapped_math', 'math', 'wrapped_flow', 'range', 'stepped_range', 'list'], count: 1},
      {name: ['_', '^', '_n'], count: 0, opt: true},
      {name: 'sop', count: 1},
      {name: ['_', '^', '_n'], count: 0, opt: true},
      {name: ['symbol', 'property_access', 'number', 'wrapped_math', 'math', 'wrapped_flow'], count: 1},
    ], i, tokens);
  },
  op_math: function (i, tokens, parser) {
    return helpers.isSeq([
      {name: ['symbol', 'property_access', 'number', 'wrapped_math', 'math', 'wrapped_flow', 'range', 'stepped_range', 'list', 'string', 'word'], count: 1},
      {name: ['_', '^', '_n'], count: 0, opt: true},
      {name: 'op', count: 1},
      {name: ['_', '^', '_n'], count: 0, opt: true},
      {name: ['symbol', 'property_access', 'number', 'wrapped_math', 'math', 'wrapped_flow', 'string', 'word'], count: 1},
    ], i, tokens);
  },
  math: function (i, tokens, parser) {
    return helpers.isOneOf(tokens[i], ['dsop_math', 'sop_math', 'op_math']) ? i+1 : -1;
  },
  atnum_as: function (i, tokens) {
    return helpers.isSeq([
      {name: 'atnumber', count: 1},
      {name: '_', count: 1},
      {name: 'as', count: 1},
      {name: '_', count: 1},
      {name: 'symbol', count: 1},
    ], i, tokens)
  },
  naked_transform: function (i, tokens) {
    return helpers.isSeq([
      {name: 'transform', count: 1},
      {name: '_', count: 1},
      {name: ['symbol', 'atnum_as'], count: 1},
      {name: '_', count: 1, opt: true},
      {name: 'colon', count: 1},
      {name: '_', count: 1, opt: true},
      {name: ['math', 'wrapped_math', 'symbol', 'property_access', 'number', 'bool', 'cmpexpr', 'and_or_expr', 'wrapped_and_or', 'notexpr', 'wrapped_not'], count: 1, not_before: ['comparison']},
    ], i, tokens)
  },
  /*stepped_range: function (i, tokens) {
    return helpers.isSeq([
      {name: ['symbol', 'property_access', 'number'], count: 1},
      {name: 'comma', count: 1},
      {name: ['symbol', 'property_access', 'number'], count: 1},
      {name: 'dot', count: 2},
      {name: ['symbol', 'property_access', 'number'], count: 1}
    ], i, tokens);
  },*/
  /*double_dot: function (i, tokens) {
    return helpers.isSeq([
      {name: 'dot', count: 2},
    ], i, tokens);
  },
  dotted_range: function (i, tokens) {
    return helpers.isSeq([
      {name: ['symbol', 'property_access', 'number', 'wrapped_math'], count: 1, opt: true},
      {name: '_', count: 0, opt: true},
      {name: 'double_dot', count: 1},
      {name: '_', count: 0, opt: true},
      {name: ['symbol', 'property_access', 'number', 'wrapped_math'], count: 1, opt: true},
    ], i, tokens);
  },
  range: function (i, tokens) {
    return helpers.isSeq([
      {name: 'lbra', count: 1},
      {name: '_', count: 0, opt: true},
      {name: ['symbol', 'property_access', 'number', 'wrapped_math'], count: 1, opt: true},
      {name: '_', count: 0, opt: true},
      {name: 'dotted_range', count: 1},
      {name: '_', count: 0, opt: true},
      {name: 'rbra', count: 1},
    ], i, tokens);
  },*/
  event: function(i, tokens) {
    return helpers.isSeq([
      {name: ['symbol', 'slice', 'property_access'], count: 1},
      {name: 'colon', count: 1},
      {name: ['symbol', 'string', 'word', 'property_access', 'slice'], count: 1},
    ], i, tokens)
  },
  hash_map: function (i, tokens) {
    return helpers.isWrappedRepeat('lcbr', 'rcbr', [
      {name: ['_', '_n', '^'], count: 0, opt: true},
      {name: ['symbol', 'property_access', 'number', 'string', 'word', 'bool'], count: 1},
      {name: ['_'], count: 0},
      {name: ['symbol', 'property_access', 'number', 'list', 'empty_list', 'string', 'word', 'bool', 'wrapped_math', 'range', 'stepped_range'], count: 1},
      {name: ['_', '_n', '^'], count: 0, opt: true},
    ], i, tokens)
  },
  empty_hash_map: function (i, tokens) {
    return helpers.isSeq([
      {name: 'lcbr', count: 1},
      {name: 'rcbr', count: 1},
    ], i, tokens)
  },
  list: function (i, tokens) {
    return helpers.isSeq([
      {name: 'lbra', count: 1},
      {name: ['symbol', 'property_access', 'number', 'list', 'empty_list', 'string', 'word', 'bool', 'wrapped_math', 'range', 'stepped_range'], count: 0, sep: ['_', '_n', '^', 'indent', 'dedent'], enders: ['rbra', 'lbra']},
      {name: 'rbra', count: 1},
    ], i, tokens)
  },
  empty_list: function (i, tokens) {
    return helpers.isSeq([
      {name: 'lbra', count: 1},
      {name: 'rbra', count: 1},
    ], i, tokens)
  },
  decorated_inflowfundef: function (i, tokens) {
    return helpers.isSeq([
      {name: ['_', '^', '_n'], count: 1},
      {name: 'map', count: 1},
      {name: '_', count: 1},
      {name: 'wrapped_decorator', count: 0, sep: ['_'], enders: ['fn']},
      {name: '_', count: 1},
      {name: 'fn', count: 1},
      {name: '_', count: 1},
      {name: 'symbol', count: 1},
      {name: 'colon', count: 1},
      {name: '_n', count: 0},
      {name: 'block', count: 1}
    ], i, tokens)
  },
  inflowfundef: function (i, tokens) {
    return helpers.isSeq([
      {name: ['_', '^', '_n'], count: 1},
      {name: 'map', count: 1},
      {name: '_', count: 1},
      {name: 'fn', count: 1},
      {name: '_', count: 1},
      {name: 'symbol', count: 1},
      {name: 'colon', count: 1},
      {name: '_n', count: 0},
      {name: 'block', count: 1}
    ], i, tokens)
  },
  decorated_starinflowfundef: function (i, tokens) {
    return helpers.isSeq([
      {name: ['_', '^', '_n'], count: 1},
      {name: 'starmap', count: 1},
      {name: '_', count: 1},
      {name: 'wrapped_decorator', count: 0, sep: ['_'], enders: ['fn']},
      {name: '_', count: 1},
      {name: 'fn', count: 1},
      {name: '_', count: 1},
      {name: 'symbol', count: 1},
      {name: '_', count: 1, opt: true},
      {name: 'colon', count: 1},
      {name: '_n', count: 0},
      {name: 'block', count: 1}
    ], i, tokens)
  },
  starinflowfundef: function (i, tokens) {
    return helpers.isSeq([
      {name: ['_', '^', '_n'], count: 1},
      {name: 'starmap', count: 1},
      {name: '_', count: 1, opt: true},
      {name: 'fn', count: 1},
      {name: '_', count: 1},
      {name: 'symbol', count: 1},
      {name: '_', count: 1, opt: true},
      {name: 'colon', count: 1},
      {name: '_n', count: 0},
      {name: 'block', count: 1}
    ], i, tokens)
  },
  decorator: function (i, tokens) {
    return helpers.isSeq([
      {name: 'atsign', count: 1},
      {name: ['symbol', 'property_access'], count: 1},
      {name: '_', count: 1, opt: true},
      {name: ['symbol', 'property_access', 'number', 'list'], sep: ['_'], count: 0, enders: ['_n'], opt: true},
    ], i, tokens)
  },
  fundef: function (i, tokens) {
    return helpers.isSeq([
      {name: 'fn', count: 1},
      {name: '_', count: 1},
      {name: 'symbol', count: 1},
      {name: '_', count: 1},
      {name: 'symbol', sep: ['_'], count: 0, enders: ['colon']},
      {name: 'colon', count: 1},
      {name: '_n', count: 0},
      {name: 'block', count: 1}
    ], i, tokens)
  },
  fundefif: function (i, tokens) {
    return helpers.isSeq([
      {name: 'fn', count: 1},
      {name: '_', count: 1},
      {name: 'symbol', count: 1},
      {name: '_', count: 1},
      {name: 'symbol', sep: ['_'], count: 0, enders: ['if']},
      {name: '_', count: 0},
      {name: 'if', count: 1},
      {name: '_', count: 0},
      {name: ['if_fun_call', 'symbol'], count: 1},
      {name: '_', count: 0, opt: true},
      {name: 'colon', count: 1},
      {name: '_n', count: 0},
      {name: 'block', count: 1}
    ], i, tokens)
  },
  fundefof: function (i, tokens) {
    return helpers.isSeq([
      {name: 'fn', count: 1},
      {name: '_', count: 1},
      {name: 'symbol', count: 1},
      {name: '_', count: 0},
      {name: 'symbol', sep: ['_'], count: 0, enders: ['of_something'], opt: true},
      {name: '_', count: 0, opt: true},
      {name: 'of_something', count: 1},
      {name: '_', count: 0, opt: true},
      {name: 'colon', count: 1},
      {name: '_n', count: 0},
      {name: 'block', count: 1}
    ], i, tokens)
  },
  fundefifof: function (i, tokens) {
    return helpers.isSeq([
      {name: 'fn', count: 1},
      {name: '_', count: 1},
      {name: 'symbol', count: 1},
      {name: '_', count: 0},
      {name: 'symbol', sep: ['_'], count: 0, enders: ['if'], opt: true},
      {name: '_', count: 0},
      {name: 'if', count: 1},
      {name: '_', count: 1},
      {name: ['if_fun_call', 'symbol'], count: 1},
      {name: '_', count: 0, opt: true},
      {name: 'of_something', count: 1},
      {name: '_', count: 0, opt: true},
      {name: 'colon', count: 1},
      {name: '_n', count: 0},
      {name: 'block', count: 1}
    ], i, tokens)
  },
  typedef: function (i, tokens) {
    return helpers.isSeq([
      {name: 'type', count: 1},
      {name: '_', count: 1},
      {name: 'symbol', count: 1},
      {name: '_', count: 1},
      {name: 'symbol', sep: ['_'], count: 0, enders: ['colon']},
      {name: 'colon', count: 1},
      {name: '_n', count: 0},
      {name: 'block', count: 1}
    ], i, tokens)
  },
  decorated_fundef: function (i, tokens) {
    return helpers.isSeq([
      {name: 'decorator', count: 0, sep: ['_', '^', '_n'], enders: ['fundef']},
      {name: ['_', '^', '_n'], count: 0},
      {name: 'fundef', count: 1},
    ], i, tokens)
  },
  decorated_fundefif: function (i, tokens) {
    return helpers.isSeq([
      {name: 'decorator', count: 0, sep: ['_', '^', '_n'], enders: ['fundefif']},
      {name: ['_', '^', '_n'], count: 0},
      {name: 'fundefif', count: 1},
    ], i, tokens)
  },
  decorated_fundefof: function (i, tokens) {
    return helpers.isSeq([
      {name: 'decorator', count: 0, sep: ['_', '^', '_n'], enders: ['fundefof']},
      {name: ['_', '^', '_n'], count: 0},
      {name: 'fundefof', count: 1},
    ], i, tokens)
  },
  decorated_fundefifof: function (i, tokens) {
    return helpers.isSeq([
      {name: 'decorator', count: 0, sep: ['_', '^', '_n'], enders: ['fundefifof']},
      {name: ['_', '^', '_n'], count: 0},
      {name: 'fundefifof', count: 1},
    ], i, tokens)
  },
  /*procdef: function (i, tokens) {
    return helpers.isSeq([
      {name: 'proc', count: 1},
      {name: '_', count: 1},
      {name: 'symbol', 'property_access', count: 1},
      {name: '_', count: 1},
      {name: 'symbol', 'property_access', sep: ['_'], count: 0, enders: ['colon']},
      {name: 'colon', count: 1},
      {name: '_n', count: 0},
      {name: 'block', count: 1}
    ], i, tokens)
  },
  inflowprocdef: function (i, tokens) {
    return helpers.isSeq([
      {name: ['_', '^', '_n'], count: 1},
      {name: 'map', count: 1},
      {name: '_', count: 1},
      {name: 'proc', count: 1},
      {name: '_', count: 1},
      {name: 'symbol', 'property_access', count: 1},
      {name: 'colon', count: 1},
      {name: '_n', count: 0},
      {name: 'block', count: 1}
    ], i, tokens)
  },
  starinflowprocdef: function (i, tokens) {
    return helpers.isSeq([
      {name: ['_', '^', '_n'], count: 1},
      {name: 'starmap', count: 1},
      {name: '_', count: 1, opt: true},
      {name: 'proc', count: 1},
      {name: '_', count: 1},
      {name: 'symbol', 'property_access', count: 1},
      {name: '_', count: 1, opt: true},
      {name: 'colon', count: 1},
      {name: '_n', count: 0},
      {name: 'block', count: 1}
    ], i, tokens)
  },*/
  quickfundef: function (i, tokens) {
    return helpers.isSeq([
      //{name: ['_', '_n', '^'], count: 0},
      //{name: 'map', count: 1},
      //{name: '_', count: 1},
      {name: 'symbol', count: 1, not_after: ['transform', 'as']},
      {name: '_', count: 1, opt: true},
      {name: 'colon', count: 1},
      {name: '_', count: 1, opt: true},
      {name: ['math', 'wrapped_math', 'cmpexpr', 'and_or_expr', 'wrapped_and_or', 'notexpr', 'wrapped_not', 'list', 'bool', 'string', 'word'], count: 1}
    ], i, tokens)
  },
  /*starquickfundef: function (i, tokens) {
    return helpers.isSeq([
      {name: ['_', '_n', '^'], count: 0},
      {name: 'starmap', count: 1},
      {name: '_', count: 1},
      {name: 'symbol', 'property_access', count: 1},
      {name: '_', count: 1, opt: true},
      {name: 'colon', count: 1},
      {name: '_', count: 1, opt: true},
      {name: ['math', 'wrapped_math'], count: 1}
    ], i, tokens)
  },*/
  if_fun_call: function (i, tokens) {
    return helpers.isSeq([
      {name: ['symbol', 'property_access'], count: 1, should_be_after: ['if', 'elif']},
      {name: '_', count: 0},
      {
        name: ['symbol', 'property_access', 'atsign', 'atnumber', 'number', 'list', 'bool', 'wrapped_flow', 'wrapped_math', 'string', 'word', 'empty_list', 'transform', 'startransform', 'wrapped_quickfundef'],
        count: 0, sep: ['_'],
        enders: ['colon', 'comparison', 'map', 'set'],
      },
    ], i, tokens)
  },
  setter: function (i, tokens) {
    return helpers.isSeq([
      {name: ['_', '_n', '^'], count: 0},
      {name: 'set', count: 1},
      {name: '_', count: 1},
      {name: ['symbol', 'property_access', 'slice'], count: 1},
    ], i, tokens)
  },
  starmapper: function (i, tokens) {
    return helpers.isSeq([
      {name: ['_', '_n', '^'], count: 0},
      {name: 'starmap', count: 1},
      {name: '_', count: 1},
      {name: ['symbol', 'property_access', 'quickfundef'], count: 1},
      {name: '_', count: 1},
      {
        name: ['symbol', 'property_access', 'atsign', 'atnumber', 'number', 'list', 'bool', 'wrapped_flow', 'wrapped_math', 'string', 'word', 'empty_list', 'transform', 'startransform', 'wrapped_quickfundef'], count: 0, sep: ['_'],
        enders: ['colon', '_n', 'map', 'set', 'mapper', 'starmapper', 'naked_mapper', 'naked_star_mapper', 'setter', 'dedent', 'rpar', 'starmap']},
    ], i, tokens)
  },
  mapper: function (i, tokens) {
    return helpers.isSeq([
      {name: ['_', '_n', '^'], count: 0},
      {name: 'map', count: 1},
      {name: '_', count: 1},
      {name: ['symbol', 'property_access', 'quickfundef'], count: 1},
      {name: '_', count: 1},
      {
        name: ['symbol', 'property_access', 'atsign', 'atnumber', 'number', 'list', 'bool', 'wrapped_flow', 'wrapped_math', 'string', 'word', 'empty_list', 'transform', 'startransform', 'wrapped_quickfundef'], count: 0, sep: ['_'],
        enders: ['colon', '_n', 'map', 'set', 'mapper', 'starmapper', 'naked_mapper', 'naked_star_mapper', 'setter', 'dedent', 'rpar', 'comparison']},
    ], i, tokens)
  },
  condmapper: function (i, tokens) {
    return helpers.isSeq([
      {name: ['_', '_n', '^'], count: 0},
      {name: 'map', count: 1},
      {name: ['_', '_n', '^'], count: 0},
      {name: 'conditional', count: 1},
    ], i, tokens)
  },
  starcondmapper: function (i, tokens) {
    return helpers.isSeq([
      {name: ['_', '_n', '^'], count: 0},
      {name: 'starmap', count: 1},
      {name: ['_', '_n', '^'], count: 0},
      {name: 'conditional', count: 1},
    ], i, tokens)
  },
  return_mapper: function (i, tokens) {
    return helpers.isSeq([
      {name: ['_', '_n', '^'], count: 0},
      {name: 'map', count: 1},
      {name: '_', count: 1},
      {name: 'return', count: 1},
    ], i, tokens)
  },
  naked_star_mapper: function (i, tokens) {
    return helpers.isSeq([
      {name: ['_', '_n', '^'], count: 0},
      {name: 'starmap', count: 1},
      {name: '_', count: 1},
      {name: ['symbol', 'property_access', 'anonfundef', 'quickfundef'], count: 1},
      {fail: ['symbol', 'property_access', 'transform', 'startransform'], 'skip': ['_']}
    ], i, tokens)
  },
  naked_mapper: function (i, tokens) {
    return helpers.isSeq([
      {name: ['_', '_n', '^'], count: 0},
      {name: 'map', count: 1},
      {name: '_', count: 1},
      {name: ['symbol', 'property_access', 'anonfundef', 'quickfundef'], count: 1},
      {fail: ['symbol', 'property_access', 'transform', 'startransform'], 'skip': ['_']}
    ], i, tokens)
  },
  block: function (i, tokens) {
    return helpers.isSeq([
      {name: 'indent', count: 1},
      {name: ['_', '^'], count: 0},
      {name: ['block', 'conditional', 'flow', 'fundef', 'anonfundef', 'list', 'string', 'word', 'number', 'decorated_fundef',
              'symbol', 'property_access', 'bool', 'math', 'procdef', 'range', 'typedef', 'fundefof', 'notexpr',
              'slice'], count: 0, sep: ['_', '_n', '^'], enders: ['dedent']},
      {name: ['_n', '^'], count: 0, opt: true},
      {name: 'dedent', count: 1},
    ], i, tokens);
  },
  if_statement: function (i, tokens) {
    return helpers.isSeq([
      {name: 'if', count: 1},
      {name: '_', count: 0, opt: true},
      {name: ['halfcmp', 'flow', 'symbol', 'property_access', 'cmpexpr', 'and_or_expr', 'wrapped_and_or', 'notexpr', 'wrapped_not', 'if_fun_call', 'math'], count: 1},
      {name: '_', count: 0, opt: true},
      {name: 'colon', count: 1},
      {name: ['_', '_n', '^'], count: 0}, // if it's _n then it's block for sure!
      {name: ['block', 'string', 'word', 'number', 'list', 'symbol', 'property_access', 'self_property_access', 'math', 'slice', 'notexpr'], count: 1}
    ], i, tokens)
  },
  elif_statement: function (i, tokens) {
    return helpers.isSeq([
      {name: 'elif', count: 1},
      {name: '_', count: 0},
      {name: ['halfcmp', 'flow', 'symbol', 'property_access', 'cmpexpr', 'and_or_expr', 'wrapped_and_or', 'notexpr', 'wrapped_not', 'if_fun_call', 'math'], count: 1},
      {name: '_', count: 0, opt: true},
      {name: 'colon', count: 1},
      {name: ['_', '_n', '^'], count: 0}, // if it's _n then it's block for sure!
      {name: ['block', 'string', 'word', 'number', 'list', 'symbol', 'property_access', 'self_property_access', 'math', 'slice', 'notexpr'], count: 1}
    ], i, tokens)
  },
  else_statement: function (i, tokens) {
    return helpers.isSeq([
      {name: 'else', count: 1},
      {name: '_', count: 0, opt: true},
      {name: 'colon', count: 1},
      {name: ['_', '_n', '^'], count: 0}, // if it's _n then it's block for sure!
      {name: ['block', 'string', 'word', 'number', 'list', 'symbol', 'property_access', 'self_property_access', 'math', 'slice', 'notexpr'], count: 1}
    ], i, tokens)
  },
  notexpr: function (i, tokens) {
    return helpers.isSeq([
      {name: ['not'], count: 1},
      {name: ['_'], count: 0},
      {name: ['cmpexpr', 'string', 'symbol', 'property_access', 'list', 'word', 'wrapped_flow', 'wrapped_math', 'and_or_expr', 'wrapped_and_or', 'notexpr', 'wrapped_not', 'bool', 'slice', 'math'], count: 1},
    ], i, tokens);
  },
  and_or_expr: function (i, tokens) {
    return helpers.isSeq([
      {name: ['cmpexpr', 'string', 'symbol', 'property_access', 'list', 'word', 'wrapped_flow', 'wrapped_math', 'and_or_expr', 'wrapped_and_or', 'notexpr', 'wrapped_not', 'bool', 'slice', 'math'], count: 1},
      {name: ['_'], count: 0},
      {name: ['and', 'or'], count: 1},
      {name: ['_'], count: 0},
      {name: ['cmpexpr', 'string', 'symbol', 'property_access', 'list', 'word', 'wrapped_flow', 'wrapped_math', 'and_or_expr', 'wrapped_and_or', 'notexpr', 'wrapped_not', 'bool', 'slice', 'math'], count: 1},
    ], i, tokens);
  },
  async_flow: function (i, tokens) {
    return helpers.isSeq([
      {name: 'async', count: 1},
      {name: '_', count: 0},
      {name: 'flow', count: 1},
    ], i, tokens)
  },
  flow: function (i, tokens) {
    return helpers.isSeq([
      {name: ['symbol', 'property_access', 'list', 'empty_list', 'slice', 'hash_map', 'event',
              'range', 'stepped_range', 'string', 'word', 'number', 'bool', 'wrapped_flow',
              'math', 'if_fun_call', 'wrapped_math', 'atsign', 'slice', 'notexpr', 'and_or_expr'], count: 0, sep: ['_'],
              enders: ['setter', 'mapper', 'starmapper', 'naked_mapper', 'naked_star_mapper', '_n', '^',
                'filter', 'starinflowfundef', 'decorated_starinflowfundef', 'inflowfundef', 'decorated_inflowfundef',
                'starinflowprocdef', 'inflowprocdef', 'condmapper', 'starcondmapper', 'quickfundef', 'starquickfundef', 'return_mapper',
              ],
              not_after: ['not']
      },
      {
        name: ['setter', 'mapper', 'starmapper', 'naked_mapper', 'naked_star_mapper',
          'filter', 'starinflowfundef', 'decorated_starinflowfundef', 'inflowfundef', 'decorated_inflowfundef', 'starinflowprocdef', 'inflowprocdef', 'condmapper', 'starcondmapper', 'quickfundef', 'starquickfundef', 'return_mapper'],
        count: 0, sep: ['_', '_n', '^'],
        enders: [
          'colon', '_n', '^', 'symbol', 'property_access', 'list', 'number', 'bool', 'empty_list', 'range', 'stepped_range', 'string', 'math', 'wrapped_math', 'notexpr', 'slice', 'hash_map',
          'word', 'dedent', 'eof', 'flow', 'conditional', 'rpar', 'fundef', 'comparison', 'procdef', 'decorator', 'import_st', 'import_nk', 'import_al', 'typedef', 'fundefof', 'fundefif', 'fundefifof']
      },
    ], i, tokens)
  },
  cmpexpr: function (i, tokens) {
    return helpers.isSeq([
      {name: ['if_fun_call', 'number', 'symbol', 'property_access', 'string', 'word', 'flow', 'wrapped_flow', 'wrapped_math'], count: 1},
      {name: ['_', '^'], count: 0},
      {name: ['comparison'], count: 1},
      {name: ['_', '^'], count: 0},
      {name: ['number', 'symbol', 'property_access', 'string', 'word', 'flow', 'wrapped_flow', 'wrapped_math', 'bool'], count: 1},
    ], i, tokens);
  },
  halfcmp: function (i, tokens) {
    return helpers.isSeq([
      {name: ['comparison'], count: 1},
      {name: ['_', '^'], count: 0},
      {name: ['number', 'symbol', 'property_access', 'string', 'word', 'wrapped_flow', 'wrapped_math', 'flow', 'bool'], count: 1},
    ], i, tokens);
  },
  conditional: function (i, tokens) {
    return helpers.isSeq([
      {name: 'if_statement', count: 1},
      {name: ['_', '_n', '^'], count: 0, opt: true},
      {name: 'elif_statement', count: 0, opt: true, fail: ['elif'], sep: ['_n', '_', '^'], enders: []},
      {name: ['_', '_n', '^'], count: 0, opt: true},
      {name: 'else_statement', count: 1, opt: true, fail: ['else']},
    ], i, tokens)
  },
  eof: function (i, tokens) {
    return helpers.isSeq([
      {name: ['_', '_n', '^'], count: 0},
      {name: ['eof'], count: 1}
    ], i, tokens);
  }
}

const illegals = ['map', 'set', 'return', 'fn', 'if', 'elif', 'else', 'dot', 'star', 'lbra', 'rbra', 'comma', 'colon', 'starmap', 'lcbr', 'rcbr'];

exports.illegals = illegals;
exports.matchers = matchers;
