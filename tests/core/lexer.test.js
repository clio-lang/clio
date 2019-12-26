const lexer = require("../../core/lexer");
const testfile = "'Hello world' -> print";
test("Lexed tokens are stored in array", () => {
  return lexer(testfile).then(output => {
    expect(Array.isArray(output)).toBeTruthy();
  });
});
