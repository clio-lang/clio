const { bean } = require("bean-parser");
const lexer = require("./lexer.js");
const model = require("./model.js");
const { colorize } = require("clio-highlight");

const parse = tokens => bean(model, tokens);
const handleParseResult = ([success, result]) => {
  if (success) {
    const cst = result[0];
    return cst;
  } else {
    const firstUnmatched = result[0].name;
    const expecting = model
      .filter(m => m.left == firstUnmatched)
      .map(({ right }) => right);
    const encountered = result[1].name;
    const { location } = result[1];
    const { line, column } = location;
    const lineIndex = line - 1;
    const lines = source
      .split("\n")
      .slice(Math.max(0, lineIndex - 3), lineIndex + 1);
    const lineCount = lines.length;
    console.log();
    lines.forEach((rawLine, index) => {
      const lineNumber = line + 1 - lineCount + index;
      const padding = " ".repeat((line - lineNumber).toString().length + 1);
      const coloredLine = colorize(rawLine);
      console.log(`${padding}${lineNumber} | ${coloredLine}`);
    });
    console.log(" ".repeat(column + 4 + line.toString().length) + "^");
    const ParsingError = `At [${line},${column}]: Expecting one of ${expecting.join(
      ", "
    )} but encountered ${encountered}`;
    throw ParsingError;
  }
};

const parser = source =>
  lexer(source)
    .then(parse)
    .then(handleParseResult);

module.exports = { parser, parse, handleParseResult };
