const generator = require("../../core/generator");
const parser = require("../../core/parser");

test("Generate from AST", () => {
  const [, parsed] = parser.parse(tokens);
  const output = generator.generate(parsed[0]);
  expect(typeof output).toBe("string");
});

const tokens = [
  { name: "lbra", index: 0, raw: "[" },
  { name: "number", index: 1, raw: "1" },
  { name: "number", index: 3, raw: "2" },
  { name: "number", index: 5, raw: "3" },
  { name: "rbra", index: 6, raw: "]" },
  { name: "map", index: 10, raw: "-> *" },
  { name: "symbol", index: 15, raw: "mul" },
  { name: "number", index: 19, raw: "2" },
  { name: "flow_end", raw: "flow_end", index: 20 },
  { name: "map", index: 23, raw: "-> *" },
  { name: "symbol", index: 28, raw: "add" },
  { name: "number", index: 32, raw: "1" },
  { name: "flow_end", raw: "flow_end", index: 33 },
  { name: "pipe", index: 36, raw: "->" },
  { name: "symbol", index: 39, raw: "print" },
  { name: "flow_end", raw: "flow_end", index: 45 },
  { name: "lbra", index: 46, raw: "[" },
  { name: "number", index: 47, raw: "1" },
  { name: "number", index: 49, raw: "2" },
  { name: "number", index: 51, raw: "3" },
  { name: "rbra", index: 52, raw: "]" },
  { name: "map", index: 56, raw: "-> *" },
  { name: "symbol", index: 61, raw: "mul" },
  { name: "number", index: 65, raw: "2" },
  { name: "flow_end", raw: "flow_end", index: 66 },
  { name: "map", index: 69, raw: "-> *" },
  { name: "symbol", index: 74, raw: "add" },
  { name: "number", index: 78, raw: "1" },
  { name: "flow_end", raw: "flow_end", index: 79 },
  { name: "map", index: 82, raw: "-> *" },
  { name: "symbol", index: 87, raw: "print" },
  { name: "flow_end", raw: "flow_end", index: 92 },
  { name: "eof", raw: "eof", index: 92 }
];
