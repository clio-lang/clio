const compiler = require("../../core/compiler");
test("Compile code", () => {
  return compiler.compile("[1 2 3] -> print\n").then(out => {
    expect(typeof out).toBe("string");
  });
});
