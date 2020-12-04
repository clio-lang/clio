const { SourceNode } = require("source-map");

const TokenToSourceNode = (token) =>
  new SourceNode(token.line, token.column, token.source, token.raw);

const arr = (strs, ...vals) =>
  strs.reduce((prev, curr, i) => [...prev, curr, vals[i]], []).filter(Boolean);

const encode = (str) => {
  const parts = [];
  if (str.endsWith("?")) {
    str = str.slice(0, -1);
    parts.push("is");
  }
  let part = "";
  for (const char of str) {
    if (char.match(/[a-zA-Z0-9_]/)) part += char;
    else {
      if (part) parts.push(part);
      part = Array(char.length)
        .fill()
        .map((_, i) => char.charCodeAt(i).toString("36"))
        .join("_");
      parts.push(`$${part}$`);
      part = "";
    }
  }
  if (part) parts.push(part);
  return parts.join("_");
};

class TokenInstance {
  constructor(name, raw, index, line, column, source) {
    this.name = name;
    this.raw = raw;
    this.index = index;
    this.line = line;
    this.column = column;
    this.source = source;
  }
  is(token) {
    return token.name == this.name;
  }
}

class Token {
  constructor(name, pattern) {
    this.name = name;
    this.pattern = pattern;
    this._onMatch = (token) => token;
  }
  match(str) {
    return str.match(this.pattern);
  }
  getInstance(raw, index, line, column, source) {
    return new TokenInstance(this.name, raw, index, line, column, source);
  }
  satisfies(tokens, offset, context) {
    const token = tokens[offset];
    const satisfies = token && token.name == this.name;
    return this.result(satisfies, token, { ...context, offset, consumes: 1 });
  }
  result(satisfies, token = {}, context) {
    if (satisfies)
      return { satisfies, consumes: 1, result: this._onMatch(token, context) };
    else
      return {
        satisfies,
        traceback: `Expecting ${this.name} at ${token.line}:${token.column} but encountered ${token.name}`,
      };
  }
  onMatch(fn) {
    this._onMatch = fn;
    return this;
  }
}

const token = (...args) => new Token(...args);

