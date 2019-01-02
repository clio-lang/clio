function throw_error(code, error, index) {
  var all_lines = code.split('\n');
  var lines = [];
  var count = 0;
  var line;
  while (count <= index) {
    line = all_lines.shift();
    lines.push(line);
    count += (line.length + 1);
  }
  var last_three_lines = lines.slice(Math.max(lines.length - 3, 0));
  var chars = lines.reduce(function (memo, line) {
    return memo + line.length + 1;
  }, 0);
  var error_at_line = lines.length;
  var error_at_char = index - (chars - (last_three_lines[last_three_lines.length - 1]).length) + 1;
  var line_name_len = error_at_line.toString().length;
  var line_number;
  console.log();
  while (last_three_lines.length > 0) {
    line = last_three_lines.shift();
    line_number = error_at_line - last_three_lines.length;
    line_number = line_number.toString().padStart(line_name_len, ' ');
    console.log(`${line_number} │ ${line}`);
  }
  var pad = new Array(line_name_len + 3 + error_at_char).join(' ')
  console.log(`${pad} ^ ${error} at line ${error_at_line} char ${error_at_char}`);
  console.log();
}

function cast_to_bool(a) {
  switch (typeof a) {
    case "boolean":
      return a;
    case "string":
      return a != '';
    case "array": // TODO: this may not be needed, do research
      return a != [];
    case 'object':
      if (a instanceof Array) {
        return a != [];
      }
      return a != {};
    case 'number':
      return a != 0;
    case 'function':
      return true;
    default:
      return false;
  }
}

exports.throw_error = throw_error;
exports.cast_to_bool = cast_to_bool;
