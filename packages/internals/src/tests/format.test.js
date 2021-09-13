const format = require("../format");

describe("Test format function", () => {
  test("format", () => {
    const str = format("2 + 2 = ", 4);
    expect(str).toEqual("2 + 2 = 4");
  });
});