const fn = token("Fn", /^fn(?=\s|$)/);
const Await = token("Await", /^await(?=\s|$|\[|\])/);
const pike = token("Pike", /^\|/);
const If = token("If", /^if(?=\s|$|\[|\])/);
const Else = token("Else", /^else(?=\s|$|\[|\])/);
const string = token("String", /(^"([^"]|\\.)*?")|(^'([^']|\\.)*?')/);
const backtick = token("Backtick", /^`/);
const colon = token("Colon", /^:/);
const arrow = token("Arrow", /^->/);
const fatArrow = token("Fat Arrow", /^=>/);
const comment = token("Comment", /^--.*/);
const lBracket = token("Opening Bracket", /^\[/);
const rBracket = token("Closing Bracket", /^\]/);
const lParen = token("Opening Parenthesis", /^\(/);
const rParen = token("Closing Parenthesis", /^\)/);
const hash = token("Hash", /^(hash(?=\s|$|\[|\]))|^#/);
const Export = token("Export", /^export(?=\s|$|\[|\])/);
const Import = token("Import", /^import(?=\s|$|\[|\])/);
const from = token("From", /^from(?=\s|$|\[|\])/);
const as = token("As", /^as(?=\s|$|\[|\])/);
const number = token("Number", /^[+-]?\d+/);
const pow = token("Power", /^\*\*/);
const mod = token("Module", /^%/);
const mul = token("Multiply", /^\*/);
const floorDiv = token("Floor Divide", /^\/\//);
const div = token("Divide", /^\//);
const add = token("Add", /^\+/);
const sub = token("Sub", /^-/);
const dot = token("Dot", /^\./);
const gte = token("Greater Or Equal", /^>=/);
const gt = token("Greater", /^>/);
const lte = token("Lower Or Equal", /^<=/);
const lt = token("Lower", /^</);
const neq = token("Not Equal", /^!=/);
const eq = token("Equal", /^=/);
const and = token("And", /^and(?=\s|$|\[|\])/);
const or = token("Or", /^or(?=\s|$|\[|\])/);
const not = token("Not", /^not(?=\s|$|\[|\])/);
const In = token("In", /^in(?=\s|$|\[|\])/);
const spaces = token("Spaces", /^ +/);
const newline = token("Newline", /^\n|\r\n?/);
const indent = token("Indent");
const outdent = token("Outdent");
const callIndent = token("Call Indent");
const callOutdent = token("Call Outdent");

const blockCommentStart = token("Block Comment Start", /^\+-+/);
const blockCommentEnd = token("Block Comment End", /^-+\+/);

const symbol = token("Symbol", /^[^\s:\.|(){}[\]'"]+/).onMatch((token) => {
  if (token.isEncoded) return token;
  token.raw = encode(token.raw);
  token.isEncoded = true;
  return token;
});

const other = token("Other", /^\S+/);

const patterns = [
  string,
  backtick,
  blockCommentStart,
  blockCommentEnd,
  comment,
  fn,
  If,
  Else,
  Await,
  pike,
  colon,
  arrow,
  fatArrow,
  lBracket,
  rBracket,
  lParen,
  rParen,
  hash,
  Export,
  Import,
  from,
  as,
  number,
  gte,
  gt,
  lte,
  lt,
  neq,
  eq,
  and,
  or,
  not,
  add,
  pow,
  mul,
  mod,
  floorDiv,
  div,
  sub,
  dot,
  In,
  symbol,
  spaces,
  newline,
  other,
];

const isOne = (instance, token) =>
  instance instanceof TokenInstance && instance.is(token);

const isOneOf = (instance, arr) => arr.some((token) => isOne(instance, token));

const detokenize = (token) =>
  token instanceof TokenInstance ? TokenToSourceNode(token) : token;

const nonSignificant = [newline, spaces, comment];
const nextSignificantToken = (tokens, i) => {
  while (tokens[i] && isOneOf(tokens[i++], nonSignificant));
  return tokens[i] && --i;
};

const parseComments = (tokens) => {
  const result = [];
  const content = [];
  let commentLevel = 0;
  for (const token of tokens) {
    if (isOne(token, blockCommentStart)) commentLevel++;
    else if (isOne(token, blockCommentEnd)) commentLevel--;
    else if (commentLevel > 0) content.push(token);
    else result.push(token);
    if (commentLevel < 0) throw "Mismatched block comments";
    else if (commentLevel == 0 && content.length) {
      result.push(
        comment.getInstance(
          content.map((token) => token.raw).join(""),
          content[0].index,
          content[0].line,
          content[0].column
        )
      );
      content.length = 0;
    }
  }
  if (commentLevel != 0) throw "Mismatched block comments";
  return result;
};

const addIndents = (tokens) => {
  const result = [];
  const indentLevels = [0];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (!token.is(newline)) {
      result.push(token);
      continue;
    }
    const nextTokenIndex = nextSignificantToken(tokens, index);
    if (!nextTokenIndex) {
      result.push(...tokens.slice(index));
      break;
    }
    const nextToken = tokens[nextTokenIndex - 1];
    const lastIndentLevel = indentLevels.slice(-1).pop();
    const currIndentLevel = nextToken.is(spaces) ? nextToken.raw.length : 0;
    if (currIndentLevel > lastIndentLevel) {
      result.push(token);
      result.push(
        indent.getInstance("", token.index, token.line, token.column)
      );
      indentLevels.push(currIndentLevel);
    } else if (lastIndentLevel > currIndentLevel) {
      while (true) {
        const lastIndentLevel = indentLevels.slice(-1).pop();
        if (lastIndentLevel <= currIndentLevel) break;
        result.push(token);
        result.push(
          outdent.getInstance("", token.index, token.line, token.column)
        );
        indentLevels.pop();
      }
    } else {
      result.push(token);
    }
  }
  while (indentLevels.length > 1) {
    result.push(
      outdent.getInstance(
        "",
        tokens[tokens.length - 1].index,
        tokens[tokens.length - 1].line,
        tokens[tokens.length - 1].column
      )
    );
    indentLevels.pop();
  }
  return result;
};

const removeIndentPair = (tokens, index) => {
  tokens.splice(index, 1);
  let outdentIndex = index + 1;
  let indentCount = 1;
  while (indentCount != 0) {
    const maybeOutdent = tokens[outdentIndex++];
    if (isOne(maybeOutdent, outdent)) indentCount--;
    else if (isOne(maybeOutdent, indent)) indentCount++;
  }
  tokens.splice(--outdentIndex, 1);
};

const replaceWithCallIndents = (tokens, index) => {
  const indentToken = tokens[index];
  tokens[index] = callIndent.getInstance(
    "",
    indentToken.index,
    indentToken.line,
    indentToken.column,
    indentToken.source
  );
  let outdentIndex = index + 1;
  let indentCount = 1;
  while (indentCount != 0) {
    const maybeOutdent = tokens[outdentIndex++];
    if (isOne(maybeOutdent, outdent)) indentCount--;
    else if (isOne(maybeOutdent, indent)) indentCount++;
  }
  const outdentToken = tokens[--outdentIndex];
  tokens[outdentIndex] = callOutdent.getInstance(
    "",
    outdentToken.index,
    outdentToken.line,
    outdentToken.column,
    outdentToken.source
  );
};

const isMathOp = (token) =>
  [mul, add, sub, div, floorDiv, pow].some((op) => isOne(token, op));

const isLogicOp = (token) => [and, or].some((op) => isOne(token, op));
const isPipeOp = (token) => [arrow, fatArrow].some((op) => isOne(token, op));

const isLeftIndentRemovable = (token) =>
  isMathOp(token) || isLogicOp(token) || isPipeOp(token);

const isRightIndentRemovable = (token) =>
  isMathOp(token) || isLogicOp(token) || isOne(token, not);

const getNext = (tokens, index, stopToken, ignoreList = []) => {
  while (tokens[index]) {
    const token = tokens[index];
    if (stopToken && isOne(token, stopToken)) return index;
    if (ignoreList.some((it) => isOne(token, it))) index++;
    else if (!stopToken) return index;
    else return;
  }
};

const getPrev = (tokens, index, stopToken, ignoreList = []) => {
  while (index > 0) {
    const token = tokens[index];
    if (stopToken && isOne(token, stopToken)) return index;
    if (ignoreList.some((it) => isOne(token, it))) index--;
    else if (!stopToken) return index;
    else return;
  }
};

const removeArrayIndents = (tokens) => {
  const result = [...tokens];
  let open = 0;
  for (let index = 0; index < result.length; index++) {
    const token = result[index];
    if (isOne(token, lBracket)) open++;
    if (isOne(token, rBracket)) open--;
    if (isOne(token, indent) && open) removeIndentPair(result, index);
  }
  return result;
};

const preprocessIndents = (tokens) => {
  const result = [...tokens];
  for (let index = 0; index < result.length; index++) {
    const token = result[index];
    if (isOne(token, arrow)) {
      const ignore = [spaces, newline, mul];
      const nextIndentIndex = getNext(result, index + 1, indent, ignore);
      if (nextIndentIndex) replaceWithCallIndents(result, nextIndentIndex);
    }
    const ignore = [spaces, newline];
    const nextIndentIndex = getNext(result, index + 1, indent, ignore);
    const prevIndentIndex = getPrev(result, index - 1, indent, ignore);
    if (isOne(token, mul) && getPrev(result, index - 1, arrow, ignore))
      continue;
    if (isRightIndentRemovable(token) && nextIndentIndex)
      removeIndentPair(result, nextIndentIndex);
    if (isLeftIndentRemovable(token) && prevIndentIndex) {
      removeIndentPair(result, prevIndentIndex);
      index--;
    }
  }
  return removeArrayIndents(result);
};

const tokenize = (string, source) => {
  let tokens = [];
  let index = 0;
  let line = 1;
  let column = 0;
  while (index < string.length) {
    let matched = false;
    for (const token of patterns) {
      const match = token.match(string.slice(index));
      if (match) {
        const raw = match[0];
        tokens.push(token.getInstance(raw, index, line, column, source));
        index += raw.length;
        matched = true;
        if (token == newline) (line += 1), (column = 0);
        else column += raw.length;
        break;
      }
    }
    if (!matched) throw "LEXING ERROR";
  }
  tokens = parseComments(tokens);
  tokens = addIndents(tokens);
  tokens = preprocessIndents(tokens);
  return tokens;
};

class Any {
  constructor(...defs) {
    this._name = "<Any>";
    this.defs = defs;
  }
  onMatch(fn) {
    this._onMatch = fn;
    return this;
  }
  satisfies(tokens, offset, context) {
    const tracebacks = [];
    for (const def of this.defs) {
      const { satisfies, consumes, traceback, result } = def.satisfies(
        tokens,
        offset,
        context
      );
      if (satisfies)
        return {
          satisfies,
          consumes,
          result: this._onMatch
            ? this._onMatch(result, { ...context, offset, consumes })
            : result,
          name: this._name,
        };
      tracebacks.push(traceback);
    }
    return { satisfies: false, traceback: tracebacks.join("\n") };
  }
}

const any = (...args) => new Any(...args);

class Once {
  constructor(...definition) {
    this.definition = definition;
    this._name = "<Once>";
    this._onMatch = (result) => result;
  }
  name(name) {
    this._name = name;
    return this;
  }
  ignore(...ignore) {
    this._ignore = ignore;
    return this;
  }
  flat(n) {
    this._flat = n;
    return this;
  }
  satisfies(tokens, offset = 0, context) {
    let startPoint = offset;
    const definition =
      this.definition.length == 1 && typeof this.definition[0] === "function"
        ? this.definition[0]()
        : this.definition;
    let firstLoop = true;
    const results = [];
    for (const def of definition) {
      let skip = 0;
      if (!firstLoop)
        while (this.shouldIgnore(tokens, offset + skip, context)) skip++;
      firstLoop = false;
      const { satisfies, consumes, traceback, result } = def.satisfies(
        tokens,
        offset + skip,
        context
      );
      if (!satisfies) {
        if (this._onFail) this._onFail(results, tokens, offset + skip, context);
        const formattedTraceback = traceback
          .split("\n")
          .map((part) => `  ${part}`)
          .join("\n");
        const token = tokens[startPoint] || {};
        return {
          satisfies: false,
          traceback: `‣ Expecting ${this._name} at ${token.line}:${token.column}\n${formattedTraceback}`,
        };
      }
      offset += consumes + (consumes ? skip : 0);
      results.push(result);
    }
    const flatResult = this._flat ? results.flat(this._flat) : results;
    const matchFnResult = this._onMatch(flatResult, {
      ...context,
      offset: startPoint,
      consumes: offset - startPoint,
    });
    return {
      satisfies: true,
      consumes: offset - startPoint,
      name: this._name,
      result: matchFnResult,
    };
  }
  shouldIgnore(tokens, offset, context) {
    const satisfies =
      this._ignore &&
      this._ignore.some(
        (def) => def.satisfies(tokens, offset, context).satisfies
      );
    return satisfies;
  }
  onMatch(fn) {
    this._onMatch = fn;
    return this;
  }
  onFail(fn) {
    this._onFail = fn;
    return this;
  }
}

const once = (...args) => new Once(...args);

class Option extends Once {
  constructor(...definition) {
    super(...definition);
    this._name = "<Option>";
  }
  satisfies(tokens, offset = 0, context) {
    const { satisfies, ...rest } = super.satisfies(tokens, offset, context);
    if (satisfies) return { satisfies, ...rest };
    return {
      satisfies: true,
      consumes: 0,
      result: this._onMatch([], { ...context, offset, consumes: 0 }),
    };
  }
}

const option = (...args) => new Option(...args);

class Many extends Once {
  constructor(...definition) {
    super(...definition);
    this._name = "<Many>";
  }
  satisfies(tokens, offset = 0, context) {
    let satisfied = false;
    let consumed = 0;
    let lastTraceback;
    let firstLoop = true;
    const results = [];
    while (true) {
      let skip = 0;
      if (!firstLoop)
        while (this.shouldIgnore(tokens, offset + consumed + skip, context))
          skip++;
      firstLoop = false;
      const processed = super.satisfies(
        tokens,
        offset + consumed + skip,
        context
      );
      const { satisfies, consumes, traceback, result } = processed;
      lastTraceback = traceback;
      if (!satisfies) break;
      satisfied = true;
      consumed += consumes + skip;
      results.push(result);
    }
    if (satisfied)
      return {
        satisfies: satisfied,
        consumes: consumed,
        result: results,
      };
    return { satisfied: false, traceback: lastTraceback };
  }
}

const many = (...args) => new Many(...args);

class Only extends Many {
  constructor(...definition) {
    super(...definition);
    this._name = "<Only>";
  }
  satisfies(tokens, offset = 0, context) {
    const { satisfies, consumes, ...rest } = super.satisfies(
      tokens,
      offset,
      context
    );
    const isSatisfied = satisfies && consumes === tokens.length - offset;
    if (!isSatisfied) {
      const { traceback } = super.satisfies(
        tokens,
        offset + (consumes || 0),
        context
      );
      return { ...rest, satisfies: false, traceback };
    }
    return {
      satisfies: isSatisfied,
      consumes,
      ...rest,
    };
  }
}

const only = (...args) => new Only(...args);

const errorAtToken = (token, err, { src }) => {
  const { line, column, source } = token;
  const lines = src
    .split("\n")
    .map((line, index) => `${index + 1} | ${line}`)
    .slice(line - 3 > 0 ? line - 3 : 0, line);
  lines.unshift(source + ":", "");
  const spaces = column + line.toString().length + 3;
  lines.push(" ".repeat(spaces) + "^");
  lines.push(err);
  throw new Error(lines.join("\n"));
};

const wrongTokenError = (expecting, tokens, offset, context) => {
  const [key, rule] = nextSatisfies(tokens, offset, context);
  const { line, column } = tokens[offset];
  const name = (rule && (rule._name || key)) || tokens[offset].name;
  errorAtToken(
    tokens[offset],
    `Expecting one of ${expecting} at ${line}:${column} but encountered ${name}`,
    context
  );
};

const Rules = {};

const nextSatisfies = (tokens, offset, context) => {
  return (
    Object.entries(Rules).find(
      ([_, rule]) => rule.satisfies(tokens, offset, context).satisfies
    ) || []
  );
};

Rules.range = once(
  lBracket,
  once(option(any(symbol, number)), colon).onMatch(([start]) => start),
  option(any(symbol, number)).onMatch(([end]) => end),
  option(colon, any(symbol, number)).onMatch(([_, __, step]) => step),
  rBracket
)
  .ignore(spaces, newline, indent, outdent)
  .name("range")
  .onMatch((result) => {
    result.pop();
    const { line, column, source } = result.shift();
    const start = result[0][0] ? detokenize(result[0][0]) : "0";
    const end = result[1] ? detokenize(result[1]) : "Infinity";
    const step = result[2] ? detokenize(result[2]) : "1";
    const range = new SourceNode(
      line,
      column,
      source,
      arr`range(${start}, ${end}, ${step})`
    );
    return range;
  });

Rules.pow = once(() => [
  any(
    Rules.wrapped,
    Rules.slice,
    Rules.propertyAccess,
    Rules.range,
    Rules.array,
    number,
    symbol
  ),
  many(
    pow,
    any(Rules.wrapped, Rules.slice, Rules.propertyAccess, number, symbol)
  )
    .ignore(spaces, newline)
    .onFail((matched, tokens, offset, context) => {
      if (matched[0]) {
        // pow matched
        wrongTokenError("Number, Symbol or Wrapped", tokens, offset, context);
      }
    }),
])
  .ignore(spaces, newline, indent, outdent)
  .onMatch((result) => {
    let pow = detokenize(result[0]);
    for (const [op, token] of result[1]) {
      const value = detokenize(token);
      pow = new SourceNode(
        op.line,
        op.column,
        op.source,
        arr`Math.pow(${pow}, ${value})`
      );
    }
    return pow;
  });

Rules.mul = once(() => [
  any(
    Rules.wrapped,
    Rules.propertyAccess,
    Rules.slice,
    Rules.range,
    Rules.pow,
    Rules.array,
    number,
    symbol
  ),
  many(
    any(mul, div, floorDiv, mod),
    any(
      Rules.wrapped,
      Rules.propertyAccess,
      Rules.slice,
      Rules.pow,
      number,
      symbol
    )
  )
    .ignore(spaces, newline)
    .onFail((matched, tokens, offset, context) => {
      if (matched[0]) {
        // (div, mul, mod) matched
        wrongTokenError("Number, Symbol or Wrapped", tokens, offset, context);
      }
    }),
])
  .ignore(spaces, newline, indent, outdent)
  .onMatch((result) => {
    let mul = detokenize(result[0]);
    for (const [op, token] of result[1]) {
      const value = detokenize(token);
      if (op.raw == "//")
        mul = new SourceNode(
          op.line,
          op.column,
          op.source,
          arr`Math.floor(${mul} // ${value})`
        );
      else
        mul = new SourceNode(
          op.line,
          op.column,
          op.source,
          arr`(${mul} ${op.raw} ${value})`
        );
    }
    return mul;
  });

