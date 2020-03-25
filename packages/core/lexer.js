const patterns = require("./patterns");

const zip = (left, right) => left.map((item, index) => [item, right[index]]);

const zipSelf = array => zip(array, array.slice(1)).slice(0, -1);

const tokenize = async string => {
  const tokens = [];
  let index = 0;
  mainloop: while (index < string.length) {
    for (let name in patterns) {
      const pattern = patterns[name];
      const match = string.slice(index).match(pattern);
      if (match != null) {
        const raw = match[0];
        tokens.push({ name, index, raw });
        index += raw.length;
        continue mainloop;
      }
    }
    throw `Lexing error at ${index}`;
  }
  return tokens;
};

const removeEmptyLines = tokens =>
  tokens.filter(token => token.name != "emptyline");

const removeComments = tokens =>
  tokens.filter(token => token.name != "comment");

const brackets = [
  { start: "lbra", end: "rbra" },
  { start: "lcbr", end: "rcbr" },
  { start: "lpar", end: "rpar" }
];

const filterWhites = tokens => {
  for (const { start, end } of brackets) {
    const result = [];
    let level = 0;
    for (const token of tokens) {
      const { name } = token;
      if (name == start) level++;
      else if (name == end) level--;
      if (!whitespaces.includes(name) || level == 0) {
        result.push(token);
      }
    }
    tokens = result;
  }
  return tokens;
};

const flowTokens = ["pipe", "map", "set"];

const insertIndents = tokens => {
  const result = tokens.slice(0, 1);
  const levels = [];
  for (const index in tokens.slice(0, -2)) {
    const [left, middle, right] = tokens.slice(index, index + 3);
    const level = levels[levels.length - 1] || 0;
    const newlineSpace = left.name == "newline" && middle.name == "space";
    const { length } = middle.raw;
    if (newlineSpace && length != level) {
      const dent = level > length ? "dedent" : "indent";
      if (dent == "dedent") {
        while (levels.length && levels[levels.length - 1] > length) {
          const token = { name: dent, raw: dent, index: middle.index };
          result.push(token);
          levels.pop();
        }
      } else if (!flowTokens.includes(right.name)) {
        const token = { name: dent, raw: dent, index: middle.index };
        result.push(token);
        levels.push(middle.raw.length);
      }
    } else if (left.name == "newline" && middle.name != "space" && level > 0) {
      while (levels.length) {
        const token = { name: "dedent", raw: "dedent", index: middle.index };
        result.push(token);
        levels.pop();
      }
    }
    result.push(middle);
  }
  const eof = tokens.pop();
  while (levels.length) {
    const token = { name: "dedent", raw: "dedent", index: eof.index };
    result.push(token);
    levels.pop();
  }
  result.push(eof);
  return result;
};

const sliceables = ["rbra", "string", "symbol"];

const insertSlicers = tokens => {
  const result = [tokens[0]];
  const zipped = zipSelf(tokens);
  for (const [left, right] of zipped) {
    if (sliceables.includes(left.name) && right.name == "lbra") {
      const token = { name: "slicer", raw: "slicer", index: right.index };
      result.push(token);
    }
    result.push(right);
  }
  return result;
};

const pipes = ["map", "pipe"];
const flowEnd = { name: "flowEnd", raw: "flowEnd" };
const flowEnders = ["newline", "set", "rpar"];

const insertFlowEnds = tokens => {
  const result = [];
  let isFlow = false;
  for (const token of tokens) {
    const { name, index } = token;
    if (pipes.includes(name)) {
      if (isFlow) result.push({ ...flowEnd, index });
      isFlow = true;
    } else if (flowEnders.includes(name) && isFlow) {
      isFlow = false;
      result.push({ ...flowEnd, index });
    } else if ("colon" == name) {
      isFlow = false;
    }
    result.push(token);
  }
  return result;
};

const decoratorEnd = { name: "decoratorEnd", raw: "decoratorEnd" };

const insertDecoratorEnds = tokens => {
  const result = [tokens[0]];
  const zipped = zipSelf(tokens);
  let isDecorator = false;
  for (const [left, right] of zipped) {
    if (left.name == "at" && right.name == "symbol") {
      isDecorator = true;
    } else if (right.name == "newline" && isDecorator) {
      const { index } = right;
      result.push({ ...decoratorEnd, index });
      isDecorator = false;
    }
    result.push(right);
  }
  return result;
};

const nextNonWhite = (index, tokens) => {
  index = Number(index);
  for (const { name } of tokens.slice(index)) {
    if (![...whitespaces, "dedent", "indent"].includes(name)) {
      return name;
    }
  }
};

const insertConditionalEnds = tokens => {
  const result = [];
  let indent = 0;
  let inConditional = [];
  let waitingForIndent = false;
  for (const [index, token] of Object.entries(tokens)) {
    if (token.name == "if") inConditional.push(indent);
    if (["if", "elif", "else"].includes(token.name)) waitingForIndent = true;
    if (inConditional.length > 0 && token.name == "indent") {
      if (waitingForIndent) waitingForIndent = false;
      indent++;
    }
    if (inConditional.length > 0 && token.name == "dedent") indent--;
    result.push(token);
    if (
      !waitingForIndent &&
      inConditional.length &&
      indent == inConditional[inConditional.length - 1] &&
      !["else", "elif"].includes(nextNonWhite(index, tokens))
    ) {
      inConditional.pop();
      result.push({ name: "conditionalEnd", index: token.index });
    }
  }
  return result;
};

const whitespaces = ["space", "newline"];

const removeWhites = tokens =>
  tokens.filter(token => !whitespaces.includes(token.name));

const addEOF = tokens => {
  const { index } = tokens[tokens.length - 1];
  return [...tokens, { name: "eof", raw: "eof", index }];
};

const sum = (a, b) => a + b;

const parseIndexes = (tokens, string) => {
  const lines = string.split("\n").map(line => line.length + 1);
  const getLocation = i => {
    let line = 1;
    let count = 0;
    while (count < i) count += lines[line++];
    return {
      line: line,
      column: i - lines.slice(0, line - 1).reduce(sum, 0) + 1,
      i
    };
  };
  return tokens.map(token => {
    return { ...token, location: getLocation(token.index) };
  });
};

const lexer = string =>
  tokenize(string)
    .then(addEOF)
    .then(insertSlicers)
    .then(removeEmptyLines)
    .then(removeComments)
    .then(filterWhites)
    .then(insertIndents)
    .then(insertFlowEnds)
    .then(insertDecoratorEnds)
    .then(insertConditionalEnds)
    .then(removeWhites)
    .then(tokens => parseIndexes(tokens, string));

module.exports = lexer;
