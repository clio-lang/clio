const fs = require("fs");
const path = require("path");

const lexer = require("../../core/lexer");
const testfile = fs
  .readFileSync(path.join(__dirname, "../test.clio"))
  .toString();
test("Lexed tokens are stored in array", () => {
  return lexer(testfile).then(output => {
    expect(Array.isArray(output)).toBeTruthy();
  });
});