Rules.add = once(() => [
  any(
    Rules.pow,
    Rules.mul,
    Rules.slice,
    Rules.propertyAccess,
    Rules.range,
    Rules.array,
    Rules.wrapped,
    Rules.string,
    number,
    symbol
  ),
  many(
    any(add, sub),
    any(
      Rules.pow,
      Rules.mul,
      Rules.slice,
      Rules.propertyAccess,
      Rules.wrapped,
      Rules.string,
      number,
      symbol
    )
  )
    .ignore(spaces, newline)
    .onFail((matched, tokens, offset, context) => {
      if (matched[0]) {
        // (add, sub) matched
        wrongTokenError("Number, Symbol or Wrapped", tokens, offset, context);
      }
    }),
])
  .ignore(spaces, newline, indent, outdent)
  .onMatch((result) => {
    let add = detokenize(result[0]);
    for (const [op, token] of result[1]) {
      const value = detokenize(token);
      add = new SourceNode(
        op.line,
        op.column,
        op.source,
        arr`(${add} ${op.raw} ${value})`
      );
    }
    return add;
  });

Rules.not = once(() => [
  not,
  any(
    Rules.functionCall,
    Rules.in,
    Rules.functionCall,
    Rules.cmp,
    Rules.and,
    Rules.not,
    Rules.or,
    Rules.wrapped,
    Rules.range,
    Rules.pow,
    Rules.array,
    Rules.slice,
    Rules.propertyAccess,
    Rules.string,
    number,
    symbol
  ),
])
  .ignore(spaces, newline, indent, outdent)
  .onFail((matched, tokens, offset, context) => {
    if (matched[0]) {
      // (not) matched
      const expecting =
        "Comparison, Logical, Wrapped, Range, Power, Array, Number or Symbol";
      wrongTokenError(expecting, tokens, offset, context);
    }
  })
  .onMatch((result) => {
    return new SourceNode(
      result[0].line,
      result[0].column,
      result[0].source,
      arr`(!${detokenize(result[1])})`
    );
  });

Rules.and = once(() => [
  any(
    Rules.functionCall,
    Rules.in,
    Rules.not,
    Rules.cmp,
    Rules.wrapped,
    Rules.range,
    Rules.pow,
    Rules.array,
    Rules.slice,
    Rules.propertyAccess,
    Rules.string,
    number,
    symbol
  ),
  many(
    and,
    any(
      Rules.functionCall,
      Rules.in,
      Rules.not,
      Rules.cmp,
      Rules.wrapped,
      Rules.range,
      Rules.pow,
      Rules.array,
      Rules.slice,
      Rules.propertyAccess,
      Rules.string,
      number,
      symbol
    )
  )
    .ignore(spaces, newline)
    .onFail((matched, tokens, offset, context) => {
      if (matched[0]) {
        const expecting =
          "Logical, Comparison, Wrapped, Range, Power, Array, Number or Symbol";
        wrongTokenError(expecting, tokens, offset, context);
      }
    }),
])
  .ignore(spaces, newline, indent, outdent)
  .onMatch((result) => {
    let and = detokenize(result[0]);
    for (const [op, token] of result[1]) {
      const value = detokenize(token);
      and = new SourceNode(
        op.line,
        op.column,
        op.source,
        arr`(${and} && ${value})`
      );
    }
    return and;
  });

Rules.or = once(() => [
  any(
    Rules.functionCall,
    Rules.in,
    Rules.not,
    Rules.and,
    Rules.cmp,
    Rules.wrapped,
    Rules.range,
    Rules.pow,
    Rules.array,
    Rules.slice,
    Rules.propertyAccess,
    Rules.string,
    number,
    symbol
  ),
  many(
    or,
    any(
      Rules.functionCall,
      Rules.in,
      Rules.not,
      Rules.and,
      Rules.cmp,
      Rules.wrapped,
      Rules.range,
      Rules.pow,
      Rules.array,
      Rules.slice,
      Rules.propertyAccess,
      Rules.string,
      number,
      symbol
    )
  )
    .ignore(spaces, newline)
    .onFail((matched, tokens, offset, context) => {
      if (matched[0]) {
        const expecting =
          "Logical, Comparison, Wrapped, Range, Power, Array, Number or Symbol";
        wrongTokenError(expecting, tokens, offset, context);
      }
    }),
])
  .ignore(spaces, newline, indent, outdent)
  .onMatch((result) => {
    let or = detokenize(result[0]);
    for (const [op, token] of result[1]) {
      const value = detokenize(token);
      or = new SourceNode(
        op.line,
        op.column,
        op.source,
        arr`(${or} || ${value})`
      );
    }
    return or;
  });

Rules.logical = once(any(Rules.or, Rules.and, Rules.not))
  .ignore(spaces, newline, indent, outdent)
  .name("logical")
  .onMatch((result) => {
    return result.pop();
  });

Rules.in = once(() => [
  any(
    Rules.wrapped,
    Rules.range,
    Rules.math,
    Rules.propertyAccess,
    Rules.slice,
    Rules.array,
    Rules.string,
    number,
    symbol
  ),
  In,
  any(Rules.propertyAccess, Rules.slice, Rules.array, Rules.string, symbol),
])
  .onFail((matched, tokens, offset, context) => {
    if (matched[1]) {
      const expecting = "Property Access, Slice, Array, Number or Symbol";
      wrongTokenError(expecting, tokens, offset, context);
    }
  })
  .ignore(spaces, newline)
  .onMatch((result) => {
    const lhs = detokenize(result[0]);
    const rhs = detokenize(result[2]);
    const op = detokenize(result[1]);
    return new SourceNode(
      op.line,
      op.column,
      op.source,
      arr`${rhs}.includes(${lhs})`
    );
  });

