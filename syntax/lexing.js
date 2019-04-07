const patterns = {
  string: /^'([^\\]|\\.)*?'|^"([^\\]|\\.)*?"/,
  word: /^#[^\[\] \r\n:]+/i,
  number: /^(0|-?[1-9][0-9']*)(n|(\.[0-9']+))?/,

  fn: /^fn(?![a-zA-Z_-])/,
  return: /^return(?![a-zA-Z_-])/,
  async: /^async(?![a-zA-Z_-])/,
  if: /^if(?![a-zA-Z_-])/,
  elif: /^elif(?![a-zA-Z_-])/,
  else: /^else(?![a-zA-Z_-])/,
  bool: /^(true|false)(?![a-zA-Z_-])/,
  transform: /^transform(?![a-zA-Z_-])/,
  and: /^and(?![a-zA-Z_-])/,
  or: /^or(?![a-zA-Z_-])/,
  not: /^not(?![a-zA-Z_-])/,
  of: /^of(?![a-zA-Z_-])/,
  as: /^as(?![a-zA-Z_-])/,

  import: /^import(?![a-zA-Z_-])/,
  from: /^from(?![a-zA-Z_-])/,
  url: /^(http|ws)s?:\/\/[^ \r\n]+/,
  path: /^(((((\.\.|[-_.a-zA-Z0-9]+)\/)+|\.\/)[-_.a-zA-Z0-9]+(\.(js|clio))?)|([-_.a-zA-Z0-9]\.(js|clio)))/,

  comment: /^ *--[^\r\n]+/,

  symbol: /^[a-z$_][a-z_0-9$-]*/i,

  map: /^->/,
  set: /^=>/,

  filt: /^\|/,

  comparison: /^(!=|>=|<=|>|<|=)/,

  dsop: /^[\^]/,
  sop: /^[*/]/,
  op: /^[-+%]/,

  //range: /^\[([0-9]+,)?([0-9]+)?..([0-9]+)?\]/,

  dot: /^[.]/,
  atsign: /^[@]/,

  lbra: /^[\[]/,
  rbra: /^[\]]/,
  lpar: /^[\(]/,
  rpar: /^[\)]/,
  lcbr: /^[\{]/,
  rcbr: /^[\}]/,

  emptyline: /^(\r?\n[ \t\f]*\r?\n)+/,
  comma: /^,/,
  colon: /^:/,
  _n: /^\r?\n/,
  _: /^ +/
};

module.exports = patterns;
