// TODO: move exceptions to its own file
let chalk = require("chalk");

class ClioException extends Error {
  constructor(e, call) {
    super(e.message);
    this.prev = call;
    Error.captureStackTrace(this, ClioException);
  }
  exit() {
    this.printStack();
    process.exitCode = 1;
    //throw_error(this.file.source, this.message, this.trace.index)
  }
  printStack() {
    console.log();
    let prev = this.prev;
    while (prev && prev.clio_stack) {
      prev.clio_stack.forEach(function(stack) {
        resolveAndPrint(
          stack.file.source,
          stack.file.name,
          stack.trace.fn,
          stack.trace.index
        );
      });
      prev = prev.prev;
    }
    let message = chalk.red(` Exception: ${this.message}\n`);
    console.log(message);
  }
}

function exceptionHandler(e, call) {
  if (e.constructor != ClioException) {
    e = new ClioException(e, call);
  }
  throw e;
}

function resolveAndPrint(code, file, fn, index) {
  let allLines = code.split("\n");
  let lines = [];
  let count = 0;
  let charsBeforeLine = 0;
  let line;
  while (count <= index) {
    line = allLines.shift();
    lines.push(line);
    count += line.length + 1;
    if (count <= index) {
      charsBeforeLine = count;
    }
  }
  let lastThreeLines = lines.slice(Math.max(lines.length - 3, 0));
  let errorAtLine = lines.length;
  let errorAtChar = index - charsBeforeLine;
  let lineNameLen = errorAtLine.toString().length;
  let lineNumber;
  // prepare styles:
  file = chalk.green(`"${file}"`);
  fn = chalk.magenta.italic(fn);
  let message = chalk.white(` At file ${file} when calling ${fn}:\n`);
  console.log(message);
  while (lastThreeLines.length > 0) {
    line = lastThreeLines.shift();
    lineNumber = errorAtLine - lastThreeLines.length;
    lineNumber = lineNumber.toString().padStart(lineNameLen, " ");
    lineNumber = chalk.white(lineNumber);
    line = chalk.white(`   ${lineNumber} ${chalk.white("│")} ${line}`);
    console.log(line);
  }
  let pad = new Array(lineNameLen + 6 + errorAtChar).join(" ");
  errorAtLine = chalk.yellow(errorAtLine);
  errorAtChar = chalk.yellow(errorAtChar);
  message = chalk.white(`${pad} ^ At line ${errorAtLine} char ${errorAtChar}`);
  console.log(message);
  console.log();
}

function throwError(code, error, index) {
  let allLines = code.split("\n");
  let lines = [];
  let count = 0;
  let line;
  while (count <= index) {
    line = allLines.shift();
    lines.push(line);
    count += line.length + 1;
  }
  let lastThreeLines = lines.slice(Math.max(lines.length - 3, 0));
  let chars = lines.reduce(function(memo, line) {
    return memo + line.length + 1;
  }, 0);
  let errorAtLine = lines.length;
  let errorAtChar =
    index - (chars - lastThreeLines[lastThreeLines.length - 1].length) + 1;
  let lineNameLen = errorAtLine.toString().length;
  let lineNumber;
  console.log();
  while (lastThreeLines.length > 0) {
    line = lastThreeLines.shift();
    lineNumber = errorAtLine - lastThreeLines.length;
    lineNumber = lineNumber.toString().padStart(lineNameLen, " ");
    console.log(`${lineNumber} │ ${line}`);
  }
  let pad = new Array(lineNameLen + 3 + errorAtChar).join(" ");
  console.log(`${pad} ^ Exception at line ${errorAtLine} char ${errorAtChar}`);
  console.log(`${pad}   ${error}`);
  console.log();
}

function castToBool(a) {
  switch (typeof a) {
    case "boolean":
      return a;
    case "string":
      return a != "";
    case "object":
      if (a instanceof Array) {
        return a != [];
      }
      return a != {};
    case "number":
      return a != 0;
    case "function":
      return true;
    default:
      return false;
  }
}

exports.throw_error = throwError;
exports.exception_handler = exceptionHandler;
exports.ClioException = ClioException;
exports.cast_to_bool = castToBool;