Rules.cmp = once(() => [
  any(
    Rules.functionCall,
    Rules.math,
    Rules.slice,
    Rules.propertyAccess,
    Rules.wrapped,
    Rules.range,
    Rules.array,
    Rules.string,
    number,
    symbol
  ),
  many(
    any(lte, gte, gt, lt, eq, neq),
    any(
      Rules.functionCall,
      Rules.math,
      Rules.slice,
      Rules.propertyAccess,
      Rules.wrapped,
      Rules.range,
      Rules.array,
      Rules.string,
      number,
      symbol
    )
  )
    .ignore(spaces, newline)
    .onFail((matched, tokens, offset, context) => {
      if (matched[0]) {
        const expecting = "Math, Wrapped, Range, Array, Number or Symbol";
        wrongTokenError(expecting, tokens, offset, context);
      }
    }),
])
  .ignore(spaces, newline, indent, outdent)
  .onMatch((result) => {
    let cmp = null;
    let curr = detokenize(result[0]);
    for (const [op, token] of result[1]) {
      const value = detokenize(token);
      const raw = op.raw == "=" ? "==" : op.raw;
      const currCmp = new SourceNode(
        op.line,
        op.column,
        op.source,
        arr`(${curr} ${raw} ${value})`
      );
      cmp = cmp
        ? new SourceNode(
            cmp.line,
            cmp.column,
            cmp.source,
            arr`(${cmp} && ${currCmp})`
          )
        : currCmp;
      curr = value;
    }
    return cmp;
  });

Rules.math = once(any(Rules.add, Rules.mul, Rules.pow))
  .ignore(spaces, newline, indent, outdent)
  .name("math")
  .onMatch((result) => {
    return result.pop();
  });

Rules.parallelFn = once(() => [
  pike,
  any(Rules.propertyAccess, Rules.slice, symbol),
  option(pike),
])
  .ignore(spaces)
  .onFail((matched, tokens, offset, context) => {
    if (matched[0]) {
      const expecting = "Property Access, Slice or Symbol";
      wrongTokenError(expecting, tokens, offset, context);
    }
  })
  .onMatch((result) => {
    const [pike, fn] = result;
    return new SourceNode(
      pike.line,
      pike.column,
      pike.source,
      arr`${detokenize(fn)}.parallel`
    );
  });

Rules.functionCall = once(() => [
  option(Await),
  once(any(Rules.parallelFn, Rules.propertyAccess, symbol), spaces),
  many(
    any(
      Rules.anonymousFn,
      Rules.propertyAccess,
      Rules.slice,
      Rules.range,
      Rules.math,
      Rules.wrapped,
      Rules.string,
      Rules.hash,
      number,
      symbol
    )
  ).ignore(spaces),
])
  .ignore(spaces)
  .name("function call")
  .onFail((matched, tokens, offset, context) => {
    if (matched[0][0] && matched[1]) {
      const expecting = "Range, Math, Number or Symbol";
      wrongTokenError(expecting, tokens, offset, context);
    }
    if (matched[0][0] && !isOne(tokens[offset], colon)) {
      const expecting = "Parallel Function or Symbol";
      wrongTokenError(expecting, tokens, offset, context);
    }
  })
  .onMatch((result) => {
    const awaitKw = detokenize(result[0].pop());
    const fn = detokenize(result[1][0]);
    const args = new SourceNode(
      null,
      null,
      result[2].source,
      result[2].flat().map(detokenize)
    );
    const call = new SourceNode(
      fn.line,
      fn.column,
      fn.source,
      arr`${fn}(${args.join(", ")})`
    );
    const awaited = awaitKw
      ? new SourceNode(
          awaitKw.line,
          awaitKw.column,
          awaitKw.source,
          arr`await ${call}`
        )
      : call;
    if (awaitKw) awaited.isAsync = true;
    return awaited;
  });

Rules.array = once(() => [
  lBracket,
  many(
    any(
      Rules.hash,
      Rules.range,
      Rules.array,
      Rules.wrapped,
      number,
      Rules.string,
      symbol
    )
  ).ignore(spaces, newline, indent, outdent),
  rBracket,
])
  .ignore(spaces, newline, indent, outdent)
  .name("Array")
  .onFail((matched, tokens, offset, context) => {
    if (matched[0] && !isOne(tokens[offset], colon)) {
      const expecting = "Hash, Range, Array, Wrapped, Number, String or Symbol";
      wrongTokenError(expecting, tokens, offset, context);
    }
  })
  .onMatch(([lBra, items, __]) => {
    items = new SourceNode(
      null,
      null,
      items[0].source,
      items.flat(2).map(detokenize)
    );
    return new SourceNode(
      lBra.line,
      lBra.column,
      lBra.source,
      arr`[${items.join(", ")}]`
    );
  });

Rules.awaited = once(() => [
  Await,
  any(Rules.functionCall, Rules.wrapped, symbol),
])
  .ignore(spaces)
  .onFail((matched, tokens, offset, context) => {
    if (matched[0] && !isOne(tokens[offset], colon)) {
      const expecting = "Function Call, Wrapped or Symbol";
      wrongTokenError(expecting, tokens, offset, context);
    }
  })
  .onMatch(([awaitKw, value]) => {
    const node = new SourceNode(
      awaitKw.line,
      awaitKw.column,
      awaitKw.source,
      arr`(await ${detokenize(value)})`
    );
    node.isAsync = true;
    return node;
  });

Rules.awaitedBlock = once(() => [
  Await,
  colon,
  indent,
  many(any(Rules.chain, Rules.functionCall, Rules.wrapped, symbol)).ignore(
    spaces,
    newline
  ),
  outdent,
])
  .ignore(spaces, newline)
  .onFail((matched, tokens, offset, context) => {
    if (matched[0] && matched[1] && matched[2]) {
      const expecting = "Chain, Function Call, Wrapped or Symbol";
      wrongTokenError(expecting, tokens, offset, context);
    }
    if (matched[0] && matched[1] && !isOne(tokens[offset], lBracket)) {
      const expecting = "Indent";
      wrongTokenError(expecting, tokens, offset, context);
    }
  })
  .onMatch(([awaitKw, _, __, inner]) => {
    inner = inner.map((node) =>
      node.returnForm
        ? new SourceNode(
            node.line,
            node.column,
            node.source,
            arr`(() => {${node.returnForm}})()`
          )
        : node
    );
    const node = new SourceNode(
      awaitKw.line,
      awaitKw.column,
      awaitKw.source,
      arr`await Promise.all([${inner.join(", ")}])`
    );
    node.isAsync = true;
    return node;
  });

Rules.awaitedArray = once(() => [
  Await,
  colon,
  lBracket,
  many(any(Rules.chain, Rules.functionCall, Rules.wrapped, symbol)).ignore(
    spaces,
    newline
  ),
  rBracket,
])
  .ignore(spaces, newline, indent, outdent)
  .onFail((matched, tokens, offset, context) => {
    if (matched[0] && matched[1] && matched[2]) {
      const expecting = "Chain, Function Call, Wrapped or Symbol";
      wrongTokenError(expecting, tokens, offset, context);
    }
  })
  .onMatch(([awaitKw, _, __, inner]) => {
    inner = inner.map((node) =>
      node.returnForm
        ? new SourceNode(
            node.line,
            node.column,
            node.source,
            arr`(() => {${node.returnForm}})()`
          )
        : node
    );
    const node = new SourceNode(
      awaitKw.line,
      awaitKw.column,
      awaitKw.source,
      arr`await Promise.all([${inner.join(", ")}])`
    );
    node.isAsync = true;
    return node;
  });

Rules.awaitedAny = once(
  any(Rules.awaitedBlock, Rules.awaitedArray, Rules.awaited)
).onMatch(([result]) => result);

Rules.awaitAllOp = once(lBracket, Await, rBracket);

Rules.methodCall = once(dot, any(Rules.functionCall, symbol)).onMatch(
  ([dot, call]) => {
    dot = detokenize(dot);
    if (call instanceof SourceNode) {
      if (call.children[0] instanceof SourceNode) {
        call.children[0].children.unshift(dot);
      } else
        call.children[0] = new SourceNode(call.line, call.column, call.source, [
          dot,
          call.children[0],
        ]);
    } else {
      call = detokenize(call);
      call.children.unshift(dot);
    }
    return call;
  }
);

