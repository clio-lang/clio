// TODO: move exceptions to its own file
var chalk = require("chalk");

class ClioException extends Error {
  constructor(e, call) {
    super(e.message);
    this.prev = call;
    Error.captureStackTrace(this, ClioException);
  }
  exit() {
    this.print_stack();
    process.exit_code = 1;
    //throw_error(this.file.source, this.message, this.trace.index)
  }
  print_stack() {
    console.log();
    var prev = this.prev;
    while (prev && prev.clio_stack) {
      prev.clio_stack.forEach(function(stack) {
        resolve_and_print(
          stack.file.source,
          stack.file.name,
          stack.trace.fn,
          stack.trace.index
        );
      });
      prev = prev.prev;
    }
    var message = chalk.red(` Exception: ${this.message}\n`);
    console.log(message);
  }
}

function exception_handler(e, call) {
  if (e.constructor != ClioException) {
    e = new ClioException(e, call);
  }
  throw e;
}

function resolve_and_print(code, file, fn, index) {
  var all_lines = code.split("\n");
  var lines = [];
  var count = 0;
  var chars_before_line = 0;
  var line;
  while (count <= index) {
    line = all_lines.shift();
    lines.push(line);
    count += line.length + 1;
    if (count <= index) {
      chars_before_line = count;
    }
  }
  var last_three_lines = lines.slice(Math.max(lines.length - 3, 0));
  var chars = lines.reduce(function(memo, line) {
    return memo + line.length + 1;
  }, 0);
  var error_at_line = lines.length;
  var error_at_char = index - chars_before_line;
  var line_name_len = error_at_line.toString().length;
  var line_number;
  // prepare styles:
  file = chalk.green(`"${file}"`);
  fn = chalk.magenta.italic(fn);
  var message = chalk.white(` At file ${file} when calling ${fn}:\n`);
  console.log(message);
  while (last_three_lines.length > 0) {
    line = last_three_lines.shift();
    line_number = error_at_line - last_three_lines.length;
    line_number = line_number.toString().padStart(line_name_len, " ");
    line_number = chalk.white(line_number);
    line = chalk.white(`   ${line_number} ${chalk.white("│")} ${line}`);
    console.log(line);
  }
  var pad = new Array(line_name_len + 6 + error_at_char).join(" ");
  error_at_line = chalk.yellow(error_at_line);
  error_at_char = chalk.yellow(error_at_char);
  message = chalk.white(
    `${pad} ^ At line ${error_at_line} char ${error_at_char}`
  );
  console.log(message);
  console.log();
}

function throw_error(code, error, index) {
  var all_lines = code.split("\n");
  var lines = [];
  var count = 0;
  var line;
  while (count <= index) {
    line = all_lines.shift();
    lines.push(line);
    count += line.length + 1;
  }
  var last_three_lines = lines.slice(Math.max(lines.length - 3, 0));
  var chars = lines.reduce(function(memo, line) {
    return memo + line.length + 1;
  }, 0);
  var error_at_line = lines.length;
  var error_at_char =
    index - (chars - last_three_lines[last_three_lines.length - 1].length) + 1;
  var line_name_len = error_at_line.toString().length;
  var line_number;
  console.log();
  while (last_three_lines.length > 0) {
    line = last_three_lines.shift();
    line_number = error_at_line - last_three_lines.length;
    line_number = line_number.toString().padStart(line_name_len, " ");
    console.log(`${line_number} │ ${line}`);
  }
  var pad = new Array(line_name_len + 3 + error_at_char).join(" ");
  console.log(
    `${pad} ^ Exception at line ${error_at_line} char ${error_at_char}`
  );
  console.log(`${pad}   ${error}`);
  console.log();
}

function cast_to_bool(a) {
  switch (typeof a) {
    case "boolean":
      return a;
    case "string":
      return a != "";
    case "array": // TODO: this may not be needed, do research
      return a != [];
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

exports.throw_error = throw_error;
exports.exception_handler = exception_handler;
exports.ClioException = ClioException;
exports.cast_to_bool = cast_to_bool;
