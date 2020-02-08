const generator = require("../generator");
const parser = require("../parser");
const lexer = require("../lexer");

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
import "module" as m

"Get one element" -> print
[1 2 3 4][0] -> print
[1:4][0] -> print

"\nSlice with range" -> print
[1 2 3 4][0:2] -> print
[1:4][0:2] -> print

"\nSlice with stepped range" -> print
[1 2 3 4 5 6 7 8 9 10][10:0:-2] -> print
[0:11][10:0:-2] -> print

"\nSlice with array" -> print
[1 2 3 4 5 6 7 8][[1 2 3]] -> print
[0:11][[1 2 3]] -> print

"\nMultidimensional slicing" -> print
[[1 2 3]
 [4 5 6]
 [7 8 9]][[0:2] 1] -> print

[[1 2 3]
 [4 5 6]
 [7 8 9]][[0:2] [1]] -> print

# widget
    debug 'on'
    info
      title 'Sample widget'
      name 'main'
    dimensions
      width 500
      height 500
-> print
`;
