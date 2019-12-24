const patterns = {
  string: /^'([^\\]|\\.)*?'|^"([^\\]|\\.)*?"/,
  word: /^#[^\[\] \r\n:]+/i,
  number: /^(0|-?[1-9][0-9']*)(n|(\.[0-9']+))?/,

  fn: /^fn(?![a-zA-Z_-])/,
  if: /^if(?![a-zA-Z_-])/,
  else: /^else(?![a-zA-Z_-])/,
  elif: /^elif(?![a-zA-Z_-])/,
  boolean: /^(true|false)(?![a-zA-Z_-])/,
  and: /^and(?![a-zA-Z_-])/,
  or: /^or(?![a-zA-Z_-])/,
  not: /^not(?![a-zA-Z_-])/,
  of: /^of(?![a-zA-Z_-])/,
  as: /^as(?![a-zA-Z_-])/,

  exclamation: /^!/,
  unpack: /^~/,

  import: /^import(?![a-zA-Z_-])/,
  from: /^from(?![a-zA-Z_-])/,

  comment: /^ *--[^\r\n]+/,

  symbol: /^[a-z$_][a-z_0-9$-]*/i,

  map: /^-> *\*/,
  pipe: /^->/,
  set: /^=>/,
  eq: /^=/,

  cmp: /^(!=|>=|<=|>|<|==)/,

  math_priority_one: /^[\^]/,
  math_priority_two: /^[*/]/,
  math_priority_three: /^[-+%]/,

  //range: /^\[([0-9]+,)?([0-9]+)?..([0-9]+)?\]/,

  dot: /^[.]/,
  at: /^[@]/,

  lbra: /^[\[]/,
  rbra: /^[\]]/,
  lpar: /^[\(]/,
  rpar: /^[\)]/,
  lcbr: /^[\{]/,
  rcbr: /^[\}]/,

  emptyline: /^(\r?\n[ \t\f]*)+(?=\r?\n)/,
  comma: /^,/,
  colon: /^:/,
  newline: /^\r?\n/,
  space: /^ +/
};

module.exports = patterns;
