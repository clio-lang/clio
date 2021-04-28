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
];
/* istanbul ignore next */
const whites = ["lineBreak"];

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
    else break;
  }
  const expecting = Object.keys(rules[lhs.item.type] || {}).join(", ");
  const start = Math.max(0, rhs.item.line - 3);
  const location = rhs.item.meta?.location || rhs;
  const { line, column } = location;
  const message = [
    `Parsing error at ${file}[${line}:${column}]\n`,
    source.split("\n").slice(start, line).join("\n"),
    " ".repeat(column) + "^",
    `\nExpecting one of ${expecting} but encountered ${rhs.item.type}`,
  ].join("\n");
  return new Error(message);
};

module.exports.parsingError = parsingError;
