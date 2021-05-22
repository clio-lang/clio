const { list } = require("bean-parser");

const strPattern = /^(?:"(?:[^"]|\\")*"|'(?:[^']|\\')*')/;
const numPattern = /^-?(?:[0-9][\d_]*)(?:\.[\d_]+)?(?:[eE][+-]?[\d_]+)?/;

const keywordPattern =
  /^(?:if|else|fn|await|import|as|from|export|and|or|not|by|in)(?=\s|$)|^else(?=:)|^await(?=])/;
const symbolPattern = /^(?:[a-z_$][0-9a-z_$]*)/i; // Should we allow unicode?
const parameterPattern = /^@(?:[a-z_$][0-9a-z_$]*)/i; // Should we allow unicode?
const commentPattern = /^--.*?(?=\n|$)/;
const blockCommentPattern = /^([^+-]|\+[^-]|-[^+])+?(?=(-\+|\+-))/;
const manPattern = /^ *(\n|\n\r|\r\n)(fn |export fn )/;
const awaitAllPattern = /^\[await\]/;

const whites = ["space", "lineBreak", "indent", "outdent", "slicer", "format"];
const wraps = ["lCurly", "lSquare", "lParen"];
const zsIgnore = [...whites, "dot", "ranger", ...wraps];

const lex = (source, file, startLine = 1, startColumn = 0) => {
  const tokens = list([]);
  const levels = [0];
  let line = startLine; // Mozilla SourceMap library is 1-based, unfortunately
  let column = startColumn;
  let squares = 0;
  let curlies = 0;
  let parens = 0;
  const token = (type, value = "", length = value.length) => {
    tokens.push({ type, value, line, column, file });
    source = source.slice(length);
    column += length;
  };
  // § a single number
  const number = () => {
    const match = source.match(numPattern);
    if (match) token("number", match[0]);
    return !!match;
  };
  // lex a formatted string
  const formattedString = () => {
    const match = source.match(strPattern);
    /* istanbul ignore next */
    if (!match) return false;
    token("fmtStart", '"', 1);
    while (source[0]) {
      // Match an escape, { or *, or end of string
      const point = source.match(/^("|([^\\{"])+|\\.|{)/);
      if (point[0] == '"') {
        token("fmtEnd", '"', 1);
        break;
      } else if (point[0][0] == "\\") {
        token("strEscape", point[0], 2);
      } else if (point[0] == "{") {
        let curls = 0;
        let inner = "";
        while (source[0]) {
          switch (source[0]) {
            case "{":
              curls++;
              break;
            case "}":
              curls--;
              break;
            default:
              break;
          }
          inner += source[0];
          source = source.slice(1);
          if (curls === 0) break;
        }
        token("fmtExprStart", "", 0);
        const fmtTokens = lex(inner.slice(1, -1), file, line, column);
        if (fmtTokens.last?.prev?.prev) {
          fmtTokens.last = fmtTokens.last.prev.prev;
          tokens.last.next = fmtTokens.first;
          fmtTokens.first.prev = tokens.last;
          tokens.last = fmtTokens.last;
        } else {
          // Empty
        }
        token("ender", "", 0);
        token("fmtExprEnd", "", 0);
      } else {
        token("fmtStr", point[0]);
      }
    }
    return true;
  };
  // match a string
  const string = () => {
    if (tokens.last?.item?.type == "format") return formattedString();
    const match = source.match(strPattern);
    /* istanbul ignore next */
    if (!match) return false;
    token("string", match[0]);
    return true;
  };
  // match a comment
  const comment = () => {
    const match = source.match(commentPattern);
    if (match) {
      source = source.slice(match[0].length);
      const man = source.match(manPattern);
      if (man) token("comment", match[0], 0);
    }
    return !!match;
  };
  const blockComment = () => {
    let comment = source.slice(0, 2);
    source = source.slice(2);
    let open = 1;
    while (true) {
      const match = source.match(blockCommentPattern);
      if (match) {
        comment += match[0];
        source = source.slice(match[0].length);
      } else if (source.slice(0, 2) == "-+") {
        open--;
        comment += "-+";
        source = source.slice(2);
      } else {
        open++;
        comment += "+-";
        source = source.slice(2);
      }
      if (!open) break;
      if (!source) throw "Imbalanced comment blocks"; // FIXME
    }
    const man = source.match(manPattern);
    /* istanbul ignore next */
    if (man) token("comment", comment, 0);
    return true;
  };
  // indent / outdent
  const indents = () => {
    // check if we're in an array or parentheses
    if (squares || curlies || parens) return;
    // check if this isn't an empty line
    const isEmpty = source.match(/^ *(?=[\r\n])/);
    if (isEmpty) return;
    // check if there are spaces
    const match = source.match(/^ */);
    // check if level is changed
    const level = match[0].length;
    const currLevel = levels[0];
    if (level == currLevel) return;
    // check for math or logical
    const shouldSkip = source.match(/^ *([+*\/%=-]|and|or)/);
    const isDedent = level < currLevel;
    if (shouldSkip && !isDedent) {
      /* istanbul ignore next */
      if (tokens.last.prev) tokens.last = tokens.last.prev;
      return;
    }
    if (tokens.last.prev?.item?.type?.endsWith?.("Op")) return;
    // insert outdent / indent token
    if (level < currLevel) {
      if (levels.indexOf(level) == -1)
        throw new Error("Inconsistent indentation");
      while (levels[0] != level) {
        levels.shift();
        token("outdent");
      }
      /* istanbul ignore next */
    } else {
      levels.unshift(level);
      /* istanbul ignore next */
      if (tokens.last.prev) tokens.last = tokens.last.prev;
      token("indent");
    }
  };
  // match an indented hash
  const hashIndent = () => {
    const isIndented = source.match(/^ *(?:[a-z_$][0-9a-z_$]*) *: *\n/);
    if (isIndented) {
      levels.unshift(levels[0] + 2);
      /* istanbul ignore next */
      token("indent");
    }
  };
  // match white spaces
  const space = () => {
    const match = source.match(/ +/);
    /* istanbul ignore next */
    if (!match) return false;
    token("space", match[0]);
    return true;
  };
  // match a keyword
  const keyword = () => {
    const match = source.match(keywordPattern);
    if (match) token(match[0], match[0]);
    return !!match;
  };
  // match await all
  const awaitAll = () => {
    const match = source.match(awaitAllPattern);
    if (match) token("awaitAll", match[0]);
    return !!match;
  };
  // match a symbol
  const symbol = () => {
    const match = source.match(symbolPattern);
    if (match) token("symbol", match[0]);
    return !!match;
  };
  // match a parameter
  const parameter = () => {
    const match = source.match(parameterPattern);
    if (match) token("parameter", match[0]);
    return !!match;
  };
  // match a zero-space
  const zeroSpace = () => {
    const shouldIgnire = zsIgnore.includes(tokens.last?.item?.type);
    if (shouldIgnire) return;
    if (source[0] == '"') token("format", "", 0);
    else if (source[0] == "[") token("slicer", "", 0);
  };
  while (source.length) {
    const char = source[0];
    switch (char) {
      case "#":
        token("hash", char, 1);
        hashIndent();
        break;
      case ".":
        if (source[1] == ".") token("ranger", "..", 2);
        else token("dot", char, 1);
        break;
      case "|":
        token("pike", char, 1);
        break;
      case "{":
        token("groupStart", "", 0);
        token("lCurly", char, 1);
        curlies++;
        break;
      case "}":
        token("rCurly", char, 1);
        token("groupEnd", "", 0);
        curlies--;
        if (curlies < 0) throw new Error("Imbalanced curly braces");
        break;
      case "[":
        if (!awaitAll()) {
          token("groupStart", "", 0);
          token("lSquare", char, 1);
          squares++;
        }
        break;
      case "]":
        token("rSquare", char, 1);
        token("groupEnd", "", 0);
        squares--;
        if (squares < 0) throw new Error("Imbalanced square braces");
        break;
      case "(":
        token("groupStart", "", 0);
        token("lParen", char, 1);
        parens++;
        break;
      case ")":
        token("ender", "", 0);
        token("rParen", char, 1);
        token("groupEnd", "", 0);
        parens--;
        if (parens < 0) throw new Error("Imbalanced parentheses");
        break;
      case ":":
        token("colon", char, 1);
        break;
      case '"':
        string();
        break;
      case "-":
        if (source[1] == ">") {
          token("ender", "", 0);
          token("arrow", "->", 2);
        } else if (!number() && !comment()) {
          token("subOp", char, 1);
        }
        break;
      case "+":
        if (source[1] == "-") {
          blockComment();
        } else {
          token("addOp", char, 1);
        }
        break;
      case ">":
        if (source[1] == "=") token("gte", ">=", 2);
        else token("gt", char, 1);
        break;
      case "<":
        if (source[1] == "=") token("lte", "<=", 2);
        else token("lt", char, 1);
        break;
      case "=":
        if (source[1] == ">") {
          token("ender", "", 0);
          token("fatArrow", "=>", 2);
        } else if (source[1] == "=") token("eq", "==", 2);
        else token("assign", char, 1);
        break;
      case "/":
        token("divOp", char, 1);
        break;
      case "%":
        token("modOp", char, 1);
        break;
      case "*":
        if (source[1] == "*") token("powOp", "**", 2);
        else token("mulOp", "*", 1);
        break;
      case "0":
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
      case "7":
      case "8":
      case "9":
        number();
        break;
      case " ":
        space();
        break;
      case "\r":
        source = source.slice(1);
        column++;
        break;
      case "\n":
        token("lineBreak", "\n", 1);
        line++;
        column = 0;
        indents();
        break;
      default:
        if (!keyword() && !parameter() && !symbol())
          throw new Error(`Unsupported character ${char}!`);
        break;
    }
    zeroSpace();
  }
  while (levels.shift()) {
    token("lineBreak", "", 0);
    token("outdent", "", 0);
  }
  token("lineBreak", "", 0);
  token("eof", "", 0);
  const { current } = tokens;
  let node = current;
  while (node) {
    /* istanbul ignore next */
    if (node.item.type == "space") {
      node.unlink();
      node = node.prev || node.next;
    } else {
      node = node.next;
    }
  }
  return tokens;
};

module.exports = lex;
