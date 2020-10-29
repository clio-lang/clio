const { tokenize } = require("../index");
const testfile = "'Hello world' -> print";
test("Lexed tokens are stored in array", () => {
  const tokens = tokenize(testfile);
  expect(Array.isArray(tokens)).toBeTruthy();
});