Rules.indentCall = once(() => [
  newline,
  callIndent,
  many(
    option(dot),
    any(
      Rules.chain,
      Rules.methodCall,
      Rules.functionCall,
      Rules.parallelFn,
      Rules.propertyAccess,
      symbol
    ).onMatch((_, { tokens, offset, consumes }) => {
      const matchedTokens = tokens.slice(offset, offset + consumes);
      return matchedTokens;
    })
  )
    .ignore(spaces, newline)
    .onMatch(([optionalDot, tokens]) => {
      if (optionalDot[0]) tokens.unshift(optionalDot[0]);
      const { index, line, column, source } = tokens[0];
      tokens.unshift(arrow.getInstance("->", index, line, column, source));
      tokens.unshift(spaces.getInstance(" ", index, line, column, source));
      tokens.unshift(symbol.getInstance("_in", index, line, column, source));
      return tokens;
    }),
  callOutdent,
])
  .ignore(spaces, newline)
  .onMatch((result) => {
    const chains = result[2].map(
      (tokens) => Rules.chain.satisfies(tokens, 0).result
    );
    const chainsNode = new SourceNode(null, null, null, chains).join(", ");
    const fn = new SourceNode(
      result[0].line,
      result[0].column,
      result[0].source,
      arr`(_in => [${chainsNode}])`
    );
    return fn;
  });

Rules.anonymousFn = once(() => [
  symbol,
  colon,
  any(
    Rules.logical,
    Rules.hash,
    Rules.functionCall,
    Rules.cmp,
    Rules.math,
    Rules.slice,
    Rules.range,
    Rules.array,
    Rules.wrapped,
    Rules.propertyAccess
  ),
])
  .ignore(spaces)
  .name("Anonymous Fn")
  .onMatch(([param, _, body]) => {
    return new SourceNode(
      param.line,
      param.column,
      param.source,
      arr`(${detokenize(param)} => ${detokenize(body)})`
    );
  });

