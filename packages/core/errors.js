const rules = require("./rules");

/* istanbul ignore next */
const skips = ["blockOpen", "ifTail"];

/* istanbul ignore next */
const parsingError = (source, file, tokens) => {
  let first = tokens.first;
  let next = tokens.first.next;
  while (true) {
    const isValid = rules[first.item.type][next.item.type];
    if (isValid || skips.includes(next.item.type)) {
      first = next;
      next = first.next;
    } else {
      break;
    }
  }
  first = first.item;
  next = next.item;
  const expecting = Object.keys(rules[first.type] || {}).join(", ");
  const start = Math.max(0, next.line - 3);
  const location = next.meta?.location || next;
  const { line, column } = location;
  const message = [
    `Parsing error at ${file}[${line}:${column}]\n`,
    source.split("\n").slice(start, line).join("\n"),
    " ".repeat(column) + "^",
    `\nExpecting one of ${expecting} but encountered ${next?.type}`,
  ].join("\n");
  return new Error(message);
};

module.exports.parsingError = parsingError;
