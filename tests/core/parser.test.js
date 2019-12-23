const parser = require("../../core/parser");

test("Parse tokens", () => {
  const tokens = [
    { index: 0, name: "string", raw: "'Hello World'" },
    { index: 14, name: "pipe", raw: "->" },
    { index: 17, name: "symbol", raw: "print" },
    { index: 17, name: "eof", raw: "eof" }
  ];
  const [, output] = parser.parse(tokens);
  expect(output[0].name).toBe("string");
});

test("Parse input string", async () => {
  const output = await parser.parser("'Hello World' -> print\n");
  expect(output.name).toBe("clio");
});

test("Parse fails", async () => {
  return parser.parser("'Hello World -> print\n").catch(e => {
    expect(e).toBeDefined();
  });
});
