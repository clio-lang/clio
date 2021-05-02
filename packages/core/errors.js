const rules = require("./rules");

/* istanbul ignore next */
const opens = [
  "blockOpen",
  "addLhs",
  "mulLhs",
  "subLhs",
  "divLhs",
  "powLhs",
  "comparisonOpen",
  "logicalOpen",
  "export",
  "fnTail",
];
/* istanbul ignore next */
const whites = ["lineBreak", "indent", "outdent"];

const getMessage = (file, line, start, column, source, expecting, rhs) => {
  const code = source.split("\n").slice(start, line).join("\n");
  return [
    `Parsing error at ${file}[${line}:${column}]\n`,
    code,
    " ".repeat(column) + "^",
    `\nExpecting one of ${expecting} but encountered ${rhs.item.type}`,
  ].join("\n");
};

/* istanbul ignore next */
const parsingError = (source, file, tokens) => {
  let lhs = tokens.first;
  let rhs = tokens.first.next;
  const step = () => {
    lhs = rhs;
    rhs = lhs.next;
  };
  while (true) {
    if (opens.includes(rhs.item.type)) step();
    else if (whites.includes(lhs.item.type)) step();
    else if (whites.includes(rhs.item.type)) step();
    else break;
  }
  if (rhs.item.type == "clio") rhs = { item: rhs.item.content[0]?.node };
  const expecting = Object.keys(rules[lhs.item.type] || {}).join(", ");
  const start = Math.max(0, rhs.item.line - 3);
  const location = rhs.item.meta?.location || rhs.item;
  const { line, column } = location;
  const message = getMessage(file, line, start, column, source, expecting, rhs);
  return new Error(message);
};

module.exports.parsingError = parsingError;