Rules.chain = once(() => [
  any(
    Rules.awaited,
    Rules.awaitedArray,
    Rules.logical,
    Rules.cmp,
    Rules.functionCall,
    Rules.math,
    Rules.slice,
    Rules.range,
    Rules.array,
    Rules.wrapped,
    Rules.hash,
    Rules.propertyAccess,
    Rules.string,
    symbol,
    number
  ),
  many(
    any(
      once(
        arrow,
        option(mul).onMatch((result) => result.pop()),
        option(any(Rules.awaitAllOp, Await)).onMatch((result) => result.pop()),
        any(
          Rules.indentCall,
          Rules.anonymousFn,
          Rules.methodCall,
          Rules.functionCall,
          Rules.parallelFn,
          Rules.propertyAccess,
          symbol
        )
      )
        .onFail((matched, tokens, offset, context) => {
          if (matched[0]) {
            const expecting =
              "*, Indent, Await, Await All, Method, Function Call, Parallel Function, Property Access or Symbol";
            wrongTokenError(expecting, tokens, offset, context);
          }
        })
        .ignore(spaces),
      once(
        fatArrow,
        any(
          Rules.propertyAccess,
          Rules.slice,
          once(option(Export), symbol).ignore(spaces)
        )
      )
        .onFail((matched, tokens, offset, context) => {
          if (matched[0]) {
            const expecting = "Property Access, Slice, or Symbol";
            wrongTokenError(expecting, tokens, offset, context);
          }
        })
        .ignore(spaces)
    )
  ).ignore(spaces, newline, indent, outdent),
])
  .ignore(spaces, newline, indent, outdent)
  .name("chain")
  .onMatch(([data, calls]) => {
    calls = calls.flat();
    const chain = [];
    let current = detokenize(data);
    let isCurrentName = false;
    let isAsync = data.isAsync;
    let awaitOneByOne = false;
    for (const callItem of calls) {
      const op = callItem.shift();
      let call = callItem.pop();
      const isMethod =
        call instanceof SourceNode &&
        call.children[0] &&
        call.children[0].children &&
        call.children[0].children[0] == ".";
      if (op.is(arrow)) {
        isCurrentName = false;
        const needsShift =
          call instanceof SourceNode && call.children[1].toString() == "(";
        const fn = needsShift ? call.children[0] : detokenize(call);
        const args = needsShift ? call.children.slice(2, -1) : [];
        const argsNode = new SourceNode(null, null, fn.source, args).join(", ");
        if (callItem[0]) {
          const awaitOp = callItem.pop();
          const mapOp = callItem.pop();
          const regularHead = "(item, index, arr) => ";
          const regularArg = "item";
          const awaitArg = `await ${regularArg}`;
          const awaitHead = `async ${regularHead}`;
          const head = awaitOneByOne ? awaitHead : regularHead;
          const args = awaitOneByOne ? awaitArg : regularArg;
          const rawFn = needsShift ? fn : detokenize(call);
          const methodCall =
            !awaitOneByOne && !needsShift
              ? new SourceNode(null, null, null, arr`(item => item${rawFn}())`)
              : new SourceNode(null, null, null, arr`item${rawFn}`);
          const fnToCall = isMethod ? methodCall : rawFn;
          const firstArg = isMethod
            ? ""
            : new SourceNode(null, null, null, [args, ","]);
          const callArgs = needsShift
            ? new SourceNode(
                null,
                null,
                null,
                arr`(${firstArg}${argsNode}, index, arr)`
              )
            : new SourceNode(null, null, null, arr`(${args}, index, arr)`);
          const mapFn =
            !awaitOneByOne && !needsShift
              ? fnToCall
              : new SourceNode(
                  fn.line,
                  fn.column,
                  fn.source,
                  arr`${head}${fnToCall}${callArgs}`
                );
          awaitOneByOne = false;
          current = new SourceNode(
            mapOp.line,
            mapOp.column,
            mapOp.source,
            arr`(${current}).map(${mapFn})`
          );
          if (awaitOp) {
            isAsync = true;
            current = Array.isArray(awaitOp)
              ? new SourceNode(
                  awaitOp[0].line,
                  awaitOp[0].column,
                  awaitOp[0].source,
                  arr`(await Promise.all(${current}))`
                )
              : current;
            if (!Array.isArray(awaitOp)) awaitOneByOne = true;
          }
        } else {
          if (isMethod) call.children[0].children.unshift(current);
          const awaitOp = callItem.pop();
          const currentJoin = isMethod
            ? ""
            : new SourceNode(null, null, null, arr`${current}, `);
          const args = isMethod ? "" : current;
          current = needsShift
            ? new SourceNode(
                fn.line,
                fn.column,
                fn.source,
                arr`${fn}(${currentJoin}${argsNode})`
              )
            : new SourceNode(
                fn.line,
                fn.column,
                fn.source,
                arr`${fn}(${args})`
              );
          if (awaitOp) {
            isAsync = true;
            current = new SourceNode(
              awaitOp.line,
              awaitOp.column,
              awaitOp.source,
              arr`(await ${current})`
            );
          }
        }
      } else {
        const isExported = Array.isArray(call) && isOne(call[0][0], Export);
        const name = detokenize(Array.isArray(call) ? call[1] : call);
        const prefix = name.toString().match(/\.|\[/) ? "" : "const ";
        chain.push(
          new SourceNode(
            name.line,
            name.column,
            name.source,
            arr`${prefix}${name} = ${current}`
          )
        );
        if (isExported)
          chain.push(
            new SourceNode(
              call[0][0].line,
              call[0][0].column,
              call[0][0].source,
              arr`exports.${name} = ${name}`
            )
          );
        current = name;
        isCurrentName = true;
      }
    }
    if (!isCurrentName) chain.push(current);
    const chainNode = new SourceNode(
      chain[0].line,
      chain[0].column,
      chain[0].source,
      chain
    ).join(";");
    if (isCurrentName) {
      chainNode.returnForm = new SourceNode(
        chain[0].line,
        chain[0].column,
        chain[0].source,
        [
          ...chain,
          ";",
          new SourceNode(
            current.line,
            current.column,
            current.source,
            arr`return ${current}`
          ),
        ]
      );
    } else {
      const lastNode = chain.slice().pop();
      const returnForm =
        lastNode.returnForm ||
        new SourceNode(
          lastNode.line,
          lastNode.column,
          lastNode.source,
          arr`return ${lastNode}`
        );
      chainNode.returnForm = new SourceNode(
        chain[0].line,
        chain[0].column,
        chain[0].source,
        [...chain.slice(0, -1), ";", returnForm]
      );
    }
    chainNode.isAsync = isAsync;
    return chainNode;
  });

Rules.keyValue = once(() => [
  any(
    Rules.slice,
    Rules.range,
    Rules.array,
    Rules.functionCall,
    Rules.math,
    Rules.wrapped,
    Rules.string,
    once(symbol).onMatch(([symbol]) => {
      const detokenized = detokenize(symbol);
      return new SourceNode(
        symbol.line,
        symbol.column,
        symbol.source,
        arr`"${detokenized}"`
      );
    }),
    number
  ),
  colon,
  any(
    Rules.slice,
    Rules.range,
    Rules.array,
    Rules.propertyAccess,
    Rules.functionCall,
    Rules.math,
    Rules.wrapped,
    Rules.string,
    symbol,
    number
  ),
])
  .ignore(spaces)
  .onFail((matched, tokens, offset, context) => {
    if (matched[1] && matched[2]) {
      const expecting =
        "Function Call, Math, Wrapped, String, Symbol or Number";
      wrongTokenError(expecting, tokens, offset, context);
    }
  })
  .name("key value")
  .onMatch(([key, _, value]) => {
    key = detokenize(key);
    value = detokenize(value);
    return new SourceNode(
      null,
      null,
      key.source,
      arr`hashmap[${key}] = ${value}`
    );
  });

Rules.nestedHash = once(() => [
  symbol,
  colon,
  indent,
  many(any(Rules.nestedHash, Rules.keyValue)).ignore(spaces, newline),
  outdent,
])
  .onFail((matched, tokens, offset, context) => {
    if (matched[1] && matched[2] && matched[3] && matched[4]) {
      const expecting = "Nested Outdent";
      wrongTokenError(expecting, tokens, offset, context);
    }
    if (matched[1] && matched[2] && matched[3]) {
      const expecting = "Nested Hash or Key Value";
      wrongTokenError(expecting, tokens, offset, context);
    }
  })
  .ignore(spaces, newline, spaces)
  .onMatch(([key, _, __, value]) => {
    key = detokenize(key);
    value = value.flat(2).map(detokenize);
    const valueNode = new SourceNode(null, null, key.source, value).join(";");
    return new SourceNode(
      null,
      null,
      key.source,
      arr`hashmap[${key}] = (() => { const hashmap = {}; ${valueNode}; return hashmap })()`
    );
  });

Rules.inlineHash = once(
  hash,
  option(many(any(Rules.nestedHash, Rules.keyValue)).ignore(spaces, newline))
)
  .ignore(spaces)
  .name("inline hash")
  .onMatch(([hash, keys]) => {
    keys = keys.flat(2).map(detokenize);
    const keysNode = new SourceNode(null, null, hash.source, keys).join(";");
    const hashNode = new SourceNode(
      hash.line,
      hash.column,
      hash.source,
      arr`(() => { const hashmap = {}; ${keysNode}; return hashmap })()`
    );
    return hashNode;
  });

Rules.indentHash = once(
  hash,
  indent,
  many(any(Rules.nestedHash, Rules.keyValue)).ignore(spaces, newline),
  outdent
)
  .ignore(spaces, newline)
  .name("indent hash")
  .onFail((matched, tokens, offset, context) => {
    if (matched[0] && matched[1] && matched[2]) {
      const expecting = "Outdent";
      wrongTokenError(expecting, tokens, offset, context);
    }
    if (matched[0] && matched[1]) {
      const expecting = "Nested Hash or Key Value";
      wrongTokenError(expecting, tokens, offset, context);
    }
  })
  .onMatch(([hash, __, keys]) => {
    keys = keys.flat(2).map(detokenize);
    const keysNode = new SourceNode(null, null, hash.source, keys).join(";");
    const hashNode = new SourceNode(
      hash.line,
      hash.column,
      hash.source,
      arr`(() => { const hashmap = {}; ${keysNode}; return hashmap })()`
    );
    return hashNode;
  });

Rules.mixedHash = once(
  hash,
  many(any(Rules.nestedHash, Rules.keyValue)).ignore(spaces, newline),
  indent,
  many(any(Rules.nestedHash, Rules.keyValue)).ignore(spaces, newline),
  outdent
)
  .ignore(spaces, newline)
  .name("mixed hash")
  .onMatch(([hash, keys0, __, keys1]) => {
    const keys = [
      ...keys0.flat(2).map(detokenize),
      ...keys1.flat(2).map(detokenize),
    ];
    const keysNode = new SourceNode(null, null, hash.source, keys).join(";");
    const hashNode = new SourceNode(
      hash.line,
      hash.column,
      hash.source,
      arr`(() => { const hashmap = {}; ${keysNode}; return hashmap })()`
    );
    return hashNode;
  });

Rules.hash = once(any(Rules.mixedHash, Rules.indentHash, Rules.inlineHash))
  .name("hash")
  .onMatch((result) => {
    return new SourceNode(
      result[0].line,
      result[0].column,
      result[0].source,
      result[0]
    );
  });

Rules.slice = once(() => [
  any(Rules.array, Rules.range, symbol),
  many(any(Rules.array, Rules.range)),
])
  .name("slice")
  .onMatch(([lhs, rhs]) => {
    let slice = detokenize(lhs);
    for (const slicer of rhs) {
      slice = new SourceNode(
        slicer.line,
        slicer.column,
        slicer.source,
        arr`slice(${slice}, ${detokenize(slicer)})`
      );
    }
    return slice;
  });

// TODO: make a real parser rule for this
const toJsTemplate = (str) => {
  let result = "";
  let index = 0;
  let open = 0;
  let inner = "";
  while (str[index]) {
    if (str[index] == "\\") {
      if (open) {
        inner += "\\";
        index++;
        inner += str[index];
      } else {
        result += "\\";
        index++;
        result += str[index];
      }
    } else if (str[index] == "{") {
      if (!open) result += "$";
      if (open) {
        inner += "{";
      } else {
        result += "{";
      }
      open++;
    } else if (str[index] == "}") {
      open--;
      if (open) {
        inner += "}";
      } else {
        // TODO: we need sourcemaps for these too
        const innerExpr = once(
          any(
            Rules.chain,
            Rules.functionCall,
            Rules.logical,
            Rules.cmp,
            Rules.math,
            Rules.slice,
            Rules.propertyAccess,
            symbol
          )
        ).satisfies(tokenize(inner), 0);
        result += detokenize(innerExpr.result.pop()).toString();
        inner = "";
        result += "}";
      }
    } else {
      if (open) {
        inner += str[index];
      } else {
        result += str[index];
      }
    }
    index++;
  }
  if (open != 0) throw "Unbalanced parenthesis";
  return result;
};

Rules.string = any(
  once(option(symbol), string)
    .name("string")
    .onMatch(([fn, string]) => {
      const detokenized = detokenize(fn[0]);
      const formatFn =
        detokenized && detokenized.toString() == "f" ? "" : detokenized;
      const str = fn.length ? toJsTemplate(string.raw) : string.raw;
      return fn.length
        ? new SourceNode(
            string.line,
            string.column,
            string.source,
            arr`${formatFn}\`${str.slice(1, -1)}\``
          )
        : new SourceNode(
            string.line,
            string.column,
            string.source,
            string.raw.replace(/\n/g, "\\n")
          );
    }),
  once(() => [
    option(symbol),
    backtick,
    any(Rules.wrapped, Rules.array, Rules.propertyAccess, Rules.slice, symbol),
  ]).onMatch(([fn, tick, str]) => {
    const detokenized = detokenize(fn[0]);
    const formatFn = (fn.length && fn[0].toString()) == "f" ? "" : detokenized;
    return new SourceNode(
      tick.line,
      tick.column,
      tick.source,
      arr`${formatFn}\`${detokenize(str)}\``
    );
  })
);

Rules.block = once(() => [
  many(
    any(
      Rules.in,
      Rules.fn,
      Rules.chain,
      Rules.functionCall,
      Rules.conditional,
      Rules.logical,
      Rules.cmp,
      Rules.math,
      Rules.slice,
      Rules.propertyAccess,
      Rules.awaitedAny,
      Rules.array,
      Rules.range,
      Rules.hash,
      Rules.string,
      symbol,
      number
    )
  ).ignore(spaces, newline, comment),
])
  .ignore(spaces, newline)
  .name("block")
  .onMatch((result) => {
    const expressions = result.flat(3).map(detokenize);
    const inner = new SourceNode(
      expressions[0].line,
      expressions[0].column,
      expressions[0].source,
      expressions
    ).join(";\n");
    const lastExpression = expressions.slice().pop();
    const returnForm =
      lastExpression.returnForm ||
      new SourceNode(
        lastExpression.line,
        lastExpression.column,
        lastExpression.source,
        arr`return ${lastExpression}`
      );
    const returnInner = new SourceNode(null, null, expressions[0].source, [
      ...expressions.slice(0, -1),
      returnForm,
    ]).join(";\n");
    const block = new SourceNode(
      expressions[0].line,
      expressions[0].column,
      expressions[0].source,
      arr`{${inner}}`
    );
    block.returnForm = new SourceNode(
      expressions[0].line,
      expressions[0].column,
      expressions[0].source,
      arr`{${returnInner}}`
    );
    block.isAsync = expressions.some((expr) => expr.isAsync);
    return block;
  });

Rules.wrapped = once(() => [
  lParen,
  option(
    any(
      Rules.in,
      Rules.conditional,
      Rules.anonymousFn,
      Rules.hash,
      Rules.chain,
      Rules.functionCall,
      Rules.math,
      Rules.logical
    )
  ),
  rParen,
])
  .ignore(spaces, newline, indent, outdent)
  .onFail((matched, tokens, offset, context) => {
    if (matched[0]) {
      const expecting = "Hash, Chain, Function Call or Math";
      wrongTokenError(expecting, tokens, offset, context);
    }
  })
  .onMatch(([lPar, inner, __]) => {
    return inner.length
      ? new SourceNode(
          lPar.line,
          lPar.column,
          lPar.source,
          inner[0].returnForm
            ? arr`((()=>{${inner[0].returnForm}})())`
            : arr`(${inner[0]})`
        )
      : new SourceNode(lPar.line, lPar.column, lPar.source, " ");
  });

Rules.propertyAccess = once(
  any(Rules.wrapped, Rules.slice, symbol),
  many(
    any(
      once(dot, symbol).onFail((matched, tokens, offset, context) => {
        if (matched[0]) {
          const expecting = "Symbol";
          wrongTokenError(expecting, tokens, offset, context);
        }
      }),
      Rules.array
    )
  ).flat(2)
).onMatch(([first, access]) => {
  let propertyAccess = detokenize(first);
  for (const part of access) {
    if (part.length == 1) {
      propertyAccess = new SourceNode(
        part[0].line,
        part[0].column,
        part[0].source,
        arr`slice(${propertyAccess}, ${part[0]})`
      );
    } else {
      propertyAccess = new SourceNode(
        part[0].line,
        part[0].column,
        part[0].source,
        arr`${propertyAccess}.${detokenize(part[1])}`
      );
    }
  }
  return propertyAccess;
});

const importInner = many(
  any(mul, symbol),
  option(as, symbol)
    .ignore(spaces)
    .onFail((matched, tokens, offset, context) => {
      if (matched[0]) {
        const expecting = "Symbol";
        wrongTokenError(expecting, tokens, offset, context);
      }
    })
    .onMatch((result) => result.pop())
)
  .ignore(spaces, newline)
  .onMatch((result) => {
    result = result.filter(Boolean);
    return result.length == 2
      ? result[0].raw === "*"
        ? new SourceNode(
            result[0].line,
            result[0].column,
            result[0].source,
            arr`...${detokenize(result[1])}`
          )
        : new SourceNode(
            result[0].line,
            result[0].column,
            result[0].source,
            arr`${detokenize(result[0])}: ${detokenize(result[1])}`
          )
      : result[0];
  });

const path = require("path");
const getModuleName = (location) =>
  path.basename(location, path.extname(location));

Rules.inlineImport = once(
  Import,
  option(once(importInner, from).ignore(spaces))
    .flat(1)
    .onFail((matched, tokens, offset, context) => {
      if (matched[0]) {
        const expecting = "From";
        wrongTokenError(expecting, tokens, offset, context);
      }
    })
    .onMatch((result) => {
      const parts = result.shift();
      const partsNode =
        parts &&
        new SourceNode(null, null, parts[0].source, parts.map(detokenize));
      if (
        parts &&
        parts.length == 1 &&
        parts[0] instanceof SourceNode &&
        parts[0].children[0] === "..."
      ) {
        parts[0].children.shift();
        return parts;
      }
      return parts
        ? new SourceNode(
            null,
            null,
            parts[0].source,
            arr`{ ${partsNode.join(",")} }`
          )
        : null;
    }),
  Rules.string
)
  .ignore(spaces)
  .name("inline import")
  .onFail((matched, tokens, offset, context) => {
    if (matched[0] && !isOne(tokens[offset], indent)) {
      const expecting = "* or Symbol";
      wrongTokenError(expecting, tokens, offset, context);
    }
  })
  .onMatch((result) => {
    const op = result.shift();
    const [names, path] = result;
    const importPath = names ? detokenize(path) : path.toString();
    const imported = names || getModuleName(importPath.toString().slice(1, -1));
    const isJS = importPath.toString().endsWith(".js");
    const isClio = importPath.toString().endsWith(".clio");
    const isCloud = importPath.toString().match(/[a-z]+:\/\//i);
    if (isCloud)
      return new SourceNode(
        op.line,
        op.column,
        op.source,
        arr`const ${imported} = await clio.importCloud(${importPath})`
      );
    if (isJS)
      return new SourceNode(
        op.line,
        op.column,
        op.source,
        arr`const ${imported} = require(${importPath})`
      );
    if (isClio)
      return new SourceNode(
        op.line,
        op.column,
        op.source,
        arr`const ${imported} = await require(${importPath}).__clioModule(clio)`
      );
    const rawPath = importPath.toString().slice(1, -1);
    const clioExtRequire = new SourceNode(
      op.line,
      op.column,
      op.source,
      arr`${imported} = await require("${rawPath}.clio").__clioModule(clio)`
    );
    const jsRequire = new SourceNode(
      op.line,
      op.column,
      op.source,
      arr`${imported} = require(${importPath})`
    );
    const importStatement = new SourceNode(
      op.line,
      op.column,
      op.source,
      arr`let ${imported}; try { ${clioExtRequire} } catch (err) { ${jsRequire} }`
    );
    return importStatement;
  });

Rules.indentImport = once(
  Import,
  indent,
  importInner,
  outdent,
  from,
  Rules.string
)
  .ignore(spaces, newline)
  .name("indent import")
  .onFail((matched, tokens, offset, context) => {
    if (matched[0] && matched[1] && matched[2] && matched[3] && matched[4]) {
      const expecting = "String";
      wrongTokenError(expecting, tokens, offset, context);
    }
    if (matched[0] && matched[1] && matched[2] && matched[3]) {
      const expecting = "From";
      wrongTokenError(expecting, tokens, offset, context);
    }
    if (matched[0] && matched[1] && matched[2]) {
      const expecting = "Outdent";
      wrongTokenError(expecting, tokens, offset, context);
    }
    if (matched[0] && matched[1]) {
      const expecting = "* or Symbol";
      wrongTokenError(expecting, tokens, offset, context);
    }
  })
  .onMatch((result) => {
    const op = result[0];
    const names = result[2];
    const path = result[5];
    if (names) {
      const namesNode = new SourceNode(null, null, op.source, names);
      const joined = namesNode.join(", ");
      const importStatement = new SourceNode(
        op.line,
        op.column,
        op.source,
        arr`const { ${joined} } = await clioImport(${detokenize(path)})`
      );
      return importStatement;
    } else {
      const { raw } = path;
      const moduleName = getModuleName(raw.slice(1, -1));
      const importStatement = new SourceNode(
        op.line,
        op.column,
        op.source,
        arr`const ${moduleName} = await clioImport(${raw})`
      );
      return importStatement;
    }
  });

Rules.import = once(any(Rules.indentImport, Rules.inlineImport))
  .name("import")
  .onMatch((result) => result.pop());

Rules.conditional = once(
  If,
  any(
    Rules.in,
    Rules.logical,
    Rules.cmp,
    Rules.slice,
    Rules.propertyAccess,
    symbol,
    number
  ),
  colon,
  any(
    once(indent, Rules.block, outdent).ignore(spaces, newline),
    Rules.in,
    Rules.chain,
    Rules.functionCall,
    Rules.math,
    Rules.wrapped,
    Rules.array,
    Rules.range,
    Rules.string,
    symbol,
    number
  ),
  option(
    many(
      Else,
      any(
        once(
          If,
          any(
            Rules.logical,
            Rules.cmp,
            Rules.slice,
            Rules.propertyAccess,
            symbol,
            number
          ),
          colon,
          any(
            once(indent, Rules.block, outdent).ignore(spaces, newline),
            Rules.chain,
            Rules.functionCall,
            Rules.math,
            Rules.wrapped,
            Rules.array,
            Rules.range,
            Rules.string,
            symbol,
            number
          )
        )
          .onFail((matched, tokens, offset, context) => {
            if (matched[0] && matched[1] && matched[2]) {
              const expecting =
                "Chain, Function Call, Math, Wrapped, Array, Range, Symbol, String, Number or Block";
              wrongTokenError(expecting, tokens, offset, context);
            }
            if (matched[0] && matched[1]) {
              const expecting = "Colon";
              wrongTokenError(expecting, tokens, offset, context);
            }
            if (matched[0]) {
              const expecting = "Comparison, Symbol or Number";
              wrongTokenError(expecting, tokens, offset, context);
            }
          })
          .ignore(newline, spaces),
        once(
          colon,
          any(
            once(indent, Rules.block, outdent).ignore(spaces, newline),
            Rules.chain,
            Rules.functionCall,
            Rules.math,
            Rules.wrapped,
            Rules.array,
            Rules.range,
            Rules.string,
            symbol,
            number
          )
        )
          .onFail((matched, tokens, offset, context) => {
            if (matched[0]) {
              const expecting =
                "Chain, Function Call, Math, Wrapped, Array, Range, Symbol, String, Number or Block";
              wrongTokenError(expecting, tokens, offset, context);
            }
          })
          .ignore(newline, spaces)
      )
    )
      .onFail((matched, tokens, offset, context) => {
        if (matched[0]) {
          const expecting = "If or Block";
          wrongTokenError(expecting, tokens, offset, context);
        }
      })
      .ignore(newline, spaces)
  )
)
  .ignore(newline, spaces)
  .onFail((matched, tokens, offset, context) => {
    if (matched[0] && matched[1] && matched[2]) {
      const expecting =
        "Chain, Function Call, Math, Wrapped, Array, Range, Symbol, String, Number or Block";
      wrongTokenError(expecting, tokens, offset, context);
    }
    if (matched[0] && matched[1]) {
      const expecting = "Colon";
      wrongTokenError(expecting, tokens, offset, context);
    }
    if (matched[0]) {
      const expecting = "Comparison, Symbol or Number";
      wrongTokenError(expecting, tokens, offset, context);
    }
  })
  .onMatch((result) => {
    const ifOp = result[0];
    const condition = detokenize(result[1]);
    const bodyParts = detokenize(result[3]);
    let isAsync = Array.isArray(bodyParts)
      ? bodyParts[1].isAsync
      : bodyParts.isAsync;
    const body = Array.isArray(bodyParts)
      ? bodyParts[1]
      : new SourceNode(
          bodyParts.line,
          bodyParts.column,
          bodyParts.source,
          arr`{ ${bodyParts} }`
        );
    if (!Array.isArray(bodyParts))
      body.returnForm = new SourceNode(
        bodyParts.line,
        bodyParts.column,
        bodyParts.source,
        arr`{ return ${bodyParts} }`
      );
    const ifExpr = new SourceNode(
      ifOp.line,
      ifOp.column,
      ifOp.source,
      arr`if (${condition}) ${body}`
    );
    ifExpr.returnForm = new SourceNode(
      ifOp.line,
      ifOp.column,
      ifOp.source,
      arr`if (${condition}) ${body.returnForm}`
    );
    const rest = result[4].pop() || [];
    const elses = [];
    for (const [elseOp, elseDef] of rest) {
      const isIf = isOne(elseDef[0], If);
      if (isIf) {
        const elseOp = elseDef[0];
        const condition = detokenize(elseDef[1]);
        const bodyParts = detokenize(elseDef[3]);
        isAsync =
          isAsync || Array.isArray(bodyParts)
            ? bodyParts[1].isAsync
            : bodyParts.isAsync;
        const body = Array.isArray(bodyParts)
          ? bodyParts[1]
          : new SourceNode(
              bodyParts.line,
              bodyParts.column,
              bodyParts.source,
              arr`{ ${bodyParts} }`
            );
        if (!Array.isArray(bodyParts))
          body.returnForm = new SourceNode(
            bodyParts.line,
            bodyParts.column,
            bodyParts.source,
            arr`{ return ${bodyParts} }`
          );
        const expr = new SourceNode(
          elseOp.line,
          elseOp.column,
          elseOp.source,
          arr` else if (${condition}) ${body}`
        );
        expr.returnForm = new SourceNode(
          elseOp.line,
          elseOp.column,
          elseOp.source,
          arr` else if (${condition}) ${body.returnForm}`
        );
        elses.push(expr);
      } else {
        const bodyParts = detokenize(elseDef[1]);
        isAsync =
          isAsync || Array.isArray(bodyParts)
            ? bodyParts[1].isAsync
            : bodyParts.isAsync;
        const body = Array.isArray(bodyParts)
          ? bodyParts[1]
          : new SourceNode(
              bodyParts.line,
              bodyParts.column,
              bodyParts.source,
              arr`{ ${bodyParts} }`
            );
        if (!Array.isArray(bodyParts))
          body.returnForm = new SourceNode(
            bodyParts.line,
            bodyParts.column,
            bodyParts.source,
            arr`{ return ${bodyParts} }`
          );
        const expr = new SourceNode(
          elseOp.line,
          elseOp.column,
          elseOp.source,
          arr` else ${body}`
        );
        expr.returnForm = new SourceNode(
          elseOp.line,
          elseOp.column,
          elseOp.source,
          arr` else ${body.returnForm}`
        );
        elses.push(expr);
      }
    }
    const elseExpr = new SourceNode(null, null, ifOp.source, elses).join("\n");
    elseExpr.returnForm = new SourceNode(
      null,
      null,
      ifOp.source,
      elses.map((el) => el.returnForm)
    ).join("\n");
    const conditional = new SourceNode(
      ifOp.line,
      ifOp.column,
      ifOp.source,
      arr`${ifExpr} ${elseExpr}`
    );
    conditional.returnForm = new SourceNode(
      ifOp.line,
      ifOp.column,
      ifOp.source,
      arr`${ifExpr.returnForm} ${elseExpr.returnForm}`
    );
    conditional.isAsync = isAsync;
    return conditional;
  });

Rules.fn = once(
  option(many(comment, newline)),
  option(Export),
  fn,
  symbol,
  option(many(symbol).ignore(spaces)).onMatch((result) =>
    result.length ? result.pop() : result
  ),
  colon,
  indent,
  Rules.block,
  outdent
)
  .ignore(spaces, newline, comment)
  .onFail((matched, tokens, offset, context) => {
    if (matched.length == 7) {
      const expecting = "Outdent";
      wrongTokenError(expecting, tokens, offset, context);
    }
    if (matched[2] && matched[3] && matched[4] && matched[5] && matched[6]) {
      const expecting = "Block";
      wrongTokenError(expecting, tokens, offset, context);
    }
    if (matched[2] && matched[3] && matched[4] && matched[5]) {
      const expecting = "Indent";
      wrongTokenError(expecting, tokens, offset, context);
    }
    if (matched[2] && matched[3] && matched[4]) {
      const expecting = "Colon";
      wrongTokenError(expecting, tokens, offset, context);
    }
    if (matched[2] && matched[3]) {
      const expecting = "Symbol";
      wrongTokenError(expecting, tokens, offset, context);
    }
    if (matched[2]) {
      const expecting = "Symbol";
      wrongTokenError(expecting, tokens, offset, context);
    }
  })
  .name("function")
  .onMatch((result) => {
    let exportToken = null;
    let fnToken = null;
    while (true) {
      const token = result.shift();
      if (isOne(token, fn)) {
        fnToken = token;
        break;
      } else if (isOne(token[0], comment)) continue;
      else if (isOne(token[0], Export)) exportToken = token[0];
    }
    const name = detokenize(result.shift());
    const args = new SourceNode(
      null,
      null,
      name.source,
      result.shift().flat().map(detokenize)
    ).join(", ");
    const [_, __, body] = result;
    const parts = [];
    const func = body.isAsync
      ? new SourceNode(
          fnToken.line,
          fnToken.column,
          fnToken.source,
          arr`async (${args}) => ${body.returnForm}`
        )
      : new SourceNode(
          fnToken.line,
          fnToken.column,
          fnToken.source,
          arr`(${args}) => ${body.returnForm}`
        );
    parts.push(
      new SourceNode(
        name.line,
        name.column,
        name.source,
        arr`const ${name} = tco(${func})`
      )
    );
    parts.push(
      new SourceNode(
        name.line,
        name.column,
        name.source,
        arr`distributed.set("${name.source}/${name}", ${name})`
      )
    );
    parts.push(
      new SourceNode(
        name.line,
        name.column,
        name.source,
        `${name}.parallel = distributed.get("${name.source}/${name}")`
      )
    );
    if (exportToken)
      parts.push(
        new SourceNode(
          exportToken.line,
          exportToken.column,
          exportToken.source,
          arr`exports.${name} = ${name}`
        )
      );
    const fnNode = new SourceNode(null, null, fnToken.source, parts).join(
      ";\n"
    );
    fnNode.returnForm = new SourceNode(
      null,
      null,
      fnToken.source,
      arr`${fnNode}; return ${name}`
    );
    return fnNode;
  });

Rules.clio = once(
  only(
    any(
      Rules.import,
      Rules.fn,
      Rules.chain,
      Rules.functionCall,
      comment,
      newline,
      spaces
    )
  ).name("clio")
).onMatch((result) => {
  const flat = result
    .flat(2)
    .filter((token) => !isOne(token, newline) && !isOne(token, spaces));
  const innerNode = new SourceNode(null, null, flat[0].source, flat).join(
    ";\n"
  );
  const runtime =
    "const { distributed, emitter, range, slice, tco } = clio; const exports = {}";
  const outerCode = arr`module.exports.__clioModule = async clio => {\n${runtime};\n${innerNode};\nreturn exports }`;
  const outerNode = new SourceNode(null, null, flat[0].source, outerCode);
  return outerNode;
});

const compile = (src, file) => {
  try {
    const tokens = tokenize(src, file);
    const parsed = Rules.clio.satisfies(tokens, 0, { src, tokens });
    const { map, code } = parsed.result.toStringWithSourceMap();
    map.setSourceContent(file, src);
    return { code, map: map.toString() };
  } catch (error) {
    console.trace(error);
    throw error;
  }
};

module.exports.tokenize = tokenize;
module.exports.compile = compile;

/* TODO
  [x] strings
  [x] slices
  [x] imports
  [x] clio
  [x] export and dist
  [x] property access
  [x] fail on more
  [x] cleanup
  [x] add conditional
  [x] add logical
  [x] add power, div, sub
  [x] comparisons
  [x] assignment
  [x] true and false [do we need it?]
  [x] add nested block comments?
  [x] export and distribute
  [x] generate source node
  [x] dotted assign
  [x] add await
  [x] add await block
  [x] add parallel calls
  [x] fix whitespace issue
  [ ] better parsing errors
  [ ] add expression rule
*/
