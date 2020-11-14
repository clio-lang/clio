const index = require("../index");

test("Index is defined", () => {
  expect(Object.keys({ ...index }).length).toBeGreaterThan(0);
});
