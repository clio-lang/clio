const generator = require("../../core/generator");
const parser = require("../../core/parser");
const lexer = require("../../core/lexer");

test("Generate from AST", async () => {
  const tokens = await lexer(source);
  const [, parsed] = parser.parse(tokens);
  const output = generator.generate(parsed[0]);
  expect(typeof output).toBe("string");
});

const source = `
[1 2 3] -> * mul 4 -> print

fn add a b:
  a + b

if a > 100:
  "a > 100" -> print
elif a < 100:
  "a < 100" -> print
else:
  "a = 100" -> print

import * from "here"
import this from "that"
import this as that from "other"
import "module"
`;
